import { z } from "zod";
import { tradeApi } from "../services/trading.js";

export const GetOrderSchema = z.object({
	orderId: z.string().describe("The unique identifier of the order"),
});

/**
 * Retrieves details of a specific order by its ID.
 */
export async function handleGetOrder(args: z.infer<typeof GetOrderSchema>) {
	const result = await tradeApi.getOrder(args.orderId);
	return JSON.stringify(result, null, 2);
}
