import { z } from "zod";
import { getAllowanceService } from "../services/index.js";

export const SetTokenAllowancesSchema = z.object({});

export async function handleSetTokenAllowances() {
	const allowanceService = await getAllowanceService();
	const result = await allowanceService.setAllowances();
	return JSON.stringify(result, null, 2);
}
