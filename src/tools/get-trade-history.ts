import { z } from "zod";
import {
	getOrderService,
	initializeTradingServices,
} from "../services/index.js";

export const GetTradeHistorySchema = z.object({
	market: z
		.string()
		.optional()
		.describe("Optional market address to filter trades by"),
	maker_address: z
		.string()
		.optional()
		.describe("Optional maker address to filter trades by"),
});

export async function handleGetTradeHistory(
	args: z.infer<typeof GetTradeHistorySchema>,
) {
	await initializeTradingServices();

	const params: Record<string, string> = {};
	if (args.market) params.market = args.market;
	if (args.maker_address) params.maker_address = args.maker_address;

	const result = await getOrderService().getTradeHistory(
		Object.keys(params).length > 0 ? params : undefined,
	);
	return JSON.stringify(result, null, 2);
}
