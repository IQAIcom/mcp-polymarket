import { z } from "zod";
import { getPortfolioService } from "../services/index.js";

export const GetPortfolioSchema = z.object({});

export async function handleGetPortfolio() {
	const portfolioService = await getPortfolioService();
	const result = await portfolioService.getPortfolio();
	return JSON.stringify(result, null, 2);
}
