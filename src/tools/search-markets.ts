import { z } from "zod";
import { api } from "../services/api.js";

export const SearchMarketsSchema = z.object({
	query: z.string().describe("Search query text"),
});

/**
 * Searches for markets, events, and profiles using text search.
 */
export async function handleSearchMarkets(
	args: z.infer<typeof SearchMarketsSchema>,
) {
	const data = await api.searchMarkets(args.query);
	return JSON.stringify(data, null, 2);
}
