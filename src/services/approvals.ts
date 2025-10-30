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
	usdcAllowanceForCTF: string; // as string to avoid BigNumber JSON issues
	usdcAllowanceForExchange: string;
	ctfApprovedForExchange: boolean;
	missing: Array<
		| "USDC_ALLOWANCE_FOR_CTF"
		| "USDC_ALLOWANCE_FOR_EXCHANGE"
		| "CTF_APPROVAL_FOR_EXCHANGE"
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

	/** Ensure we have a Provider */
	private getProvider(): providers.Provider {
		const provider = this.signer.provider;
		if (!provider) throw new Error("Signer provider is not available");
		return provider;
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

	static rationale(): string {
		const a = POLYGON_ADDRESSES;
		return [
			"Trading on Polymarket requires granting limited permissions so the exchange can settle orders:",
			"- USDC allowances let the Conditional Tokens Framework (CTF) and the Exchange move your USDC to mint/redeem and settle trades.",
			"- CTF setApprovalForAll lets the Exchange move your position tokens during settlement.",
			`Contracts: USDC=${a.USDC_ADDRESS}, CTF=${a.CTF_ADDRESS}, Exchange=${a.EXCHANGE_ADDRESS}`,
			"These are standard ERC20/ERC1155 approvals, set to MaxUint for fewer prompts, and can be revoked in your wallet at any time.",
		].join("\n");
	}

	/** Format an approval error into a response object. */
	static formatError(err: ApprovalRequiredError) {
		return err.toJSON();
	}

	/** Check current approval state for the connected account */
	async check(): Promise<ApprovalCheck> {
		const { USDC_ADDRESS, CTF_ADDRESS, EXCHANGE_ADDRESS } = POLYGON_ADDRESSES;

		const usdc = new Contract(USDC_ADDRESS, USDC_ABI, this.signer);
		const ctf = new Contract(CTF_ADDRESS, CTF_ABI, this.signer);

		const [usdcAllowanceCtf, usdcAllowanceExchange, ctfApprovedForExchange] =
			await Promise.all([
				usdc.allowance(this.signer.address, CTF_ADDRESS),
				usdc.allowance(this.signer.address, EXCHANGE_ADDRESS),
				ctf.isApprovedForAll(this.signer.address, EXCHANGE_ADDRESS),
			]);

		const missing: ApprovalCheck["missing"] = [];
		if (usdcAllowanceCtf.isZero()) missing.push("USDC_ALLOWANCE_FOR_CTF");
		if (usdcAllowanceExchange.isZero())
			missing.push("USDC_ALLOWANCE_FOR_EXCHANGE");
		if (!ctfApprovedForExchange) missing.push("CTF_APPROVAL_FOR_EXCHANGE");

		return {
			usdcAllowanceForCTF: usdcAllowanceCtf.toString(),
			usdcAllowanceForExchange: usdcAllowanceExchange.toString(),
			ctfApprovedForExchange,
			missing,
			addresses: POLYGON_ADDRESSES,
			owner: this.signer.address,
		};
	}

	/** Throw a structured error if approvals are missing */
	async assertApproved(): Promise<void> {
		const status = await this.check();
		if (status.missing.length > 0) {
			throw new ApprovalRequiredError(status);
		}
	}

	/** Execute approvals. By default approves all required allowances with MaxUint256.
	 * Use waitForConfirmations=0 (default) to return immediately after broadcasting txs.
	 */
	async approveAll(opts?: {
		approveUsdcForCTF?: boolean;
		approveUsdcForExchange?: boolean;
		approveCtfForExchange?: boolean;
		waitForConfirmations?: number; // 0 to just return tx hashes without waiting
		minPriorityFeeGwei?: number; // optional floor override
		force?: boolean; // if true, send txs even if already approved
	}): Promise<{
		txHashes: string[];
		message: string;
		waitedConfirmations: number;
	}> {
		const { USDC_ADDRESS, CTF_ADDRESS, EXCHANGE_ADDRESS } = POLYGON_ADDRESSES;

		const usdc = new Contract(USDC_ADDRESS, USDC_ABI, this.signer);
		const ctf = new Contract(CTF_ADDRESS, CTF_ABI, this.signer);

		// Determine which approvals are missing to avoid redundant transactions
		const current = await this.check();
		const missingUsdcForCTF = current.missing.includes(
			"USDC_ALLOWANCE_FOR_CTF",
		);
		const missingUsdcForExchange = current.missing.includes(
			"USDC_ALLOWANCE_FOR_EXCHANGE",
		);
		const missingCtfForExchange = current.missing.includes(
			"CTF_APPROVAL_FOR_EXCHANGE",
		);

		const selections = {
			approveUsdcForCTF: opts?.approveUsdcForCTF ?? true,
			approveUsdcForExchange: opts?.approveUsdcForExchange ?? true,
			approveCtfForExchange: opts?.approveCtfForExchange ?? true,
		};

		const txHashes: string[] = [];
		const waitConfs = Math.max(0, opts?.waitForConfirmations ?? 0);
		const feeOverrides = await this.buildFeeOverrides(opts?.minPriorityFeeGwei);
		const nextNonceRef = { value: await this.getPendingNonce() };

		let actions = 0;
		if (selections.approveUsdcForCTF && (opts?.force || missingUsdcForCTF)) {
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
			(opts?.force || missingUsdcForExchange)
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
			(opts?.force || missingCtfForExchange)
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
