import { z } from "zod";
import { ApprovalRequiredError } from "../services/approvals.js";
import { tradeApi } from "../services/trading.js";

const cancelOrderSchema = z.object({
	orderId: z.string().describe("The unique identifier of the order to cancel"),
});

export const cancelOrderTool = {
	name: "cancel_order",
	description: "Cancel a specific order by its ID.",
	parameters: cancelOrderSchema,
	execute: async (args: z.infer<typeof cancelOrderSchema>) => {
		try {
			const result = await tradeApi.cancelOrder(args.orderId);
			return JSON.stringify(result, null, 2);
		} catch (err) {
			if (err instanceof ApprovalRequiredError) {
				return JSON.stringify(err, null, 2);
			}
			throw err;
		}
	},
};
