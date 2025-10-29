import { z } from "zod";
import { getTradingInstance, initializeTrading } from "../services/trading.js";

export const GetPortfolioSchema = z.object({});

export async function handleGetPortfolio() {
	const trading = getTradingInstance();
	await initializeTrading();

	const result = await trading.getPortfolio();
	return JSON.stringify(result, null, 2);
}
