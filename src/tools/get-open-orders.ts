import { z } from "zod";
import { tradeApi } from "../services/trading.js";

export const GetOpenOrdersSchema = z.object({
	market: z
		.string()
		.optional()
		.describe("Optional market address to filter orders by"),
});

/**
 * Retrieves all open orders for the authenticated account.
 */
export async function handleGetOpenOrders(
	args: z.infer<typeof GetOpenOrdersSchema>,
) {
	const result = await tradeApi.getOpenOrders(
		args.market ? { market: args.market } : undefined,
	);
	return JSON.stringify(result, null, 2);
}
