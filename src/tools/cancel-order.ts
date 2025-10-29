import { z } from "zod";
import {
	getOrderService,
	initializeTradingServices,
} from "../services/index.js";

export const CancelOrderSchema = z.object({
	orderId: z.string().describe("The unique identifier of the order to cancel"),
});

export async function handleCancelOrder(
	args: z.infer<typeof CancelOrderSchema>,
) {
	await initializeTradingServices();
	const result = await getOrderService().cancelOrder(args.orderId);
	return JSON.stringify(result, null, 2);
}
