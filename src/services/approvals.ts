import { Contract, constants, providers, Wallet } from "ethers";
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

	/** Execute approvals. By default approves all required allowances with MaxUint256 */
	async approveAll(opts?: {
		approveUsdcForCTF?: boolean;
		approveUsdcForExchange?: boolean;
		approveCtfForExchange?: boolean;
	}): Promise<{ txHashes: string[]; message: string }> {
		const { USDC_ADDRESS, CTF_ADDRESS, EXCHANGE_ADDRESS } = POLYGON_ADDRESSES;

		const usdc = new Contract(USDC_ADDRESS, USDC_ABI, this.signer);
		const ctf = new Contract(CTF_ADDRESS, CTF_ABI, this.signer);

		const selections = {
			approveUsdcForCTF: opts?.approveUsdcForCTF ?? true,
			approveUsdcForExchange: opts?.approveUsdcForExchange ?? true,
			approveCtfForExchange: opts?.approveCtfForExchange ?? true,
		};

		const txHashes: string[] = [];

		if (selections.approveUsdcForCTF) {
			const tx = await usdc.approve(CTF_ADDRESS, constants.MaxUint256);
			const receipt = await tx.wait();
			txHashes.push(receipt.transactionHash);
		}

		if (selections.approveUsdcForExchange) {
			const tx = await usdc.approve(EXCHANGE_ADDRESS, constants.MaxUint256);
			const receipt = await tx.wait();
			txHashes.push(receipt.transactionHash);
		}

		if (selections.approveCtfForExchange) {
			const tx = await ctf.setApprovalForAll(EXCHANGE_ADDRESS, true);
			const receipt = await tx.wait();
			txHashes.push(receipt.transactionHash);
		}

		return {
			txHashes,
			message:
				"Approvals completed. You can revoke or adjust allowances at any time using your wallet.",
		};
	}
}
