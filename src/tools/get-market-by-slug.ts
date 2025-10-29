import { z } from "zod";
import { getMarketsInstance } from "../services/markets.js";

export const GetMarketBySlugSchema = z.object({
	slug: z
		.string()
		.describe("The market slug identifier (e.g., 'will-trump-win-2024')"),
});

export async function handleGetMarketBySlug(
	args: z.infer<typeof GetMarketBySlugSchema>,
) {
	const markets = getMarketsInstance();
	const data = await markets.getMarketBySlug(args.slug);
	return JSON.stringify(data, null, 2);
}
