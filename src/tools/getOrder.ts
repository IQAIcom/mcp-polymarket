import { z } from "zod";
import {
	getOrderService,
	initializeTradingServices,
} from "../services/index.js";

export const GetOrderSchema = z.object({
	orderId: z.string().describe("The unique identifier of the order"),
});

export async function handleGetOrder(args: z.infer<typeof GetOrderSchema>) {
	await initializeTradingServices();
	const result = await getOrderService().getOrder(args.orderId);
	return JSON.stringify(result, null, 2);
}
