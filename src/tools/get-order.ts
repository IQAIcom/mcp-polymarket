import { z } from "zod";
import { tradeApi } from "../services/trading.js";

const getOrderSchema = z.object({
	orderId: z.string().describe("The unique identifier of the order"),
});

export const getOrderTool = {
	name: "get_order",
	description: "Get details of a specific order by its ID.",
	parameters: getOrderSchema,
	execute: async (args: z.infer<typeof getOrderSchema>) => {
		const result = await tradeApi.getOrder(args.orderId);
		return JSON.stringify(result, null, 2);
	},
};
