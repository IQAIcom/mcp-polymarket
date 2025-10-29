import { type PolymarketAPI, getAPIInstance } from "./api.js";

/**
 * Class to handle Polymarket orderbook operations
 */
export class PolymarketOrderbook {
	private api: PolymarketAPI;

	constructor(api?: PolymarketAPI) {
		this.api = api || getAPIInstance();
	}

	/**
	 * Get the order book for a specific token
	 */
	async getOrderBook(tokenId: string): Promise<unknown> {
		return this.api.fetchClobAPI(`/book?token_id=${tokenId}`);
	}
}

// Singleton instance for orderbook
let orderbookInstance: PolymarketOrderbook | null = null;

/**
 * Get or create the orderbook instance
 */
export function getOrderbookInstance(): PolymarketOrderbook {
	if (!orderbookInstance) {
		orderbookInstance = new PolymarketOrderbook();
	}
	return orderbookInstance;
}
