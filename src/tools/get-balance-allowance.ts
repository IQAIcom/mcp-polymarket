import { AssetType } from "@polymarket/clob-client";
import { z } from "zod";
import { tradeApi } from "../services/trading.js";

export const GetBalanceAllowanceSchema = z.object({
	assetType: z
		.enum(["COLLATERAL", "CONDITIONAL"])
		.describe("Asset type to check balance for: COLLATERAL or CONDITIONAL"),
	tokenID: z
		.string()
		.optional()
		.describe("Optional token ID for conditional token balance"),
});

/**
 * Retrieves balance and allowance information for the authenticated account.
 */
export async function handleGetBalanceAllowance(
	args: z.infer<typeof GetBalanceAllowanceSchema>,
) {
	const params: { asset_type: AssetType; token_id?: string } = {
		asset_type: AssetType[args.assetType],
	};
	if (args.tokenID) params.token_id = args.tokenID;

	const result = await tradeApi.getBalanceAllowance(params);
	return JSON.stringify(result, null, 2);
}
