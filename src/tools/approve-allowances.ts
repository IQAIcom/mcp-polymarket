import { z } from "zod";
import { PolymarketApprovals } from "../services/approvals.js";

const approveAllowancesSchema = z.object({
	waitForConfirmations: z
		.number()
		.int()
		.min(0)
		.max(5)
		.optional()
		.describe(
			"How many confirmations to wait before returning (0 = return immediately after broadcasting). Default: 0",
		),
});

export const approveAllowancesTool = {
	name: "approve_allowances",
	description:
		"Grant the USDC and Conditional Tokens approvals required to trade on Polymarket. Automatically approves only the contracts that don't already have approvals set. Includes both regular and NegRisk markets. These approvals are standard ERC20/ERC1155 approvals, revocable at any time in your wallet.",
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
			waitForConfirmations: args.waitForConfirmations ?? 0,
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
