import { z } from "zod";
import {
	getAllowanceService,
	initializeTradingServices,
} from "../services/index.js";

export const SetTokenAllowancesSchema = z.object({});

export async function handleSetTokenAllowances() {
	await initializeTradingServices();
	const result = await getAllowanceService().setAllowances();
	return JSON.stringify(result, null, 2);
}
