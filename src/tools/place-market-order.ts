import { z } from "zod";
import { ApprovalRequiredError } from "../services/approvals.js";
import { tradeApi } from "../services/trading.js";

const placeMarketOrderSchema = z.object({
	tokenId: z.string().describe("The token ID of the market outcome to trade"),
	amount: z
		.number()
		.positive()
		.describe(
			"BUY orders: Dollar amount ($) to spend. SELL orders: Number of shares to sell. Minimum $1 for BUY orders.",
		),
	side: z.enum(["BUY", "SELL"]).describe("The side of the order: BUY or SELL"),
	orderType: z
		.enum(["FOK", "FAK"])
		.optional()
		.describe(
			"Order type: FOK (Fill or Kill) or FAK (Fill and Kill). Default: FOK",
		),
});

export const placeMarketOrderTool = {
	name: "place_market_order",
	description:
		"Place a market order that executes immediately at current market price. IMPORTANT: For BUY orders, amount is the dollar amount ($USD) you want to spend. For SELL orders, amount is the number of shares to sell. Example: amount=5, side=BUY means 'spend $5 to buy shares at market price'. Minimum $1 for BUY orders.",
	parameters: placeMarketOrderSchema,
	execute: async (args: z.infer<typeof placeMarketOrderSchema>) => {
		try {
			const result = await tradeApi.placeMarketOrder({
				tokenId: args.tokenId,
				amount: args.amount,
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
