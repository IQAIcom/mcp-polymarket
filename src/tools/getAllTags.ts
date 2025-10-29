import { z } from "zod";
import { getMarketsInstance } from "../services/markets.js";

export const GetAllTagsSchema = z.object({});

export async function handleGetAllTags() {
	const markets = getMarketsInstance();
	const data = await markets.getAllTags();
	return JSON.stringify(data, null, 2);
}
