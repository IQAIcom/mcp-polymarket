import { z } from "zod";
import { getTradingInstance, initializeTrading } from "../services/trading.js";

export const CancelAllOrdersSchema = z.object({});

export async function handleCancelAllOrders(
	_args: z.infer<typeof CancelAllOrdersSchema>,
) {
	const trading = getTradingInstance();
	await initializeTrading();

	const result = await trading.cancelAllOrders();
	return JSON.stringify(result, null, 2);
}
