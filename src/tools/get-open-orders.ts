import { z } from "zod";
import { getOrderService } from "../services/index.js";

export const GetOpenOrdersSchema = z.object({
	market: z
		.string()
		.optional()
		.describe("Optional market address to filter orders by"),
});

export async function handleGetOpenOrders(
	args: z.infer<typeof GetOpenOrdersSchema>,
) {
	const orderService = await getOrderService();
	const result = await orderService.getOpenOrders(
		args.market ? { market: args.market } : undefined,
	);
	return JSON.stringify(result, null, 2);
}
