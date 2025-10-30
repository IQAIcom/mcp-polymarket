import { getAPIInstance } from "./api.js";
import { DEFAULT_TICK_SIZE } from "./constants.js";
import type { MarketInfo, ResolvedMarketDetails } from "./types.js";

/**
 * Service to resolve market details from slugs or direct token IDs
 */
export class MarketResolverService {
	/**
	 * Resolve market details from slug or use direct tokenId
	 */
	async resolveMarketDetails(
		marketSlug?: string,
		outcome?: "YES" | "NO",
		tokenId?: string,
		tickSize?: string,
	): Promise<ResolvedMarketDetails> {
		// Validate that we have either tokenId OR (marketSlug + outcome)
		if (!tokenId && (!marketSlug || !outcome)) {
			throw new Error(
				"Either provide tokenId directly, or provide both marketSlug and outcome",
			);
		}

		if (tokenId) {
			// Direct tokenId provided
			return {
				tokenId,
				tickSize: tickSize || DEFAULT_TICK_SIZE,
				marketInfo: null,
			};
		}

		// Fetch market details from Gamma API
		console.log(`Fetching market details for: ${marketSlug}`);
		const api = getAPIInstance();
		const markets = await api.getMarkets({ slug: marketSlug });

		if (!markets || markets.length === 0) {
			throw new Error(`Market not found: ${marketSlug}`);
		}

		const market = markets[0];

		let tokenIds: string[];
		try {
			tokenIds = JSON.parse(market.clobTokenIds);
		} catch (e) {
			throw new Error(
				`Failed to parse clobTokenIds for market '${marketSlug}': ${market.clobTokenIds}. Error: ${e instanceof Error ? e.message : e}`,
			);
		}

		const resolvedTokenId = outcome === "YES" ? tokenIds[0] : tokenIds[1];
		const resolvedTickSize = market.orderPriceMinTickSize.toString();

		const marketInfo: MarketInfo = {
			question: market.question,
			slug: marketSlug as string,
			endDate: market.endDate,
			clobTokenIds: tokenIds,
			tickSize: resolvedTickSize,
		};

		console.log(`Market: ${market.question}`);
		console.log(`Token ID (${outcome}): ${resolvedTokenId}`);
		console.log(`Tick Size: ${resolvedTickSize}`);

		return {
			tokenId: resolvedTokenId,
			tickSize: resolvedTickSize,
			marketInfo,
			outcome,
		};
	}
}
