import { z } from "zod";
import { api } from "../services/api.js";

export const GetOrderBookSchema = z.object({
	token_id: z.string().describe("The token ID for the market outcome"),
});

export async function handleGetOrderBook(
	args: z.infer<typeof GetOrderBookSchema>,
) {
	const data = await api.getOrderBook(args.token_id);
	return JSON.stringify(data, null, 2);
}
