import { z } from "zod";
import { getOrderService } from "../services/service-container.js";

export const GetOrderSchema = z.object({
	orderId: z.string().describe("The unique identifier of the order"),
});

export async function handleGetOrder(args: z.infer<typeof GetOrderSchema>) {
	const orderService = await getOrderService();
	const result = await orderService.getOrder(args.orderId);
	return JSON.stringify(result, null, 2);
}
