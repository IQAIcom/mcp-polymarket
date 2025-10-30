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
		const markets = await this.api.getMarkets({ slug });
		return markets.length > 0 ? markets[0] : null;
	}

	/**
	 * Get event details by slug identifier
	 */
	async getEventBySlug(slug: string): Promise<unknown> {
		const events = await this.api.getEvents({ slug });
		return events.length > 0 ? events[0] : null;
	}

	/**
	 * List all active markets with pagination
	 */
	async listActiveMarkets(limit = 20, offset = 0): Promise<unknown> {
		return this.api.getEvents({
			order: "id",
			ascending: false,
			closed: false,
			limit,
			offset,
		});
	}

	/**
	 * Search markets, events, and profiles
	 */
	async searchMarkets(query: string): Promise<unknown> {
		return this.api.getMarkets({ search: query });
	}

	/**
	 * Get markets filtered by tag
	 */
	async getMarketsByTag(
		tagId: string,
		limit = 20,
		closed = false,
	): Promise<unknown> {
		return this.api.getMarkets({
			tag_id: Number.parseInt(tagId, 10),
			closed,
			limit,
		});
	}

	/**
	 * Get all available tags
	 */
	async getAllTags(): Promise<unknown> {
		return this.api.getTags();
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
