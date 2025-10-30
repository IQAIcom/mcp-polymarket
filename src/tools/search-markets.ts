import { z } from "zod";
import { api } from "../services/api.js";

const searchMarketsSchema = z.object({
	query: z.string().describe("Search query text"),
});

export const searchMarketsTool = {
	name: "search_markets",
	description: "Search for markets, events, and profiles using text search.",
	parameters: searchMarketsSchema,
	execute: async (args: z.infer<typeof searchMarketsSchema>) => {
		const data = await api.searchMarkets(args.query);
		return JSON.stringify(data, null, 2);
	},
};
