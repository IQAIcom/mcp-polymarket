import { z } from "zod";
import {
	getOrderService,
	initializeTradingServices,
} from "../services/index.js";

export const PlaceOrderSchema = z.object({
	marketSlug: z
		.string()
		.optional()
		.describe(
			"Market slug from URL (e.g., 'will-trump-win-2024'). Either marketSlug+outcome OR tokenId must be provided",
		),
	outcome: z
		.enum(["YES", "NO"])
		.optional()
		.describe(
			"Market outcome to bet on - YES or NO (required if using marketSlug)",
		),
	tokenId: z
		.string()
		.optional()
		.describe(
			"Direct token ID for the market outcome (alternative to marketSlug+outcome)",
		),
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
	tickSize: z
		.string()
		.optional()
		.describe("Tick size for the market (auto-detected if using marketSlug)"),
});

export async function handlePlaceOrder(args: z.infer<typeof PlaceOrderSchema>) {
	await initializeTradingServices();
	const result = await getOrderService().placeOrder(args);
	return JSON.stringify(result, null, 2);
}
