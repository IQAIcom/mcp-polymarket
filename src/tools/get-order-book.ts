import { z } from "zod";
import { api } from "../services/api.js";

const getOrderBookSchema = z.object({
	token_id: z.string().describe("The token ID for the market outcome"),
});

export const getOrderBookTool = {
	name: "get_order_book",
	description:
		"Get the current order book for a specific market token. Shows all active buy and sell orders.",
	parameters: getOrderBookSchema,
	execute: async (args: z.infer<typeof getOrderBookSchema>) => {
		const data = await api.getOrderBook(args.token_id);
		return JSON.stringify(data, null, 2);
	},
};
