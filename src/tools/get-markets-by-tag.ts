import { z } from "zod";
import { api } from "../services/api.js";

const getMarketsByTagSchema = z.object({
	tag_id: z.string().describe("The tag ID to filter by"),
	limit: z
		.number()
		.optional()
		.default(20)
		.describe("Number of markets to return (default: 20)"),
	closed: z
		.boolean()
		.optional()
		.default(false)
		.describe("Include closed markets (default: false)"),
});

export const getMarketsByTagTool = {
	name: "get_markets_by_tag",
	description:
		"Get markets filtered by a specific tag ID. Useful for finding markets in specific categories.",
	parameters: getMarketsByTagSchema,
	execute: async (args: z.infer<typeof getMarketsByTagSchema>) => {
		const data = await api.getMarketsByTag(
			args.tag_id,
			args.limit,
			args.closed,
		);
		return JSON.stringify(data, null, 2);
	},
};
