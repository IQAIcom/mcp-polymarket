import { getAPIInstance, type PolymarketAPI } from "./api.js";

/**
 * Class to handle Polymarket market data operations
 */
export class PolymarketMarkets {
	private api: PolymarketAPI;

	constructor(api?: PolymarketAPI) {
		this.api = api || getAPIInstance();
	}

	/**
	 * Get market details by slug identifier
	 */
	async getMarketBySlug(slug: string): Promise<unknown> {
		return this.api.fetchGammaAPI(`/markets/slug/${slug}`);
	}

	/**
	 * Get event details by slug identifier
	 */
	async getEventBySlug(slug: string): Promise<unknown> {
		return this.api.fetchGammaAPI(`/events/slug/${slug}`);
	}

	/**
	 * List all active markets with pagination
	 */
	async listActiveMarkets(limit = 20, offset = 0): Promise<unknown> {
		return this.api.fetchGammaAPI(
			`/events?order=id&ascending=false&closed=false&limit=${limit}&offset=${offset}`,
		);
	}

	/**
	 * Search markets, events, and profiles
	 */
	async searchMarkets(query: string): Promise<unknown> {
		return this.api.fetchGammaAPI(
			`/public-search?q=${encodeURIComponent(query)}`,
		);
	}

	/**
	 * Get markets filtered by tag
	 */
	async getMarketsByTag(
		tagId: string,
		limit = 20,
		closed = false,
	): Promise<unknown> {
		return this.api.fetchGammaAPI(
			`/markets?tag_id=${tagId}&limit=${limit}&closed=${closed}`,
		);
	}

	/**
	 * Get all available tags
	 */
	async getAllTags(): Promise<unknown> {
		return this.api.fetchGammaAPI("/tags");
	}
}

// Singleton instance for markets
let marketsInstance: PolymarketMarkets | null = null;

/**
 * Get or create the markets instance
 */
export function getMarketsInstance(): PolymarketMarkets {
	if (!marketsInstance) {
		marketsInstance = new PolymarketMarkets();
	}
	return marketsInstance;
}
