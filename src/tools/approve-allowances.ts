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
					rationale: PolymarketApprovals.rationale(),
				},
				null,
				2,
			);
		}

		const result = await svc.approveAll({
			approveUsdcForCTF: args.approveUsdcForCTF,
			approveUsdcForExchange: args.approveUsdcForExchange,
			approveCtfForExchange: args.approveCtfForExchange,
		});

		const after = await svc.check();

		return JSON.stringify(
			{
				success: after.missing.length === 0,
				txHashes: result.txHashes,
				message: result.message,
				status: after,
				rationale: PolymarketApprovals.rationale(),
			},
			null,
			2,
		);
	},
};
