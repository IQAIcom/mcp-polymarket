import { z } from "zod";
import { getTradingInstance } from "../services/trading.js";

export const SetTokenAllowancesSchema = z.object({});

export async function handleSetTokenAllowances() {
	const trading = getTradingInstance();

	const result = await trading.setAllowances();
	return JSON.stringify(result, null, 2);
}
