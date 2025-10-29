import { z } from "zod";
import { getTradingInstance, initializeTrading } from "../services/trading.js";

export const GetOrderSchema = z.object({
	orderId: z.string().describe("The unique identifier of the order"),
});

export async function handleGetOrder(args: z.infer<typeof GetOrderSchema>) {
	const trading = getTradingInstance();
	await initializeTrading();

	const result = await trading.getOrder(args.orderId);
	return JSON.stringify(result, null, 2);
}
