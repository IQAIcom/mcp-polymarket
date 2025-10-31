import { AssetType } from "@dschz/polymarket-clob-client";
import { z } from "zod";
import { ApprovalRequiredError } from "../services/approvals.js";
import { tradeApi } from "../services/trading.js";

const getBalanceAllowanceSchema = z.object({
	assetType: z
		.enum(["COLLATERAL", "CONDITIONAL"])
		.describe("Asset type to check balance for: COLLATERAL or CONDITIONAL"),
	tokenID: z
		.string()
		.optional()
		.describe("Optional token ID for conditional token balance"),
});

export const getBalanceAllowanceTool = {
	name: "get_balance_allowance",
	description:
		"Get balance and allowance information for the authenticated account. Can check COLLATERAL or CONDITIONAL tokens.",
	parameters: getBalanceAllowanceSchema,
	execute: async (args: z.infer<typeof getBalanceAllowanceSchema>) => {
		const params: { asset_type: AssetType; token_id?: string } = {
			asset_type: AssetType[args.assetType],
		};
		if (args.tokenID) params.token_id = args.tokenID;

		try {
			const result = await tradeApi.getBalanceAllowance(params);
			return JSON.stringify(result, null, 2);
		} catch (err) {
			if (err instanceof ApprovalRequiredError) {
				return JSON.stringify(err, null, 2);
			}
			throw err;
		}
	},
};
