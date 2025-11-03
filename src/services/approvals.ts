import {
	type BigNumber,
	Contract,
	constants,
	providers,
	utils,
	Wallet,
} from "ethers";
import { getConfig, POLYGON_ADDRESSES } from "./config.js";

// Minimal ABIs needed for approvals (from Polymarket SDK)
const USDC_ABI = [
	"function allowance(address owner, address spender) view returns (uint256)",
	"function approve(address spender, uint256 amount) returns (bool)",
];

const CTF_ABI = [
	"function isApprovedForAll(address owner, address operator) view returns (bool)",
	"function setApprovalForAll(address operator, bool approved)",
];

/**
 * Get USDC contract instance (following Polymarket SDK pattern)
 */
function getUsdcContract(wallet: Wallet): Contract {
	return new Contract(POLYGON_ADDRESSES.USDC_ADDRESS, USDC_ABI, wallet);
}

/**
 * Get Conditional Tokens Framework (CTF) contract instance (following Polymarket SDK pattern)
 */
function getCtfContract(wallet: Wallet): Contract {
	return new Contract(POLYGON_ADDRESSES.CTF_ADDRESS, CTF_ABI, wallet);
}

export type ApprovalCheck = {
	usdcAllowanceForCTF: string;
	usdcAllowanceForExchange: string;
	ctfApprovedForExchange: boolean;
	usdcAllowanceForNegRiskExchange: string;
	usdcAllowanceForNegRiskAdapter: string;
	ctfApprovedForNegRiskExchange: boolean;
	ctfApprovedForNegRiskAdapter: boolean;
	missing: Array<
		| "USDC_ALLOWANCE_FOR_CTF"
		| "USDC_ALLOWANCE_FOR_EXCHANGE"
		| "CTF_APPROVAL_FOR_EXCHANGE"
		| "USDC_ALLOWANCE_FOR_NEG_RISK_EXCHANGE"
		| "USDC_ALLOWANCE_FOR_NEG_RISK_ADAPTER"
		| "CTF_APPROVAL_FOR_NEG_RISK_EXCHANGE"
		| "CTF_APPROVAL_FOR_NEG_RISK_ADAPTER"
	>;
	addresses: typeof POLYGON_ADDRESSES;
	owner: string;
};

/**
 * Build a signer using the same config used elsewhere in the SDK
 */
function getSignerFromEnv(): Wallet {
	const cfg = getConfig();
	if (!cfg.privateKey) {
		throw new Error(
			"POLYMARKET_PRIVATE_KEY environment variable is required for approvals",
		);
	}
	const provider = new providers.JsonRpcProvider(cfg.rpcUrl);
	return new Wallet(cfg.privateKey, provider);
}

export class ApprovalRequiredError extends Error {
	code = "APPROVAL_REQUIRED" as const;
	details: ApprovalCheck;
	hint: string;
	nextStep: { tool: string; name: string; description: string };

	constructor(details: ApprovalCheck) {
		const msgLines = [
			"Token approvals are required before proceeding.",
			PolymarketApprovals.rationale(),
			"Use the 'approve_allowances' tool to grant approvals, then retry your action.",
		];
		super(msgLines.join("\n\n"));
		this.name = "ApprovalRequiredError";
		this.details = details;
		this.hint = PolymarketApprovals.rationale();
		this.nextStep = {
			tool: "approve_allowances",
			name: "Approve Allowances",
			description:
				"Grant USDC and CTF approvals required for Polymarket trading (revocable at any time).",
		};
	}

	toJSON() {
		return {
			approvalRequired: true,
			code: this.code,
			message: this.message,
			details: this.details,
			nextStep: this.nextStep,
			hint: this.hint,
		} as const;
	}
}

/**
 * Class-style approvals service for consistency with other services.
 */
export class PolymarketApprovals {
	private signer: Wallet;

	constructor(signer?: Wallet) {
		this.signer = signer ?? getSignerFromEnv();
	}

	/** Get the next pending nonce for this signer */
	private async getPendingNonce(): Promise<number> {
		return this.signer.getTransactionCount("pending");
	}

	/**
	 * Build gas overrides for Polygon transactions.
	 * Uses fixed gas settings similar to the Polymarket SDK example.
	 */
	private buildFeeOverrides(): {
		gasPrice: providers.TransactionRequest["gasPrice"];
		gasLimit: providers.TransactionRequest["gasLimit"];
	} {
		// Following the SDK example pattern with 100 gwei gas price
		// and 200k gas limit for approval transactions
		return {
			gasPrice: utils.parseUnits("100", "gwei"), // 100 gwei = 100_000_000_000 wei
			gasLimit: 200_000,
		};
	}

	/**
	 * Broadcast a tx with explicit nonce, using a single retry on replacement/nonce errors.
	 * Returns the transaction hash (or confirmed receipt hash if waiting > 0).
	 */
	private async sendWithNonceAndRetry(
		send: (
			overrides: providers.TransactionRequest,
		) => Promise<providers.TransactionResponse>,
		nextNonceRef: { value: number },
		waitConfs: number,
		feeOverrides: Pick<providers.TransactionRequest, "gasPrice" | "gasLimit">,
	): Promise<string> {
		const trySend = async () => {
			return send({ nonce: nextNonceRef.value, ...feeOverrides });
		};

		try {
			const tx = await trySend();
			nextNonceRef.value += 1;

			if (waitConfs > 0) {
				const receipt = await tx.wait(waitConfs);
				return receipt.transactionHash;
			}
			return tx.hash;
		} catch (e) {
			const msg = (e as Error).message || "";
			const code = (e as { code?: number } | undefined)?.code;
			const isReplaceErr =
				code === -32000 ||
				msg.includes("replace") ||
				msg.includes("replacement") ||
				msg.toLowerCase().includes("nonce");

			if (!isReplaceErr) throw e;

			// Refresh nonce and retry once
			nextNonceRef.value = await this.getPendingNonce();
			const tx = await trySend();
			nextNonceRef.value += 1;

			if (waitConfs > 0) {
				const receipt = await tx.wait(waitConfs);
				return receipt.transactionHash;
			}
			return tx.hash;
		}
	}

	static rationale(): string {
		const a = POLYGON_ADDRESSES;

		const rationale = [
			"Trading on Polymarket requires granting limited permissions so the exchange can settle orders:",
			"- USDC allowances let the Conditional Tokens Framework (CTF), Exchange, and NegRisk contracts move your USDC to mint/redeem and settle trades.",
			"- CTF setApprovalForAll lets the Exchange and NegRisk contracts move your position tokens during settlement.",
			`Contracts: USDC=${a.USDC_ADDRESS}, CTF=${a.CTF_ADDRESS}, Exchange=${a.EXCHANGE_ADDRESS}`,
			`NegRisk: Exchange=${a.NEG_RISK_EXCHANGE_ADDRESS}, Adapter=${a.NEG_RISK_ADAPTER_ADDRESS}`,
			"These are standard ERC20/ERC1155 approvals, set to MaxUint for fewer prompts, and can be revoked in your wallet at any time.",
		];

		return rationale.join("\n");
	}

	/** Format an approval error into a response object. */
	static formatError(err: ApprovalRequiredError) {
		return err.toJSON();
	}

	/**
	 * Get contract addresses for Polygon mainnet
	 */
	private getContractAddresses() {
		return POLYGON_ADDRESSES;
	}

	/** Check current approval state for the signer's wallet address */
	async check(): Promise<ApprovalCheck> {
		const addresses = this.getContractAddresses();
		const {
			CTF_ADDRESS,
			EXCHANGE_ADDRESS,
			NEG_RISK_EXCHANGE_ADDRESS,
			NEG_RISK_ADAPTER_ADDRESS,
		} = addresses;

		const usdc = getUsdcContract(this.signer);
		const ctf = getCtfContract(this.signer);

		const walletAddress = this.signer.address;

		// Check allowances for both regular and NegRisk markets
		const [
			usdcAllowanceCtf,
			usdcAllowanceExchange,
			ctfApprovedForExchange,
			usdcAllowanceNegRiskExchange,
			usdcAllowanceNegRiskAdapter,
			ctfApprovedForNegRiskExchange,
			ctfApprovedForNegRiskAdapter,
		] = await Promise.all([
			usdc.allowance(walletAddress, CTF_ADDRESS) as Promise<BigNumber>,
			usdc.allowance(walletAddress, EXCHANGE_ADDRESS) as Promise<BigNumber>,
			ctf.isApprovedForAll(walletAddress, EXCHANGE_ADDRESS) as Promise<boolean>,
			usdc.allowance(
				walletAddress,
				NEG_RISK_EXCHANGE_ADDRESS,
			) as Promise<BigNumber>,
			usdc.allowance(
				walletAddress,
				NEG_RISK_ADAPTER_ADDRESS,
			) as Promise<BigNumber>,
			ctf.isApprovedForAll(
				walletAddress,
				NEG_RISK_EXCHANGE_ADDRESS,
			) as Promise<boolean>,
			ctf.isApprovedForAll(
				walletAddress,
				NEG_RISK_ADAPTER_ADDRESS,
			) as Promise<boolean>,
		]);

		const missing: ApprovalCheck["missing"] = [];

		// Check if approvals are set (following SDK example - check if > 0)
		if (!usdcAllowanceCtf.gt(constants.Zero))
			missing.push("USDC_ALLOWANCE_FOR_CTF");
		if (!usdcAllowanceExchange.gt(constants.Zero))
			missing.push("USDC_ALLOWANCE_FOR_EXCHANGE");
		if (!ctfApprovedForExchange) missing.push("CTF_APPROVAL_FOR_EXCHANGE");
		if (!usdcAllowanceNegRiskExchange.gt(constants.Zero))
			missing.push("USDC_ALLOWANCE_FOR_NEG_RISK_EXCHANGE");
		if (!usdcAllowanceNegRiskAdapter.gt(constants.Zero))
			missing.push("USDC_ALLOWANCE_FOR_NEG_RISK_ADAPTER");
		if (!ctfApprovedForNegRiskExchange)
			missing.push("CTF_APPROVAL_FOR_NEG_RISK_EXCHANGE");
		if (!ctfApprovedForNegRiskAdapter)
			missing.push("CTF_APPROVAL_FOR_NEG_RISK_ADAPTER");

		return {
			usdcAllowanceForCTF: usdcAllowanceCtf.toString(),
			usdcAllowanceForExchange: usdcAllowanceExchange.toString(),
			ctfApprovedForExchange,
			usdcAllowanceForNegRiskExchange: usdcAllowanceNegRiskExchange.toString(),
			usdcAllowanceForNegRiskAdapter: usdcAllowanceNegRiskAdapter.toString(),
			ctfApprovedForNegRiskExchange,
			ctfApprovedForNegRiskAdapter,
			missing,
			addresses,
			owner: walletAddress,
		};
	}

	/**
	 * Throw a structured error if approvals are missing.
	 */
	async assertApproved(): Promise<void> {
		const status = await this.check();

		if (status.missing.length > 0) {
			throw new ApprovalRequiredError(status);
		}
	}

	/**
	 * Execute approvals. By default approves all required allowances with MaxUint256.
	 * Follows the Polymarket SDK example pattern for setting approvals.
	 */
	async approveAll(opts?: {
		approveUsdcForCTF?: boolean;
		approveUsdcForExchange?: boolean;
		approveCtfForExchange?: boolean;
		approveUsdcForNegRiskExchange?: boolean;
		approveUsdcForNegRiskAdapter?: boolean;
		approveCtfForNegRiskExchange?: boolean;
		approveCtfForNegRiskAdapter?: boolean;
		waitForConfirmations?: number;
		force?: boolean;
	}): Promise<{
		txHashes: string[];
		message: string;
		waitedConfirmations: number;
	}> {
		const addresses = this.getContractAddresses();
		const {
			CTF_ADDRESS,
			EXCHANGE_ADDRESS,
			NEG_RISK_EXCHANGE_ADDRESS,
			NEG_RISK_ADAPTER_ADDRESS,
		} = addresses;

		const usdc = getUsdcContract(this.signer);
		const ctf = getCtfContract(this.signer);

		// Determine which approvals are missing
		const current = await this.check();

		const selections = {
			approveUsdcForCTF: opts?.approveUsdcForCTF ?? true,
			approveUsdcForExchange: opts?.approveUsdcForExchange ?? true,
			approveCtfForExchange: opts?.approveCtfForExchange ?? true,
			approveUsdcForNegRiskExchange:
				opts?.approveUsdcForNegRiskExchange ?? true,
			approveUsdcForNegRiskAdapter: opts?.approveUsdcForNegRiskAdapter ?? true,
			approveCtfForNegRiskExchange: opts?.approveCtfForNegRiskExchange ?? true,
			approveCtfForNegRiskAdapter: opts?.approveCtfForNegRiskAdapter ?? true,
		};

		const txHashes: string[] = [];
		const waitConfs = Math.max(0, opts?.waitForConfirmations ?? 0);
		const feeOverrides = this.buildFeeOverrides();
		const nextNonceRef = { value: await this.getPendingNonce() };

		let actions = 0;

		// Set USDC allowance for CTF (Conditional Tokens Framework)
		// This allows CTF to move USDC for minting/redeeming positions
		if (
			selections.approveUsdcForCTF &&
			(opts?.force || current.missing.includes("USDC_ALLOWANCE_FOR_CTF"))
		) {
			const h = await this.sendWithNonceAndRetry(
				(overrides) =>
					usdc.approve(CTF_ADDRESS, constants.MaxUint256, overrides),
				nextNonceRef,
				waitConfs,
				feeOverrides,
			);
			txHashes.push(h);
			actions++;
			console.log(`Setting USDC allowance for CTF: ${h}`);
		}

		// Set USDC allowance for Exchange
		// This allows the Exchange to move USDC for order settlement
		if (
			selections.approveUsdcForExchange &&
			(opts?.force || current.missing.includes("USDC_ALLOWANCE_FOR_EXCHANGE"))
		) {
			const h = await this.sendWithNonceAndRetry(
				(overrides) =>
					usdc.approve(EXCHANGE_ADDRESS, constants.MaxUint256, overrides),
				nextNonceRef,
				waitConfs,
				feeOverrides,
			);
			txHashes.push(h);
			actions++;
			console.log(`Setting USDC allowance for Exchange: ${h}`);
		}

		// Set CTF approval for Exchange
		// This allows the Exchange to move position tokens (CTF ERC1155 tokens)
		if (
			selections.approveCtfForExchange &&
			(opts?.force || current.missing.includes("CTF_APPROVAL_FOR_EXCHANGE"))
		) {
			const h = await this.sendWithNonceAndRetry(
				(overrides) => ctf.setApprovalForAll(EXCHANGE_ADDRESS, true, overrides),
				nextNonceRef,
				waitConfs,
				feeOverrides,
			);
			txHashes.push(h);
			actions++;
			console.log(`Setting Conditional Tokens allowance for Exchange: ${h}`);
		}

		// Set USDC allowance for NegRisk Exchange
		// Required for trading on negative risk markets
		if (
			selections.approveUsdcForNegRiskExchange &&
			(opts?.force ||
				current.missing.includes("USDC_ALLOWANCE_FOR_NEG_RISK_EXCHANGE"))
		) {
			const h = await this.sendWithNonceAndRetry(
				(overrides) =>
					usdc.approve(
						NEG_RISK_EXCHANGE_ADDRESS,
						constants.MaxUint256,
						overrides,
					),
				nextNonceRef,
				waitConfs,
				feeOverrides,
			);
			txHashes.push(h);
			actions++;
			console.log(`Setting USDC allowance for NegRisk Exchange: ${h}`);
		}

		// Set USDC allowance for NegRisk Adapter
		// Required for trading on negative risk markets
		if (
			selections.approveUsdcForNegRiskAdapter &&
			(opts?.force ||
				current.missing.includes("USDC_ALLOWANCE_FOR_NEG_RISK_ADAPTER"))
		) {
			const h = await this.sendWithNonceAndRetry(
				(overrides) =>
					usdc.approve(
						NEG_RISK_ADAPTER_ADDRESS,
						constants.MaxUint256,
						overrides,
					),
				nextNonceRef,
				waitConfs,
				feeOverrides,
			);
			txHashes.push(h);
			actions++;
			console.log(`Setting USDC allowance for NegRisk Adapter: ${h}`);
		}

		// Set CTF approval for NegRisk Exchange
		// Required for trading on negative risk markets
		if (
			selections.approveCtfForNegRiskExchange &&
			(opts?.force ||
				current.missing.includes("CTF_APPROVAL_FOR_NEG_RISK_EXCHANGE"))
		) {
			const h = await this.sendWithNonceAndRetry(
				(overrides) =>
					ctf.setApprovalForAll(NEG_RISK_EXCHANGE_ADDRESS, true, overrides),
				nextNonceRef,
				waitConfs,
				feeOverrides,
			);
			txHashes.push(h);
			actions++;
			console.log(`Setting CTF allowance for NegRisk Exchange: ${h}`);
		}

		// Set CTF approval for NegRisk Adapter
		// Required for trading on negative risk markets
		if (
			selections.approveCtfForNegRiskAdapter &&
			(opts?.force ||
				current.missing.includes("CTF_APPROVAL_FOR_NEG_RISK_ADAPTER"))
		) {
			const h = await this.sendWithNonceAndRetry(
				(overrides) =>
					ctf.setApprovalForAll(NEG_RISK_ADAPTER_ADDRESS, true, overrides),
				nextNonceRef,
				waitConfs,
				feeOverrides,
			);
			txHashes.push(h);
			actions++;
			console.log(`Setting CTF allowance for NegRisk Adapter: ${h}`);
		}

		console.log("Allowances set");

		return {
			txHashes,
			message:
				actions === 0
					? "No transactions needed; required approvals are already in place."
					: waitConfs > 0
						? `Approvals confirmed with ${waitConfs} confirmation(s). You can revoke or adjust allowances at any time using your wallet.`
						: "Approval transactions submitted. You can monitor them in your wallet and revoke at any time.",
			waitedConfirmations: waitConfs,
		};
	}
}
