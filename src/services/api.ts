import type { OrderBookSummary } from "@dschz/polymarket-clob-client";
import { GammaSDK, PolymarketSDK } from "@hk/polymarket";
import { type BaseConfig, getConfig } from "./config.js";

export type PolymarketApiConfig = Partial<BaseConfig>;

export class PolymarketAPI {
	private gamma: GammaSDK;
	private clobSdk: PolymarketSDK | null = null;
	private readonly cfg: BaseConfig;

	constructor(config: PolymarketApiConfig = {}) {
		this.cfg = getConfig(config);
		this.gamma = new GammaSDK();

		// Eagerly initialize CLOB SDK if creds exist
		if (this.cfg.privateKey && this.cfg.funderAddress) {
			this.clobSdk = new PolymarketSDK({
				privateKey: this.cfg.privateKey,
				funderAddress: this.cfg.funderAddress,
				host: this.cfg.host,
				chainId: this.cfg.chainId,
				signatureType: this.cfg.signatureType,
			});
		}
	}

	/**
	 * Retrieves market details by its slug identifier.
	 */
	async getMarketBySlug(slug: string) {
		return this.gamma.getMarketBySlug(slug);
	}

	/**
	 * Retrieves event details by its slug identifier.
	 */
	async getEventBySlug(slug: string) {
		return this.gamma.getEventBySlug(slug);
	}

	/**
	 * Lists active markets with pagination.
	 */
	async listActiveMarkets(limit = 20, offset = 0) {
		return this.gamma.getActiveMarkets({ limit, offset });
	}

	/**
	 * Searches markets, events, and profiles using a query string.
	 */
	async searchMarkets(query: string) {
		return this.gamma.search({ q: query });
	}

	/**
	 * Retrieves markets filtered by tag ID.
	 */
	async getMarketsByTag(tagId: string, limit = 20, closed = false) {
		const parsedTagId = Number(tagId);
		if (Number.isNaN(parsedTagId)) {
			throw new Error("tag_id must be a number");
		}
		return this.gamma.getMarkets({ tag_id: parsedTagId, limit, closed });
	}

	/**
	 * Retrieves all available tags.
	 */
	async getAllTags() {
		return this.gamma.getTags({});
	}

	/**
	 * Retrieves the order book for a specific market token.
	 */
	async getOrderBook(tokenId: string): Promise<OrderBookSummary> {
		if (this.clobSdk) return this.clobSdk.getBook(tokenId);

		// Fallback to public endpoint when credentials are not provided
		const url = `${this.cfg.host}/book?token_id=${encodeURIComponent(tokenId)}`;
		const res = await fetch(url);
		if (!res.ok) {
			throw new Error(
				`Failed to fetch order book: ${res.status} ${res.statusText}`,
			);
		}
		return (await res.json()) as OrderBookSummary;
	}
}

// Default instance using environment variables
export const api = new PolymarketAPI();
