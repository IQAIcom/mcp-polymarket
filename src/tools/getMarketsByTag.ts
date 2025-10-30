import { z } from "zod";
import { api } from "../services/api.js";

export const GetMarketsByTagSchema = z.object({
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

export async function handleGetMarketsByTag(
	args: z.infer<typeof GetMarketsByTagSchema>,
) {
	const data = await api.getMarketsByTag(args.tag_id, args.limit, args.closed);
	return JSON.stringify(data, null, 2);
}
