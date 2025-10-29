import { z } from "zod";
import { getTradingInstance, initializeTrading } from "../services/trading.js";

export const CancelOrderSchema = z.object({
	orderId: z.string().describe("The unique identifier of the order to cancel"),
});

export async function handleCancelOrder(
	args: z.infer<typeof CancelOrderSchema>,
) {
	const trading = getTradingInstance();
	await initializeTrading();

	const result = await trading.cancelOrder(args.orderId);
	return JSON.stringify(result, null, 2);
}
