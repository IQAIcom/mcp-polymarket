import { z } from "zod";
import {
	getOrderService,
	initializeTradingServices,
} from "../services/index.js";

export const CancelAllOrdersSchema = z.object({});

export async function handleCancelAllOrders(
	_args: z.infer<typeof CancelAllOrdersSchema>,
) {
	await initializeTradingServices();
	const result = await getOrderService().cancelAllOrders();
	return JSON.stringify(result, null, 2);
}
