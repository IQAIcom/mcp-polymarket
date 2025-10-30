import { z } from "zod";
import { tradeApi } from "../services/trading.js";

const cancelAllOrdersSchema = z.object({});

export const cancelAllOrdersTool = {
	name: "cancel_all_orders",
	description: "Cancel all open orders for the authenticated account.",
	parameters: cancelAllOrdersSchema,
	execute: async (_args: z.infer<typeof cancelAllOrdersSchema>) => {
		const result = await tradeApi.cancelAllOrders();
		return JSON.stringify(result, null, 2);
	},
};
