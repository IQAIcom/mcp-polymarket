import { AssetType } from "@polymarket/clob-client";
import { z } from "zod";
import { getPortfolioService } from "../services/index.js";

export const GetBalanceAllowanceSchema = z.object({
	assetType: z
		.enum(["COLLATERAL", "CONDITIONAL"])
		.describe("Asset type to check balance for: COLLATERAL or CONDITIONAL"),
	tokenID: z
		.string()
		.optional()
		.describe("Optional token ID for conditional token balance"),
});

export async function handleGetBalanceAllowance(
	args: z.infer<typeof GetBalanceAllowanceSchema>,
) {
	const params: { asset_type: AssetType; token_id?: string } = {
		asset_type: AssetType[args.assetType],
	};
	if (args.tokenID) params.token_id = args.tokenID;

	const portfolioService = await getPortfolioService();
	const result = await portfolioService.getBalanceAllowance(params);
	return JSON.stringify(result, null, 2);
}
