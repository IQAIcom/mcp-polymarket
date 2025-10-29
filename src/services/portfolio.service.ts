import type { BalanceAllowanceParams } from "@polymarket/clob-client";
import { AssetType, ClobClient } from "@polymarket/clob-client";
import { Contract, providers, utils, Wallet } from "ethers";
import { DATA_API_URL, USDC_ABI, USDC_ADDRESS } from "./constants.js";

/**
 * Service to handle portfolio and balance operations
 */
export class PortfolioService {
	constructor(
		private client: ClobClient,
		private signer: Wallet,
		private provider: providers.JsonRpcProvider,
	) {}

	/**
	 * Get balance and allowance information
	 */
	async getBalanceAllowance(params?: BalanceAllowanceParams): Promise<unknown> {
		return this.client.getBalanceAllowance(params);
	}

	/**
	 * Update balance and allowance
	 */
	async updateBalanceAllowance(params?: BalanceAllowanceParams): Promise<void> {
		return this.client.updateBalanceAllowance(params);
	}

	/**
	 * Get complete portfolio including wallet balance and positions
	 */
	async getPortfolio(): Promise<unknown> {
		try {
			// Get USDC balance from wallet
			const usdc = new Contract(USDC_ADDRESS, USDC_ABI, this.provider);
			const balance = await usdc.balanceOf(this.signer.address);
			const decimals = await usdc.decimals();
			const balanceFormatted = utils.formatUnits(balance, decimals);

			// Get Polymarket balance
			let polymarketBalance: string;
			try {
				const balanceData = await this.client.getBalanceAllowance({
					asset_type: AssetType.COLLATERAL,
				});
				polymarketBalance = balanceData.balance;
			} catch {
				polymarketBalance = "Unable to fetch";
			}

			// Get positions from Polymarket Data API
			let positions: any[] = [];
			let positionsError: string | null = null;
			try {
				const response = await fetch(
					`${DATA_API_URL}/positions?sizeThreshold=1&limit=50&sortDirection=DESC&user=${this.signer.address}`,
				);
				const positionsData = await response.json();
				positions = positionsData || [];
			} catch (error) {
				positionsError = (error as Error).message;
				positions = [];
			}

			// Calculate portfolio summary
			let totalPositionValue = 0;
			let totalUnrealizedPnL = 0;

			if (Array.isArray(positions)) {
				for (const position of positions) {
					if (position.size && position.price) {
						totalPositionValue +=
							Number.parseFloat(position.size) *
							Number.parseFloat(position.price);
					}
					if (position.unrealizedPnl) {
						totalUnrealizedPnL += Number.parseFloat(position.unrealizedPnl);
					}
				}
			}

			return {
				status: "success",
				portfolio: {
					walletAddress: this.signer.address,
					balances: {
						usdcWalletBalance: balanceFormatted,
						usdcPolymarketBalance: polymarketBalance,
						totalLiquidBalance:
							polymarketBalance !== "Unable to fetch"
								? (
										Number.parseFloat(balanceFormatted) +
										Number.parseFloat(polymarketBalance)
									).toFixed(6)
								: "Unable to calculate",
					},
					positionsSummary: {
						totalPositions: Array.isArray(positions) ? positions.length : 0,
						totalPositionValue: totalPositionValue.toFixed(4),
						totalUnrealizedPnL: totalUnrealizedPnL.toFixed(4),
						positionsError: positionsError,
					},
					positions: positions,
					timestamp: new Date().toISOString(),
				},
			};
		} catch (error) {
			throw new Error(`Failed to get portfolio: ${(error as Error).message}`);
		}
	}
}
