/**
 * Position Redemption Service
 * Handles redemption of resolved market positions on Polymarket
 */

import { BigNumber, Contract, providers, Wallet } from "ethers";
import { getConfig, POLYGON_ADDRESSES } from "./config.js";

// Parent collection ID for Polymarket (constant)
const PARENT_COLLECTION_ID =
	"0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * CTF (Conditional Tokens Framework) ABI for redemption operations
 */
const CTF_ABI = [
	"function balanceOf(address account, uint256 id) view returns (uint256)",
	"function payoutDenominator(bytes32 conditionId) view returns (uint256)",
	"function payoutNumerators(bytes32 conditionId, uint256 index) view returns (uint256)",
	"function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] indexSets)",
	"function isApprovedForAll(address owner, address operator) view returns (bool)",
];

/**
 * NegRiskAdapter ABI for negative risk market redemption
 */
const NEG_RISK_ADAPTER_ABI = [
	"function redeemPositions(bytes32 conditionId, uint256[] amounts)",
];

export interface RedeemResult {
	success: boolean;
	txHash?: string;
	error?: string;
}

export interface RedeemParams {
	conditionId: string;
	tokenId?: string;
	outcomeIndex?: 0 | 1;
	negRisk?: boolean;
}

/**
 * Redemption service class
 */
export class PolymarketRedemption {
	private signer: Wallet;
	private provider: providers.JsonRpcProvider;

	constructor(signer?: Wallet) {
		const cfg = getConfig();
		if (!cfg.privateKey) {
			throw new Error(
				"POLYMARKET_PRIVATE_KEY environment variable is required for redemption",
			);
		}
		this.provider = new providers.JsonRpcProvider(cfg.rpcUrl);
		this.signer = signer ?? new Wallet(cfg.privateKey, this.provider);
	}

	/**
	 * Get the wallet address (funder/proxy or signer address)
	 */
	getWalletAddress(): string {
		const cfg = getConfig();
		return cfg.funderAddress ?? this.signer.address;
	}

	/**
	 * Get CTF contract instance
	 */
	private getCtfContract(): Contract {
		return new Contract(POLYGON_ADDRESSES.CTF_ADDRESS, CTF_ABI, this.signer);
	}

	/**
	 * Get NegRiskAdapter contract instance
	 */
	private getNegRiskAdapterContract(): Contract {
		return new Contract(
			POLYGON_ADDRESSES.NEG_RISK_ADAPTER_ADDRESS,
			NEG_RISK_ADAPTER_ABI,
			this.signer,
		);
	}

	/**
	 * Get CTF token balance for a specific position
	 */
	async getCTFBalance(tokenId: string): Promise<bigint> {
		try {
			const ctf = this.getCtfContract();
			const walletAddress = this.getWalletAddress();
			const balance: BigNumber = await ctf.balanceOf(walletAddress, tokenId);
			return balance.toBigInt();
		} catch (error) {
			console.error("Error fetching CTF balance:", error);
			return 0n;
		}
	}

	/**
	 * Check if a market condition has been resolved
	 */
	async isMarketResolved(conditionId: string): Promise<boolean> {
		try {
			const ctf = this.getCtfContract();
			const conditionIdBytes32 = this.formatConditionId(conditionId);
			const payoutDenominator: BigNumber =
				await ctf.payoutDenominator(conditionIdBytes32);
			return payoutDenominator.gt(0);
		} catch (error) {
			console.error("Error checking market resolution:", error);
			return false;
		}
	}

	/**
	 * Get winning outcome index sets for a resolved binary market
	 * Returns array of index sets where payout numerator > 0
	 * For binary markets: [1] for first outcome won, [2] for second outcome won
	 */
	async getWinningIndexSets(conditionId: string): Promise<bigint[]> {
		try {
			const ctf = this.getCtfContract();
			const conditionIdBytes32 = this.formatConditionId(conditionId);

			// Get payout numerators for both outcomes (0 and 1)
			const [numerator0, numerator1]: [BigNumber, BigNumber] = await Promise.all(
				[
					ctf.payoutNumerators(conditionIdBytes32, 0),
					ctf.payoutNumerators(conditionIdBytes32, 1),
				],
			);

			// Build array of winning index sets
			// Index set 1 = outcome 0, Index set 2 = outcome 1
			const winningIndexSets: bigint[] = [];
			if (numerator0.gt(0)) winningIndexSets.push(1n);
			if (numerator1.gt(0)) winningIndexSets.push(2n);

			return winningIndexSets;
		} catch (error) {
			console.error("Error getting winning index sets:", error);
			// Fallback to trying both index sets
			return [1n, 2n];
		}
	}

	/**
	 * Check if NegRiskAdapter is approved to spend CTF tokens
	 */
	async isNegRiskAdapterApproved(): Promise<boolean> {
		try {
			const ctf = this.getCtfContract();
			const walletAddress = this.getWalletAddress();
			return ctf.isApprovedForAll(
				walletAddress,
				POLYGON_ADDRESSES.NEG_RISK_ADAPTER_ADDRESS,
			);
		} catch (error) {
			console.error("Error checking NegRiskAdapter approval:", error);
			return false;
		}
	}

	/**
	 * Format condition ID as bytes32
	 */
	private formatConditionId(conditionId: string): string {
		return conditionId.startsWith("0x") ? conditionId : `0x${conditionId}`;
	}

	/**
	 * Redeem resolved positions
	 * Claims winnings from markets that have been resolved
	 */
	async redeemPositions(params: RedeemParams): Promise<RedeemResult> {
		const { conditionId, tokenId, outcomeIndex, negRisk = false } = params;

		try {
			const conditionIdBytes32 = this.formatConditionId(conditionId);

			// Check token balance if tokenId provided
			let tokenBalance = 0n;
			if (tokenId) {
				tokenBalance = await this.getCTFBalance(tokenId);
				if (tokenBalance === 0n) {
					return {
						success: false,
						error:
							"No CTF tokens to redeem. Balance is 0 - position may have already been redeemed.",
					};
				}
				console.log(`Token balance: ${tokenBalance.toString()}`);
			}

			// Check if market is resolved
			const resolved = await this.isMarketResolved(conditionIdBytes32);
			if (!resolved) {
				return {
					success: false,
					error: "Market has not been resolved yet. Cannot redeem positions.",
				};
			}

			let tx: providers.TransactionResponse;

			if (negRisk) {
				// For negative risk markets, use NegRiskAdapter
				if (tokenBalance === 0n) {
					return {
						success: false,
						error:
							"No tokens to redeem - tokenId is required for negRisk markets",
					};
				}

				// Check if NegRiskAdapter is approved
				const adapterApproved = await this.isNegRiskAdapterApproved();
				if (!adapterApproved) {
					return {
						success: false,
						error:
							"NegRiskAdapter is not approved to spend CTF tokens. Please run approve_allowances first.",
					};
				}

				// Determine amounts array based on which outcome the user holds
				// amounts[0] = outcome 0 (Yes) tokens, amounts[1] = outcome 1 (No) tokens
				let amounts: [bigint, bigint];
				if (outcomeIndex === 0) {
					amounts = [tokenBalance, 0n];
				} else if (outcomeIndex === 1) {
					amounts = [0n, tokenBalance];
				} else {
					// Unknown outcome - try Yes first (legacy behavior)
					amounts = [tokenBalance, 0n];
				}

				console.log(`Redeeming negRisk position:`);
				console.log(`  Condition ID: ${conditionIdBytes32}`);
				console.log(`  Amounts: [${amounts[0]}, ${amounts[1]}]`);

				const negRiskAdapter = this.getNegRiskAdapterContract();
				tx = await negRiskAdapter.redeemPositions(conditionIdBytes32, amounts, {
					gasLimit: 300_000,
				});
			} else {
				// For regular CTF markets
				const winningIndexSets = await this.getWinningIndexSets(conditionIdBytes32);

				if (winningIndexSets.length === 0) {
					return {
						success: false,
						error: "No winning outcomes found for this market.",
					};
				}

				console.log(`Redeeming CTF position:`);
				console.log(`  Condition ID: ${conditionIdBytes32}`);
				console.log(`  Winning index sets: [${winningIndexSets.join(", ")}]`);

				const ctf = this.getCtfContract();
				tx = await ctf.redeemPositions(
					POLYGON_ADDRESSES.USDC_ADDRESS,
					PARENT_COLLECTION_ID,
					conditionIdBytes32,
					winningIndexSets,
					{
						gasLimit: 300_000,
					},
				);
			}

			console.log(`Transaction submitted: ${tx.hash}`);

			// Wait for confirmation
			const receipt = await tx.wait(1);

			if (receipt.status === 0) {
				return {
					success: false,
					txHash: tx.hash,
					error: `Transaction reverted on-chain. Position may have already been redeemed.`,
				};
			}

			return {
				success: true,
				txHash: receipt.transactionHash,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			return {
				success: false,
				error: errorMessage,
			};
		}
	}
}

// Singleton instance
let redemptionInstance: PolymarketRedemption | null = null;

/**
 * Get or create the redemption service instance
 */
export function getRedemptionInstance(): PolymarketRedemption {
	if (!redemptionInstance) {
		redemptionInstance = new PolymarketRedemption();
	}
	return redemptionInstance;
}

// Lazy proxy facade for easy consumption
export const redemptionApi: PolymarketRedemption = new Proxy(
	{} as PolymarketRedemption,
	{
		get(_target, prop, _receiver) {
			const instance = getRedemptionInstance() as unknown as Record<
				string | symbol,
				unknown
			>;
			const value = instance[prop as keyof PolymarketRedemption] as unknown;
			if (typeof value === "function") {
				return value.bind(instance);
			}
			return value;
		},
	},
);
