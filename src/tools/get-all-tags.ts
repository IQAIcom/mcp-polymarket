import { z } from "zod";
import { api } from "../services/api.js";

export const GetAllTagsSchema = z.object({});

export async function handleGetAllTags() {
	const data = await api.getAllTags();
	return JSON.stringify(data, null, 2);
}
