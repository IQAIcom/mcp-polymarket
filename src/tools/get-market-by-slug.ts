import { z } from "zod";
import { api } from "../services/api.js";

const getMarketBySlugSchema = z.object({
	slug: z
		.string()
		.describe("The market slug identifier (e.g., 'will-trump-win-2024')"),
});

export const getMarketBySlugTool = {
	name: "get_market_by_slug",
	description:
		"Get detailed information about a specific market by its slug identifier. The slug can be extracted from the Polymarket URL.",
	parameters: getMarketBySlugSchema,
	execute: async (args: z.infer<typeof getMarketBySlugSchema>) => {
		const data = await api.getMarketBySlug(args.slug);
		return JSON.stringify(data, null, 2);
	},
};
