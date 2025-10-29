import { z } from "zod";
import {
	getPortfolioService,
	initializeTradingServices,
} from "../services/index.js";

export const GetPortfolioSchema = z.object({});

export async function handleGetPortfolio() {
	await initializeTradingServices();
	const result = await getPortfolioService().getPortfolio();
	return JSON.stringify(result, null, 2);
}
