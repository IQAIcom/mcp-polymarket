import { z } from "zod";
import { searchMarkets } from "../services/markets.js";

export const SearchMarketsSchema = z.object({
	query: z.string().describe("Search query text"),
});

export async function handleSearchMarkets(
	args: z.infer<typeof SearchMarketsSchema>,
) {
	const data = await searchMarkets(args.query);
	return JSON.stringify(data, null, 2);
}
