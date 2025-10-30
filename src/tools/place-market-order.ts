import { z } from "zod";
import { tradeApi } from "../services/trading.js";

export const PlaceMarketOrderSchema = z.object({
	tokenId: z.string().describe("The token ID of the market outcome to trade"),
	amount: z
		.number()
		.positive()
		.describe("The amount to trade in contract units"),
	side: z.enum(["BUY", "SELL"]).describe("The side of the order: BUY or SELL"),
	orderType: z
		.enum(["FOK", "FAK"])
		.optional()
		.describe(
			"Order type: FOK (Fill or Kill) or FAK (Fill and Kill). Default: FOK",
		),
});

/**
 * Places a market order (FOK or FAK) on Polymarket.
 */
export async function handlePlaceMarketOrder(
	args: z.infer<typeof PlaceMarketOrderSchema>,
) {
	const result = await tradeApi.placeMarketOrder({
		tokenId: args.tokenId,
		amount: args.amount,
		side: args.side,
		...(args.orderType && { orderType: args.orderType }),
	});
	return JSON.stringify(result, null, 2);
}
