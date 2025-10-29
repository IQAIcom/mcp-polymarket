import { z } from "zod";
import { getOrderbookInstance } from "../services/orderbook.js";

export const GetOrderBookSchema = z.object({
	token_id: z.string().describe("The token ID for the market outcome"),
});

export async function handleGetOrderBook(
	args: z.infer<typeof GetOrderBookSchema>,
) {
	const orderbook = getOrderbookInstance();
	const data = await orderbook.getOrderBook(args.token_id);
	return JSON.stringify(data, null, 2);
}
