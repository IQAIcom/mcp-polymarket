import { z } from "zod";
import { ApprovalRequiredError } from "../services/approvals.js";
import { tradeApi } from "../services/trading.js";

const placeOrderSchema = z.object({
	tokenId: z.string().describe("The token ID of the market outcome to trade"),
	price: z
		.number()
		.min(0)
		.max(1)
		.describe("The limit price for the order (between 0 and 1)"),
	size: z
		.number()
		.positive()
		.describe("The size/amount of the order in contract units"),
	side: z.enum(["BUY", "SELL"]).describe("The side of the order: BUY or SELL"),
	orderType: z
		.enum(["GTC", "GTD"])
		.optional()
		.describe(
			"Order type: GTC (Good Till Cancelled) or GTD (Good Till Date). Default: GTC",
		),
});

export const placeOrderTool = {
	name: "place_order",
	description:
		"Place a limit order on Polymarket. Places a buy or sell order at a specific price.",
	parameters: placeOrderSchema,
	execute: async (args: z.infer<typeof placeOrderSchema>) => {
		try {
			const result = await tradeApi.placeOrder({
				tokenId: args.tokenId,
				price: args.price,
				size: args.size,
				side: args.side,
				...(args.orderType && { orderType: args.orderType }),
			});
			return JSON.stringify(result, null, 2);
		} catch (err) {
			if (err instanceof ApprovalRequiredError) {
				return JSON.stringify(err, null, 2);
			}
			throw err;
		}
	},
};
