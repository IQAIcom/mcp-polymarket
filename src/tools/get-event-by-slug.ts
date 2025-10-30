import { z } from "zod";
import { api } from "../services/api.js";

const getEventBySlugSchema = z.object({
	slug: z.string().describe("The event slug identifier"),
});

export const getEventBySlugTool = {
	name: "get_event_by_slug",
	description:
		"Get detailed information about a specific event by its slug identifier. Events group multiple related markets.",
	parameters: getEventBySlugSchema,
	execute: async (args: z.infer<typeof getEventBySlugSchema>) => {
		const data = await api.getEventBySlug(args.slug);
		return JSON.stringify(data, null, 2);
	},
};
