import { z } from "zod";
import { getOrderService } from "../services/service-container.js";

export const PlaceMarketOrderSchema = z.object({
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
	amount: z
		.number()
		.positive()
		.describe("The amount to trade in USDC (for market orders)"),
	side: z.enum(["BUY", "SELL"]).describe("The side of the order: BUY or SELL"),
	orderType: z
		.enum(["FOK", "FAK"])
		.optional()
		.describe(
			"Order type: FOK (Fill or Kill) or FAK (Fill and Kill). Default: FOK",
		),
	tickSize: z
		.string()
		.optional()
		.describe("Tick size for the market (auto-detected if using marketSlug)"),
});

export async function handlePlaceMarketOrder(
	args: z.infer<typeof PlaceMarketOrderSchema>,
) {
	const orderService = await getOrderService();
	const result = await orderService.placeMarketOrder(args);
	return JSON.stringify(result, null, 2);
}
