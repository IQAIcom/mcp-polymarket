import { z } from "zod";
import { getMarketsInstance } from "../services/markets.js";

export const GetEventBySlugSchema = z.object({
	slug: z.string().describe("The event slug identifier"),
});

export async function handleGetEventBySlug(
	args: z.infer<typeof GetEventBySlugSchema>,
) {
	const markets = getMarketsInstance();
	const data = await markets.getEventBySlug(args.slug);
	return JSON.stringify(data, null, 2);
}
