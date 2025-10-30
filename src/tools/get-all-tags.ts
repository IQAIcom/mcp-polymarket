import { z } from "zod";
import { api } from "../services/api.js";

export const GetAllTagsSchema = z.object({});

/**
 * Retrieves a list of all available tags for categorizing markets.
 */
export async function handleGetAllTags() {
	const data = await api.getAllTags();
	return JSON.stringify(data, null, 2);
}
