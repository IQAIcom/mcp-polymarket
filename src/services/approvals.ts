import { Contract, constants, providers, utils, Wallet } from "ethers";
import { getConfig, POLYGON_ADDRESSES } from "./config.js";

// Minimal ABIs needed for approvals
const USDC_ABI = [
	"function allowance(address owner, address spender) view returns (uint256)",
	"function approve(address spender, uint256 amount) returns (bool)",
];

const CTF_ABI = [
	"function isApprovedForAll(address owner, address operator) view returns (bool)",
	"function setApprovalForAll(address operator, bool approved)",
];

export type ApprovalCheck = {
	usdcAllowanceForCTF: string;
	usdcAllowanceForExchange: string;
	ctfApprovedForExchange: boolean;
	// Add NegRisk allowances
	usdcAllowanceForNegRiskExchange: string;
	usdcAllowanceForNegRiskAdapter: string;
	ctfApprovedForNegRiskExchange: boolean;
	ctfApprovedForNegRiskAdapter: boolean;
	missing: Array<
		| "USDC_ALLOWANCE_FOR_CTF"
		| "USDC_ALLOWANCE_FOR_EXCHANGE"
		| "CTF_APPROVAL_FOR_EXCHANGE"
		| "USDC_ALLOWANCE_FOR_NEGRISK_EXCHANGE"
		| "USDC_ALLOWANCE_FOR_NEGRISK_ADAPTER"
		| "CTF_APPROVAL_FOR_NEGRISK_EXCHANGE"
		| "CTF_APPROVAL_FOR_NEGRISK_ADAPTER"
	>;
	addresses: typeof POLYGON_ADDRESSES & {
		NEGRISK_EXCHANGE: string;
		NEGRISK_ADAPTER: string;
	};
	owner: string;
	isProxyWallet: boolean;
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
			PolymarketApprovals.rationale(details.isProxyWallet),
			details.isProxyWallet
				? "⚠️  You are using a proxy wallet (Gnosis Safe). Approvals must be set through the Polymarket UI or Gnosis Safe interface."
				: "Use the 'approve_allowances' tool to grant approvals, then retry your action.",
		];
		super(msgLines.join("\n\n"));
		this.name = "ApprovalRequiredError";
		this.details = details;
		this.hint = PolymarketApprovals.rationale(details.isProxyWallet);
		this.nextStep = details.isProxyWallet
			? {
					tool: "polymarket_ui",
					name: "Set Approvals via Polymarket UI",
					description:
						"Visit Polymarket website to set allowances for your proxy wallet (cannot be done programmatically for Gnosis Safe).",
				}
			: {
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
	private funderAddress?: string;

	constructor(signer?: Wallet, funderAddress?: string) {
		this.signer = signer ?? getSignerFromEnv();
		this.funderAddress = funderAddress ?? getConfig().funderAddress;
	}

	/** Ensure we have a Provider */
	private getProvider(): providers.Provider {
		const provider = this.signer.provider;
		if (!provider) throw new Error("Signer provider is not available");
		return provider;
	}

	/**
	 * Get the address that actually holds funds and needs approvals.
	 * For proxy wallets (Gnosis Safe), this is the funder address.
	 * For EOA wallets, this is the signer address.
	 */
	private getOwnerAddress(): string {
		return this.funderAddress ?? this.signer.address;
	}

	/**
	 * Check if using a proxy wallet
	 */
	private isProxyWallet(): boolean {
		return !!this.funderAddress;
	}

	/** Get the next pending nonce for this signer */
	private async getPendingNonce(): Promise<number> {
		return this.signer.getTransactionCount("pending");
	}

	/**
	 * Build EIP-1559 fee overrides with a safe floor on Polygon.
	 * Applies a +20% bump over suggested values and enforces a minimum priority fee.
	 */
	private async buildFeeOverrides(minPriorityFeeGwei?: number): Promise<{
		maxFeePerGas: providers.TransactionRequest["maxFeePerGas"];
		maxPriorityFeePerGas: providers.TransactionRequest["maxPriorityFeePerGas"];
	}> {
		const provider = this.getProvider();
		const feeData = await provider.getFeeData();

		const envMinPriGwei = Number(process.env.POLYMARKET_MIN_PRIORITY_FEE_GWEI);
		const minPriGwei = Number.isFinite(envMinPriGwei)
			? envMinPriGwei
			: (minPriorityFeeGwei ?? 30); // default 30 gwei

		const floorPri = utils.parseUnits(String(minPriGwei), "gwei");

		const suggestedPri = feeData.maxPriorityFeePerGas
			? feeData.maxPriorityFeePerGas
					.mul(12)
					.div(10) // +20%
			: floorPri;

		const maxPriorityFeePerGas = suggestedPri.gte(floorPri)
			? suggestedPri
			: floorPri;

		const suggestedMaxFee = feeData.maxFeePerGas
			? feeData.maxFeePerGas
					.mul(12)
					.div(10) // +20%
			: undefined;

		const minMaxFee = maxPriorityFeePerGas.mul(2);

		const maxFeePerGas = suggestedMaxFee
			? suggestedMaxFee.gte(minMaxFee)
				? suggestedMaxFee
				: minMaxFee
			: minMaxFee;

		return { maxFeePerGas, maxPriorityFeePerGas };
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
		feeOverrides: Pick<
			providers.TransactionRequest,
			"maxFeePerGas" | "maxPriorityFeePerGas"
		>,
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

	static rationale(isProxyWallet: boolean): string {
		const a = POLYGON_ADDRESSES;

		const baseRationale = [
			"Trading on Polymarket requires granting limited permissions so the exchange can settle orders:",
			"- USDC allowances let the Conditional Tokens Framework (CTF) and the Exchange move your USDC to mint/redeem and settle trades.",
			"- CTF setApprovalForAll lets the Exchange move your position tokens during settlement.",
		];

		if (isProxyWallet) {
			baseRationale.push(
				"",
				"⚠️  PROXY WALLET DETECTED: You are using a Gnosis Safe proxy wallet.",
				"Approvals for proxy wallets CANNOT be set programmatically through this tool.",
				"You must set approvals through:",
				"  1. The Polymarket website (recommended - happens automatically on first deposit)",
				"  2. The Gnosis Safe interface directly",
			);
		} else {
			baseRationale.push(
				`Contracts: USDC=${a.USDC_ADDRESS}, CTF=${a.CTF_ADDRESS}, Exchange=${a.EXCHANGE_ADDRESS}`,
				"These are standard ERC20/ERC1155 approvals, set to MaxUint for fewer prompts, and can be revoked in your wallet at any time.",
			);
		}

		return baseRationale.join("\n");
	}

	/** Format an approval error into a response object. */
	static formatError(err: ApprovalRequiredError) {
		return err.toJSON();
	}

	/**
	 * Get contract addresses for the current chain
	 */
	private getContractAddresses() {
		const cfg = getConfig();
		const chainId = cfg.chainId ?? 137;

		// Import getContractConfig from the SDK
		const { getContractConfig } = require("./config.js");
		const contractConfig = getContractConfig(chainId);

		return {
			...POLYGON_ADDRESSES,
			NEGRISK_EXCHANGE: contractConfig.negRiskExchange,
			NEGRISK_ADAPTER: contractConfig.negRiskAdapter,
		};
	}

	/** Check current approval state for the owner address (proxy or EOA) */
	async check(): Promise<ApprovalCheck> {
		const addresses = this.getContractAddresses();
		const { USDC_ADDRESS, CTF_ADDRESS, EXCHANGE_ADDRESS } = POLYGON_ADDRESSES;

		const usdc = new Contract(USDC_ADDRESS, USDC_ABI, this.signer);
		const ctf = new Contract(CTF_ADDRESS, CTF_ABI, this.signer);

		const ownerAddress = this.getOwnerAddress();
		const isProxy = this.isProxyWallet();

		// Check both normal and NegRisk allowances
		const [
			usdcAllowanceCtf,
			usdcAllowanceExchange,
			ctfApprovedForExchange,
			usdcAllowanceNegRiskExchange,
			usdcAllowanceNegRiskAdapter,
			ctfApprovedForNegRiskExchange,
			ctfApprovedForNegRiskAdapter,
		] = await Promise.all([
			usdc.allowance(ownerAddress, CTF_ADDRESS),
			usdc.allowance(ownerAddress, EXCHANGE_ADDRESS),
			ctf.isApprovedForAll(ownerAddress, EXCHANGE_ADDRESS),
			usdc.allowance(ownerAddress, addresses.NEGRISK_EXCHANGE),
			usdc.allowance(ownerAddress, addresses.NEGRISK_ADAPTER),
			ctf.isApprovedForAll(ownerAddress, addresses.NEGRISK_EXCHANGE),
			ctf.isApprovedForAll(ownerAddress, addresses.NEGRISK_ADAPTER),
		]);

		const missing: ApprovalCheck["missing"] = [];

		// Check normal market approvals
		if (usdcAllowanceCtf.isZero()) missing.push("USDC_ALLOWANCE_FOR_CTF");
		if (usdcAllowanceExchange.isZero())
			missing.push("USDC_ALLOWANCE_FOR_EXCHANGE");
		if (!ctfApprovedForExchange) missing.push("CTF_APPROVAL_FOR_EXCHANGE");

		// Check NegRisk market approvals
		if (usdcAllowanceNegRiskExchange.isZero())
			missing.push("USDC_ALLOWANCE_FOR_NEGRISK_EXCHANGE");
		if (usdcAllowanceNegRiskAdapter.isZero())
			missing.push("USDC_ALLOWANCE_FOR_NEGRISK_ADAPTER");
		if (!ctfApprovedForNegRiskExchange)
			missing.push("CTF_APPROVAL_FOR_NEGRISK_EXCHANGE");
		if (!ctfApprovedForNegRiskAdapter)
			missing.push("CTF_APPROVAL_FOR_NEGRISK_ADAPTER");

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
			owner: ownerAddress,
			isProxyWallet: isProxy,
		};
	}

	/**
	 * Throw a structured error if approvals are missing.
	 * NOTE: For proxy wallets (Gnosis Safe), this will throw an error directing
	 * users to set approvals through the Polymarket UI, as they cannot be set
	 * programmatically.
	 */
	async assertApproved(): Promise<void> {
		const status = await this.check();

		if (status.missing.length > 0) {
			// If using proxy wallet, provide special guidance
			if (status.isProxyWallet) {
				console.warn("⚠️  Proxy wallet detected with missing approvals.");
				console.warn("   Owner:", status.owner);
				console.warn("   Missing approvals:", status.missing);
				console.warn(
					"   Approvals for Gnosis Safe proxies must be set via Polymarket UI.",
				);

				// Still throw, but with proxy-specific guidance
				throw new ApprovalRequiredError(status);
			}

			throw new ApprovalRequiredError(status);
		}
	}

	/**
	 * Execute approvals. By default approves all required allowances with MaxUint256.
	 * NOTE: This only works for EOA wallets. For proxy wallets (Gnosis Safe),
	 * approvals must be set through the Polymarket UI or Gnosis Safe interface.
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
		minPriorityFeeGwei?: number;
		force?: boolean;
	}): Promise<{
		txHashes: string[];
		message: string;
		waitedConfirmations: number;
	}> {
		// Check if using proxy wallet
		if (this.isProxyWallet()) {
			throw new Error(
				"Cannot set approvals programmatically for proxy wallets (Gnosis Safe). " +
					"Please set approvals through the Polymarket website or Gnosis Safe interface.",
			);
		}

		const addresses = this.getContractAddresses();
		const { USDC_ADDRESS, CTF_ADDRESS, EXCHANGE_ADDRESS } = POLYGON_ADDRESSES;

		const usdc = new Contract(USDC_ADDRESS, USDC_ABI, this.signer);
		const ctf = new Contract(CTF_ADDRESS, CTF_ABI, this.signer);

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
		const feeOverrides = await this.buildFeeOverrides(opts?.minPriorityFeeGwei);
		const nextNonceRef = { value: await this.getPendingNonce() };

		let actions = 0;

		// Normal market approvals
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
		}

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
		}

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
		}

		// NegRisk market approvals
		if (
			selections.approveUsdcForNegRiskExchange &&
			(opts?.force ||
				current.missing.includes("USDC_ALLOWANCE_FOR_NEGRISK_EXCHANGE"))
		) {
			const h = await this.sendWithNonceAndRetry(
				(overrides) =>
					usdc.approve(
						addresses.NEGRISK_EXCHANGE,
						constants.MaxUint256,
						overrides,
					),
				nextNonceRef,
				waitConfs,
				feeOverrides,
			);
			txHashes.push(h);
			actions++;
		}

		if (
			selections.approveUsdcForNegRiskAdapter &&
			(opts?.force ||
				current.missing.includes("USDC_ALLOWANCE_FOR_NEGRISK_ADAPTER"))
		) {
			const h = await this.sendWithNonceAndRetry(
				(overrides) =>
					usdc.approve(
						addresses.NEGRISK_ADAPTER,
						constants.MaxUint256,
						overrides,
					),
				nextNonceRef,
				waitConfs,
				feeOverrides,
			);
			txHashes.push(h);
			actions++;
		}

		if (
			selections.approveCtfForNegRiskExchange &&
			(opts?.force ||
				current.missing.includes("CTF_APPROVAL_FOR_NEGRISK_EXCHANGE"))
		) {
			const h = await this.sendWithNonceAndRetry(
				(overrides) =>
					ctf.setApprovalForAll(addresses.NEGRISK_EXCHANGE, true, overrides),
				nextNonceRef,
				waitConfs,
				feeOverrides,
			);
			txHashes.push(h);
			actions++;
		}

		if (
			selections.approveCtfForNegRiskAdapter &&
			(opts?.force ||
				current.missing.includes("CTF_APPROVAL_FOR_NEGRISK_ADAPTER"))
		) {
			const h = await this.sendWithNonceAndRetry(
				(overrides) =>
					ctf.setApprovalForAll(addresses.NEGRISK_ADAPTER, true, overrides),
				nextNonceRef,
				waitConfs,
				feeOverrides,
			);
			txHashes.push(h);
			actions++;
		}

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
