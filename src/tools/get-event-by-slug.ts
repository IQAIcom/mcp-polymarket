import { z } from "zod";
import { api } from "../services/api.js";

export const GetEventBySlugSchema = z.object({
	slug: z.string().describe("The event slug identifier"),
});

/**
 * Retrieves detailed information about a specific event by its slug.
 */
export async function handleGetEventBySlug(
	args: z.infer<typeof GetEventBySlugSchema>,
) {
	const data = await api.getEventBySlug(args.slug);
	return JSON.stringify(data, null, 2);
}
