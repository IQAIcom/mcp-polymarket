import { z } from "zod";
import { getConfig } from "../services/config.js";

const DATA_API_URL = "https://data-api.polymarket.com";

const getPositionsSchema = z.object({
	user: z
		.string()
		.optional()
		.describe(
			"Wallet address to fetch positions for. If not provided, uses POLYMARKET_FUNDER env var.",
		),
	limit: z
		.number()
		.optional()
		.default(100)
		.describe("Maximum number of positions to return (default: 100)"),
});

interface DataApiPosition {
	proxyWallet: string;
	asset: string;
	conditionId: string;
	size: number;
	avgPrice: number;
	initialValue: number;
	currentValue: number;
	cashPnl: number;
	percentPnl: number;
	totalBought: number;
	realizedPnl: number;
	percentRealizedPnl: number;
	curPrice: number;
	redeemable: boolean;
	mergeable: boolean;
	title: string;
	slug: string;
	icon?: string;
	eventSlug?: string;
	outcome: string;
	outcomeIndex: number;
	oppositeOutcome: string;
	oppositeAsset: string;
	endDate?: string;
	negativeRisk: boolean;
}

export interface PositionOutput {
	asset: string;
	conditionId: string;
	title: string;
	slug: string;
	outcome: string;
	size: number;
	avgPrice: number;
	curPrice: number;
	currentValue: number;
	cashPnl: number;
	percentPnl: number;
	redeemable: boolean;
}

async function fetchPositions(
	user: string,
	limit: number,
	redeemable: boolean,
): Promise<DataApiPosition[]> {
	const params = new URLSearchParams({
		user,
		limit: limit.toString(),
		redeemable: redeemable.toString(),
	});

	const response = await fetch(`${DATA_API_URL}/positions?${params}`);

	if (!response.ok) {
		throw new Error(
			`Data API request failed: ${response.status} ${response.statusText}`,
		);
	}

	return response.json();
}

export const getPositionsTool = {
	name: "get_positions",
	description:
		"Get all positions for a wallet address with current values. Returns position details including size, current price, current value, and P&L. Uses the Polymarket Data API for accurate position valuation.",
	parameters: getPositionsSchema,
	execute: async (args: z.infer<typeof getPositionsSchema>) => {
		const config = getConfig();
		const userAddress = args.user ?? config.funderAddress;

		if (!userAddress) {
			throw new Error(
				"No wallet address provided. Either pass 'user' parameter or set POLYMARKET_FUNDER environment variable.",
			);
		}

		try {
			// Fetch both active and redeemable positions
			const [activePositions, redeemablePositions] = await Promise.all([
				fetchPositions(userAddress, args.limit ?? 100, false),
				fetchPositions(userAddress, args.limit ?? 100, true),
			]);

			// Combine and format positions
			const allPositions = [...activePositions, ...redeemablePositions];

			// Calculate totals
			const totalValue = allPositions.reduce(
				(sum, p) => sum + (Number(p.currentValue) || 0),
				0,
			);
			const totalCashPnl = allPositions.reduce(
				(sum, p) => sum + (Number(p.cashPnl) || 0),
				0,
			);

			// Format positions for output
			const positions: PositionOutput[] = allPositions.map((p) => ({
				asset: p.asset,
				conditionId: p.conditionId,
				title: p.title,
				slug: p.slug,
				outcome: p.outcome,
				size: Number(p.size),
				avgPrice: Number(p.avgPrice),
				curPrice: Number(p.curPrice),
				currentValue: Number(p.currentValue),
				cashPnl: Number(p.cashPnl),
				percentPnl: Number(p.percentPnl),
				redeemable: p.redeemable ?? false,
			}));

			return JSON.stringify(
				{
					walletAddress: userAddress,
					totalPositions: positions.length,
					totalValue: Math.round(totalValue * 100) / 100,
					totalCashPnl: Math.round(totalCashPnl * 100) / 100,
					positions,
				},
				null,
				2,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to fetch positions: ${message}`);
		}
	},
};
