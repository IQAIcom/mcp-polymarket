import type { BigNumber } from "ethers";
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
 * Build viem clients using the same config used elsewhere in the SDK
 */
function getWalletFromEnv(): {
	signer: Wallet;
	provider: providers.JsonRpcProvider;
} {
	const cfg = getConfig();
	if (!cfg.privateKey) {
		throw new Error(
			"POLYMARKET_PRIVATE_KEY environment variable is required for approvals",
		);
	}
	const provider = new providers.JsonRpcProvider(cfg.rpcUrl);
	const signer = new Wallet(cfg.privateKey, provider);
	return { signer, provider };
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
	private provider: providers.JsonRpcProvider;
	private address: string;

	constructor(signerOrUnknown?: unknown) {
		if (signerOrUnknown && signerOrUnknown instanceof Wallet) {
			this.signer = signerOrUnknown;
			if (!signerOrUnknown.provider) {
				const cfg = getConfig();
				this.provider = new providers.JsonRpcProvider(cfg.rpcUrl);
				this.signer = signerOrUnknown.connect(this.provider);
			} else {
				this.provider = signerOrUnknown.provider as providers.JsonRpcProvider;
			}
		} else {
			const { signer, provider } = getWalletFromEnv();
			this.signer = signer;
			this.provider = provider;
		}
		this.address = this.signer.address;
	}

	/** Get the next pending nonce for this signer */
	private async getPendingNonce(): Promise<number> {
		const n = await this.provider.getTransactionCount(this.address, "pending");
		return n;
	}

	/**
	 * Build EIP-1559 fee overrides with a safe floor on Polygon.
	 * Applies a +20% bump over suggested values and enforces a minimum priority fee.
	 */
	private async buildFeeOverrides(minPriorityFeeGwei?: number): Promise<{
		maxFeePerGas?: BigNumber;
		maxPriorityFeePerGas?: BigNumber;
		gasPrice?: BigNumber;
	}> {
		try {
			const feeData = await this.provider.getFeeData();
			const envMinPriGwei = Number(
				process.env.POLYMARKET_MIN_PRIORITY_FEE_GWEI,
			);
			const minPriGwei = Number.isFinite(envMinPriGwei)
				? envMinPriGwei
				: (minPriorityFeeGwei ?? 30);
			const floorPri = utils.parseUnits(String(minPriGwei), 9);

			let maxPriority = feeData.maxPriorityFeePerGas || floorPri;
			// +20% bump
			maxPriority = maxPriority.mul(12).div(10);
			if (maxPriority.lt(floorPri)) maxPriority = floorPri;

			let maxFee = feeData.maxFeePerGas || maxPriority.mul(2);
			maxFee = maxFee.mul(12).div(10);
			if (maxFee.lt(maxPriority.mul(2))) {
				maxFee = maxPriority.mul(2);
			}

			return {
				maxFeePerGas: maxFee,
				maxPriorityFeePerGas: maxPriority,
			};
		} catch (_e) {
			// Legacy fallback
			try {
				const gasPrice = await this.provider.getGasPrice();
				return { gasPrice };
			} catch (_) {
				const gasPrice = utils.parseUnits("30", 9);
				return { gasPrice };
			}
		}
	}

	/**
	 * Broadcast a tx with explicit nonce, using a single retry on replacement/nonce errors.
	 * Returns the transaction hash (or confirmed receipt hash if waiting > 0).
	 */
	private async sendWithNonceAndRetry(
		send: (overrides: {
			nonce: number;
			maxFeePerGas?: BigNumber;
			maxPriorityFeePerGas?: BigNumber;
			gasPrice?: BigNumber;
		}) => Promise<string>,
		nextNonceRef: { value: number },
		waitConfs: number,
		feeOverrides: {
			maxFeePerGas?: BigNumber;
			maxPriorityFeePerGas?: BigNumber;
			gasPrice?: BigNumber;
		},
	): Promise<string> {
		const trySend = async () => {
			const txHash = await send({
				nonce: nextNonceRef.value,
				...feeOverrides,
			});
			return txHash;
		};

		try {
			const hash = await trySend();
			nextNonceRef.value += 1;
			if (waitConfs > 0) {
				await this.provider.waitForTransaction(hash, waitConfs);
			}
			return hash;
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
			const hash = await trySend();
			nextNonceRef.value += 1;
			if (waitConfs > 0) {
				await this.provider.waitForTransaction(hash, waitConfs);
			}
			return hash;
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

		const usdc = new Contract(USDC_ADDRESS, USDC_ABI, this.provider);
		const ctf = new Contract(CTF_ADDRESS, CTF_ABI, this.provider);

		const [usdcAllowanceCtf, usdcAllowanceExchange, ctfApprovedForExchange] =
			await Promise.all([
				usdc.allowance(this.address, CTF_ADDRESS) as Promise<BigNumber>,
				usdc.allowance(this.address, EXCHANGE_ADDRESS) as Promise<BigNumber>,
				ctf.isApprovedForAll(
					this.address,
					EXCHANGE_ADDRESS,
				) as Promise<boolean>,
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
			owner: this.address,
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
				async (overrides) => {
					const contract = new Contract(USDC_ADDRESS, USDC_ABI, this.signer);
					const tx = await contract.approve(CTF_ADDRESS, constants.MaxUint256, {
						nonce: overrides.nonce,
						maxFeePerGas: overrides.maxFeePerGas,
						maxPriorityFeePerGas: overrides.maxPriorityFeePerGas,
						gasPrice: overrides.gasPrice,
					});
					const receipt = await tx.wait(0);
					return receipt.transactionHash as string;
				},
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
				async (overrides) => {
					const contract = new Contract(USDC_ADDRESS, USDC_ABI, this.signer);
					const tx = await contract.approve(
						EXCHANGE_ADDRESS,
						constants.MaxUint256,
						{
							nonce: overrides.nonce,
							maxFeePerGas: overrides.maxFeePerGas,
							maxPriorityFeePerGas: overrides.maxPriorityFeePerGas,
							gasPrice: overrides.gasPrice,
						},
					);
					const receipt = await tx.wait(0);
					return receipt.transactionHash as string;
				},
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
				async (overrides) => {
					const contract = new Contract(CTF_ADDRESS, CTF_ABI, this.signer);
					const tx = await contract.setApprovalForAll(EXCHANGE_ADDRESS, true, {
						nonce: overrides.nonce,
						maxFeePerGas: overrides.maxFeePerGas,
						maxPriorityFeePerGas: overrides.maxPriorityFeePerGas,
						gasPrice: overrides.gasPrice,
					});
					const receipt = await tx.wait(0);
					return receipt.transactionHash as string;
				},
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
