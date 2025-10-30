import { z } from "zod";
import { tradeApi } from "../services/trading.js";

const getTradeHistorySchema = z.object({
	market: z
		.string()
		.optional()
		.describe("Optional market address to filter trades by"),
	maker_address: z
		.string()
		.optional()
		.describe("Optional maker address to filter trades by"),
});

export const getTradeHistoryTool = {
	name: "get_trade_history",
	description:
		"Get trade history for the authenticated account. Can optionally filter by market or maker address.",
	parameters: getTradeHistorySchema,
	execute: async (args: z.infer<typeof getTradeHistorySchema>) => {
		const params: Record<string, string> = {};
		if (args.market) params.market = args.market;
		if (args.maker_address) params.maker_address = args.maker_address;

		const result = await tradeApi.getTradeHistory(
			Object.keys(params).length > 0 ? params : undefined,
		);
		return JSON.stringify(result, null, 2);
	},
};
