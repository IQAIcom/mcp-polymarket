import { z } from "zod";
import { getOrderService } from "../services/index.js";

export const CancelAllOrdersSchema = z.object({});

export async function handleCancelAllOrders(
	_args: z.infer<typeof CancelAllOrdersSchema>,
) {
	const orderService = await getOrderService();
	const result = await orderService.cancelAllOrders();
	return JSON.stringify(result, null, 2);
}
