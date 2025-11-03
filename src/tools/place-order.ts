import { z } from "zod";
import { ApprovalRequiredError } from "../services/approvals.js";
import { tradeApi } from "../services/trading.js";

const placeOrderSchema = z.object({
	tokenId: z.string().describe("The token ID of the market outcome to trade"),
	price: z
		.number()
		.min(0)
		.max(1)
		.describe(
			"The limit price for the order (between 0 and 1). This is the probability/price per share.",
		),
	size: z
		.number()
		.positive()
		.describe(
			"Number of shares to trade. For both BUY and SELL orders, this is always the number of outcome tokens/shares.",
		),
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
		"Place a limit order on Polymarket at a specific price. Specify the number of shares (size) and price (0-1). For both BUY and SELL, you specify the number of shares you want to trade. Example: size=10, price=0.6 means buy/sell 10 shares at $0.60 per share (total: $6).",
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
