import { z } from "zod";
import { getOrderService } from "../services/service-container.js";

export const CancelOrderSchema = z.object({
	orderId: z.string().describe("The unique identifier of the order to cancel"),
});

export async function handleCancelOrder(
	args: z.infer<typeof CancelOrderSchema>,
) {
	const orderService = await getOrderService();
	const result = await orderService.cancelOrder(args.orderId);
	return JSON.stringify(result, null, 2);
}
