import { z } from "zod";
import { tradeApi } from "../services/trading.js";

const cancelOrderSchema = z.object({
	orderId: z.string().describe("The unique identifier of the order to cancel"),
});

export const cancelOrderTool = {
	name: "cancel_order",
	description: "Cancel a specific order by its ID.",
	parameters: cancelOrderSchema,
	execute: async (args: z.infer<typeof cancelOrderSchema>) => {
		const result = await tradeApi.cancelOrder(args.orderId);
		return JSON.stringify(result, null, 2);
	},
};
