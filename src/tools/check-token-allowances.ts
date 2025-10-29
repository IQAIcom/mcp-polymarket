import { z } from "zod";
import { getAllowanceService } from "../services/service-container.js";

export const CheckTokenAllowancesSchema = z.object({});

export async function handleCheckTokenAllowances() {
	const allowanceService = await getAllowanceService();
	const result = await allowanceService.checkAllowances();
	return JSON.stringify(
		{
			status: "success",
			allowances: {
				usdcAllowanceForCTF: result.usdcAllowanceCtf,
				usdcAllowanceForExchange: result.usdcAllowanceExchange,
				conditionalTokensApprovalForExchange:
					result.conditionalTokensAllowanceExchange,
			},
			message:
				result.usdcAllowanceCtf !== "0" &&
				result.usdcAllowanceExchange !== "0" &&
				result.conditionalTokensAllowanceExchange
					? "All allowances are set"
					: "Some allowances need to be set. Run setTokenAllowances to fix this.",
		},
		null,
		2,
	);
}
