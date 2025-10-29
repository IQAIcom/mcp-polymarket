import { z } from "zod";
import {
	getOrderService,
	initializeTradingServices,
} from "../services/index.js";

export const GetOpenOrdersSchema = z.object({
	market: z
		.string()
		.optional()
		.describe("Optional market address to filter orders by"),
});

export async function handleGetOpenOrders(
	args: z.infer<typeof GetOpenOrdersSchema>,
) {
	await initializeTradingServices();
	const result = await getOrderService().getOpenOrders(
		args.market ? { market: args.market } : undefined,
	);
	return JSON.stringify(result, null, 2);
}
