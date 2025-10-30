import { z } from "zod";
import { tradeApi } from "../services/trading.js";

const getOpenOrdersSchema = z.object({
	market: z
		.string()
		.optional()
		.describe("Optional market address to filter orders by"),
});

export const getOpenOrdersTool = {
	name: "get_open_orders",
	description:
		"Get all open orders for the authenticated account. Can optionally filter by market.",
	parameters: getOpenOrdersSchema,
	execute: async (args: z.infer<typeof getOpenOrdersSchema>) => {
		const result = await tradeApi.getOpenOrders(
			args.market ? { market: args.market } : undefined,
		);
		return JSON.stringify(result, null, 2);
	},
};
