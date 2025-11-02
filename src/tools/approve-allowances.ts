import { z } from "zod";
import { PolymarketApprovals } from "../services/approvals.js";

const approveAllowancesSchema = z.object({
	approveUsdcForCTF: z
		.boolean()
		.optional()
		.describe(
			"Approve USDC allowance for the Conditional Tokens Framework (default: true)",
		),
	approveUsdcForExchange: z
		.boolean()
		.optional()
		.describe(
			"Approve USDC allowance for the Polymarket Exchange (default: true)",
		),
	approveCtfForExchange: z
		.boolean()
		.optional()
		.describe(
			"SetApprovalForAll on CTF tokens for the Exchange (default: true)",
		),
	waitForConfirmations: z
		.number()
		.int()
		.min(0)
		.max(5)
		.optional()
		.describe(
			"How many confirmations to wait before returning (0 = return immediately after broadcasting). Default: 0",
		),
	minPriorityFeeGwei: z
		.number()
		.int()
		.min(1)
		.max(500)
		.optional()
		.describe(
			"Minimum priority fee (tip cap) in gwei to use when sending approvals. Default: 30 gwei",
		),
	force: z
		.boolean()
		.optional()
		.describe(
			"Force sending approval transactions even if already approved (default: false)",
		),
});

export const approveAllowancesTool = {
	name: "approve_allowances",
	description:
		"Grant the USDC and Conditional Tokens approvals required to trade on Polymarket. These approvals are standard, revocable at any time in your wallet.",
	parameters: approveAllowancesSchema,
	execute: async (args: z.infer<typeof approveAllowancesSchema>) => {
		const svc = new PolymarketApprovals();
		const before = await svc.check();
		if (before.missing.length === 0) {
			return JSON.stringify(
				{
					alreadyApproved: true,
					message: "All required approvals are already in place.",
					status: before,
					rationale: PolymarketApprovals.rationale(true),
				},
				null,
				2,
			);
		}

		const result = await svc.approveAll({
			approveUsdcForCTF: args.approveUsdcForCTF,
			approveUsdcForExchange: args.approveUsdcForExchange,
			approveCtfForExchange: args.approveCtfForExchange,
			waitForConfirmations: args.waitForConfirmations ?? 0,
			minPriorityFeeGwei: args.minPriorityFeeGwei,
			force: args.force ?? false,
		});

		const after = await svc.check();

		return JSON.stringify(
			{
				success: after.missing.length === 0,
				txHashes: result.txHashes,
				message: result.message,
				status: after,
				rationale: PolymarketApprovals.rationale(true),
			},
			null,
			2,
		);
	},
};
