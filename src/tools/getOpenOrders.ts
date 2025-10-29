import { z } from "zod";
import { getTradingInstance, initializeTrading } from "../services/trading.js";

export const GetOpenOrdersSchema = z.object({
	market: z
		.string()
		.optional()
		.describe("Optional market address to filter orders by"),
});

export async function handleGetOpenOrders(
	args: z.infer<typeof GetOpenOrdersSchema>,
) {
	const trading = getTradingInstance();
	await initializeTrading();

	const result = await trading.getOpenOrders(
		args.market ? { market: args.market } : undefined,
	);
	return JSON.stringify(result, null, 2);
}
