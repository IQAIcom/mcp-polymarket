import { z } from "zod";
import { tradeApi } from "../services/trading.js";
import { withApprovalGuard } from "../util/with-approval-guard.js";

const cancelOrderSchema = z.object({
	orderId: z.string().describe("The unique identifier of the order to cancel"),
});

export const cancelOrderTool = {
	name: "cancel_order",
	description: "Cancel a specific order by its ID.",
	parameters: cancelOrderSchema,
	execute: async (args: z.infer<typeof cancelOrderSchema>) =>
		withApprovalGuard(() => tradeApi.cancelOrder(args.orderId)),
};
