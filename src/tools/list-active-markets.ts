import { z } from "zod";
import { api } from "../services/api.js";

const listActiveMarketsSchema = z.object({
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

export const listActiveMarketsTool = {
	name: "list_active_markets",
	description:
		"List all currently active markets with pagination. Returns markets that are not yet closed.",
	parameters: listActiveMarketsSchema,
	execute: async (args: z.infer<typeof listActiveMarketsSchema>) => {
		const data = await api.listActiveMarkets(args.limit, args.offset);
		return JSON.stringify(data, null, 2);
	},
};
