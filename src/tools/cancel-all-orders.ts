import { z } from "zod";
import { tradeApi } from "../services/trading.js";

export const CancelAllOrdersSchema = z.object({});

/**
 * Cancels all open orders for the authenticated account.
 */
export async function handleCancelAllOrders(
	_args: z.infer<typeof CancelAllOrdersSchema>,
) {
	const result = await tradeApi.cancelAllOrders();
	return JSON.stringify(result, null, 2);
}
