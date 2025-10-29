import { z } from "zod";
import { getMarketsInstance } from "../services/markets.js";

export const ListActiveMarketsSchema = z.object({
	limit: z
		.number()
		.optional()
		.default(20)
		.describe("Number of markets to return (default: 20, max: 100)"),
	offset: z
		.number()
		.optional()
		.default(0)
		.describe("Number of markets to skip for pagination (default: 0)"),
});

export async function handleListActiveMarkets(
	args: z.infer<typeof ListActiveMarketsSchema>,
) {
	const markets = getMarketsInstance();
	const data = await markets.listActiveMarkets(args.limit, args.offset);
	return JSON.stringify(data, null, 2);
}
