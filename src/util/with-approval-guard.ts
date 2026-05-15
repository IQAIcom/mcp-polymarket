import { ApprovalRequiredError } from "../services/approvals.js";

export async function withApprovalGuard(
	fn: () => Promise<unknown>,
): Promise<string> {
	try {
		const result = await fn();
		return JSON.stringify(result, null, 2);
	} catch (err) {
		if (err instanceof ApprovalRequiredError) {
			return JSON.stringify(err, null, 2);
		}
		throw err;
	}
}
