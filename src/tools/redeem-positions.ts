import { z } from "zod";
import { redemptionApi } from "../services/redemption.js";

const redeemPositionsSchema = z.object({
	conditionId: z
		.string()
		.describe(
			"The condition ID (market ID) for the resolved market. This is typically a 32-byte hex string.",
		),
	tokenId: z
		.string()
		.optional()
		.describe(
			"The token ID of the position to redeem. Required for negRisk markets, optional for regular markets.",
		),
	outcomeIndex: z
		.union([z.literal(0), z.literal(1)])
		.optional()
		.describe(
			"The outcome index: 0 for Yes/first outcome, 1 for No/second outcome. Used for negRisk markets to determine which tokens to redeem.",
		),
	negRisk: z
		.boolean()
		.optional()
		.describe(
			"Whether this is a negative risk market. Negative risk markets use the NegRiskAdapter contract for redemption. Default: false",
		),
});

export const redeemPositionsTool = {
	name: "redeem_positions",
	description:
		"Redeem (claim) winnings from a resolved Polymarket prediction market. Use this to collect USDC from positions in markets that have been settled. For regular markets, you need the conditionId. For negative risk markets, you also need the tokenId and should set negRisk=true. The market must be resolved before redemption is possible.",
	parameters: redeemPositionsSchema,
	execute: async (args: z.infer<typeof redeemPositionsSchema>) => {
		try {
			const result = await redemptionApi.redeemPositions({
				conditionId: args.conditionId,
				tokenId: args.tokenId,
				outcomeIndex: args.outcomeIndex,
				negRisk: args.negRisk,
			});

			if (result.success) {
				return JSON.stringify(
					{
						success: true,
						message: "Position redeemed successfully",
						txHash: result.txHash,
						polygonscanUrl: `https://polygonscan.com/tx/${result.txHash}`,
					},
					null,
					2,
				);
			}

			return JSON.stringify(
				{
					success: false,
					error: result.error,
					...(result.txHash && {
						txHash: result.txHash,
						polygonscanUrl: `https://polygonscan.com/tx/${result.txHash}`,
					}),
				},
				null,
				2,
			);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			return JSON.stringify(
				{
					success: false,
					error: errorMessage,
				},
				null,
				2,
			);
		}
	},
};
