import { z } from "zod";
import { ApprovalRequiredError } from "../services/approvals.js";
import { tradeApi } from "../services/trading.js";

const cancelAllOrdersSchema = z.object({});

export const cancelAllOrdersTool = {
	name: "cancel_all_orders",
	description: "Cancel all open orders for the authenticated account.",
	parameters: cancelAllOrdersSchema,
	execute: async (_args: z.infer<typeof cancelAllOrdersSchema>) => {
		try {
			const result = await tradeApi.cancelAllOrders();
			return JSON.stringify(result, null, 2);
		} catch (err) {
			if (err instanceof ApprovalRequiredError) {
				return JSON.stringify(err, null, 2);
			}
			throw err;
		}
	},
};
