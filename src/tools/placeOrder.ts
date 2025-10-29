import { z } from "zod";
import { getTradingInstance, initializeTrading } from "../services/trading.js";

export const PlaceOrderSchema = z.object({
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

export async function handlePlaceOrder(args: z.infer<typeof PlaceOrderSchema>) {
	const trading = getTradingInstance();
	await initializeTrading();

	const result = await trading.placeOrder({
		tokenId: args.tokenId,
		price: args.price,
		size: args.size,
		side: args.side,
		...(args.orderType && { orderType: args.orderType }),
	});
	return JSON.stringify(result, null, 2);
}
