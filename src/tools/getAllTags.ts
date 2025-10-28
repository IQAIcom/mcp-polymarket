import { z } from "zod";
import { getAllTags } from "../services/markets.js";

export const GetAllTagsSchema = z.object({});

export async function handleGetAllTags() {
	const data = await getAllTags();
	return JSON.stringify(data, null, 2);
}
