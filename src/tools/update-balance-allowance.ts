import { AssetType } from "@polymarket/clob-client";
import { z } from "zod";
import {
	getPortfolioService,
	initializeTradingServices,
} from "../services/index.js";

export const UpdateBalanceAllowanceSchema = z.object({
	assetType: z
		.enum(["COLLATERAL", "CONDITIONAL"])
		.describe("Asset type to update allowance for: COLLATERAL or CONDITIONAL"),
	tokenID: z
		.string()
		.optional()
		.describe("Optional token ID for conditional token"),
});

export async function handleUpdateBalanceAllowance(
	args: z.infer<typeof UpdateBalanceAllowanceSchema>,
) {
	await initializeTradingServices();

	const params: { asset_type: AssetType; token_id?: string } = {
		asset_type: AssetType[args.assetType],
	};
	if (args.tokenID) params.token_id = args.tokenID;

	await getPortfolioService().updateBalanceAllowance(params);
	return JSON.stringify(
		{ success: true, message: "Balance allowance updated successfully" },
		null,
		2,
	);
}
