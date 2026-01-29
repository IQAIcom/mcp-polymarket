import {
	type BigNumber,
	Contract,
	constants,
	providers,
	utils,
	Wallet,
} from "ethers";
import { getConfig, POLYGON_ADDRESSES } from "./config.js";

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
	 * Send transaction with nonce management and retry logic.
	 */
	private async sendTx(
		send: (
			overrides: providers.TransactionRequest,
		) => Promise<providers.TransactionResponse>,
		nonce: number,
		waitConfs: number,
	): Promise<string> {
		const overrides = {
			nonce,
			gasPrice: utils.parseUnits("100", "gwei"),
			gasLimit: 200_000,
		};

		try {
			const tx = await send(overrides);
			if (waitConfs > 0) {
				const receipt = await tx.wait(waitConfs);
				return receipt.transactionHash;
			}
			return tx.hash;
		} catch (e) {
			const msg = (e as Error).message || "";
			const isNonceErr =
				msg.toLowerCase().includes("nonce") || msg.includes("replace");
			if (!isNonceErr) throw e;

			// Retry with fresh nonce
			const freshNonce = await this.getPendingNonce();
			const tx = await send({ ...overrides, nonce: freshNonce });
			if (waitConfs > 0) {
				const receipt = await tx.wait(waitConfs);
				return receipt.transactionHash;
			}
			return tx.hash;
		}
	}

	static rationale(): string {
		return [
			"Trading on Polymarket requires granting limited permissions:",
			"- USDC allowances let CTF, Exchange, and NegRisk contracts move USDC for minting/settling.",
			"- CTF setApprovalForAll lets Exchange and NegRisk move position tokens during settlement.",
			"Standard ERC20/ERC1155 approvals set to MaxUint. Revocable anytime in your wallet.",
		].join("\n");
	}

	/** Check current approval state for the signer's wallet address */
	async check(): Promise<ApprovalCheck> {
		const {
			CTF_ADDRESS,
			EXCHANGE_ADDRESS,
			NEG_RISK_EXCHANGE_ADDRESS,
			NEG_RISK_ADAPTER_ADDRESS,
		} = POLYGON_ADDRESSES;
		const usdc = getUsdcContract(this.signer);
		const ctf = getCtfContract(this.signer);
		const addr = this.signer.address;

		const [
			usdcCtf,
			usdcExch,
			ctfExch,
			usdcNegExch,
			usdcNegAdapt,
			ctfNegExch,
			ctfNegAdapt,
		] = await Promise.all([
			usdc.allowance(addr, CTF_ADDRESS) as Promise<BigNumber>,
			usdc.allowance(addr, EXCHANGE_ADDRESS) as Promise<BigNumber>,
			ctf.isApprovedForAll(addr, EXCHANGE_ADDRESS) as Promise<boolean>,
			usdc.allowance(addr, NEG_RISK_EXCHANGE_ADDRESS) as Promise<BigNumber>,
			usdc.allowance(addr, NEG_RISK_ADAPTER_ADDRESS) as Promise<BigNumber>,
			ctf.isApprovedForAll(addr, NEG_RISK_EXCHANGE_ADDRESS) as Promise<boolean>,
			ctf.isApprovedForAll(addr, NEG_RISK_ADAPTER_ADDRESS) as Promise<boolean>,
		]);

		const missing: ApprovalCheck["missing"] = [];
		if (!usdcCtf.gt(constants.Zero)) missing.push("USDC_ALLOWANCE_FOR_CTF");
		if (!usdcExch.gt(constants.Zero))
			missing.push("USDC_ALLOWANCE_FOR_EXCHANGE");
		if (!ctfExch) missing.push("CTF_APPROVAL_FOR_EXCHANGE");
		if (!usdcNegExch.gt(constants.Zero))
			missing.push("USDC_ALLOWANCE_FOR_NEG_RISK_EXCHANGE");
		if (!usdcNegAdapt.gt(constants.Zero))
			missing.push("USDC_ALLOWANCE_FOR_NEG_RISK_ADAPTER");
		if (!ctfNegExch) missing.push("CTF_APPROVAL_FOR_NEG_RISK_EXCHANGE");
		if (!ctfNegAdapt) missing.push("CTF_APPROVAL_FOR_NEG_RISK_ADAPTER");

		return {
			usdcAllowanceForCTF: usdcCtf.toString(),
			usdcAllowanceForExchange: usdcExch.toString(),
			ctfApprovedForExchange: ctfExch,
			usdcAllowanceForNegRiskExchange: usdcNegExch.toString(),
			usdcAllowanceForNegRiskAdapter: usdcNegAdapt.toString(),
			ctfApprovedForNegRiskExchange: ctfNegExch,
			ctfApprovedForNegRiskAdapter: ctfNegAdapt,
			missing,
			addresses: POLYGON_ADDRESSES,
			owner: addr,
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
	 * Execute approvals for contracts that don't already have approvals set.
	 */
	async approveAll(opts?: { waitForConfirmations?: number }): Promise<{
		txHashes: string[];
		message: string;
		waitedConfirmations: number;
	}> {
		const {
			CTF_ADDRESS,
			EXCHANGE_ADDRESS,
			NEG_RISK_EXCHANGE_ADDRESS,
			NEG_RISK_ADAPTER_ADDRESS,
		} = POLYGON_ADDRESSES;
		const usdc = getUsdcContract(this.signer);
		const ctf = getCtfContract(this.signer);
		const current = await this.check();
		const waitConfs = opts?.waitForConfirmations ?? 0;

		const txHashes: string[] = [];
		let nonce = await this.getPendingNonce();

		// Define all possible approvals
		const approvals = [
			{
				key: "USDC_ALLOWANCE_FOR_CTF",
				fn: () => usdc.approve(CTF_ADDRESS, constants.MaxUint256),
				label: "USDC→CTF",
			},
			{
				key: "USDC_ALLOWANCE_FOR_EXCHANGE",
				fn: () => usdc.approve(EXCHANGE_ADDRESS, constants.MaxUint256),
				label: "USDC→Exchange",
			},
			{
				key: "CTF_APPROVAL_FOR_EXCHANGE",
				fn: () => ctf.setApprovalForAll(EXCHANGE_ADDRESS, true),
				label: "CTF→Exchange",
			},
			{
				key: "USDC_ALLOWANCE_FOR_NEG_RISK_EXCHANGE",
				fn: () => usdc.approve(NEG_RISK_EXCHANGE_ADDRESS, constants.MaxUint256),
				label: "USDC→NegRiskExchange",
			},
			{
				key: "USDC_ALLOWANCE_FOR_NEG_RISK_ADAPTER",
				fn: () => usdc.approve(NEG_RISK_ADAPTER_ADDRESS, constants.MaxUint256),
				label: "USDC→NegRiskAdapter",
			},
			{
				key: "CTF_APPROVAL_FOR_NEG_RISK_EXCHANGE",
				fn: () => ctf.setApprovalForAll(NEG_RISK_EXCHANGE_ADDRESS, true),
				label: "CTF→NegRiskExchange",
			},
			{
				key: "CTF_APPROVAL_FOR_NEG_RISK_ADAPTER",
				fn: () => ctf.setApprovalForAll(NEG_RISK_ADAPTER_ADDRESS, true),
				label: "CTF→NegRiskAdapter",
			},
		] as const;

		// Execute only missing approvals
		for (const { key, fn, label } of approvals) {
			if (current.missing.includes(key)) {
				const hash = await this.sendTx(fn, nonce++, waitConfs);
				txHashes.push(hash);
				console.log(`Approved ${label}: ${hash}`);
			}
		}

		return {
			txHashes,
			message:
				txHashes.length === 0
					? "No transactions needed; required approvals are already in place."
					: waitConfs > 0
						? `${txHashes.length} approval(s) confirmed. Revocable anytime in your wallet.`
						: `${txHashes.length} approval(s) submitted. Monitor in your wallet.`,
			waitedConfirmations: waitConfs,
		};
	}
}

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
	// Use StaticJsonRpcProvider to completely skip network auto-detection
	const provider = new providers.StaticJsonRpcProvider(cfg.rpcUrl, cfg.chainId);
	return new Wallet(cfg.privateKey, provider);
}

export class ApprovalRequiredError extends Error {
	code = "APPROVAL_REQUIRED" as const;
	details: ApprovalCheck;

	constructor(details: ApprovalCheck) {
		super(
			[
				"Token approvals required before proceeding.",
				PolymarketApprovals.rationale(),
				"Use 'approve_allowances' tool to grant approvals.",
			].join("\n\n"),
		);
		this.name = "ApprovalRequiredError";
		this.details = details;
	}

	toJSON() {
		return {
			approvalRequired: true,
			code: this.code,
			message: this.message,
			details: this.details,
			nextStep: {
				tool: "approve_allowances",
				name: "Approve Allowances",
				description:
					"Grant USDC and CTF approvals for Polymarket (revocable anytime).",
			},
		};
	}
}

/**
 * Get USDC contract instance (following Polymarket SDK pattern)
 */
function getUsdcContract(wallet: Wallet): Contract {
	const USDC_ABI = [
		"function allowance(address owner, address spender) view returns (uint256)",
		"function approve(address spender, uint256 amount) returns (bool)",
	];
	return new Contract(POLYGON_ADDRESSES.USDC_ADDRESS, USDC_ABI, wallet);
}

/**
 * Get Conditional Tokens Framework (CTF) contract instance (following Polymarket SDK pattern)
 */
function getCtfContract(wallet: Wallet): Contract {
	const CTF_ABI = [
		"function isApprovedForAll(address owner, address operator) view returns (bool)",
		"function setApprovalForAll(address operator, bool approved)",
	];
	return new Contract(POLYGON_ADDRESSES.CTF_ADDRESS, CTF_ABI, wallet);
}
