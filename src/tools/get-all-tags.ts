import { z } from "zod";
import { api } from "../services/api.js";

const getAllTagsSchema = z.object({});

export const getAllTagsTool = {
	name: "get_all_tags",
	description: "Get a list of all available tags for categorizing markets.",
	parameters: getAllTagsSchema,
	execute: async () => {
		const data = await api.getAllTags();
		return JSON.stringify(data, null, 2);
	},
};
