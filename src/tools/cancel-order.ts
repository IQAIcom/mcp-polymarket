import { z } from "zod";
import { tradeApi } from "../services/trading.js";

export const CancelOrderSchema = z.object({
	orderId: z.string().describe("The unique identifier of the order to cancel"),
});

/**
 * Cancels a specific order by its ID.
 */
export async function handleCancelOrder(
	args: z.infer<typeof CancelOrderSchema>,
) {
	const result = await tradeApi.cancelOrder(args.orderId);
	return JSON.stringify(result, null, 2);
}
