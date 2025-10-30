import { GammaSDK, PolymarketSDK } from "@hk/polymarket";
import type { OrderBookSummary } from "@polymarket/clob-client";

export interface PolymarketApiConfig {
	privateKey?: string;
	funderAddress?: string;
	host?: string;
	chainId?: number;
	signatureType?: number;
}

export class PolymarketAPI {
	private gamma: GammaSDK;
	private clobSdk: PolymarketSDK | null = null;
	private readonly cfg: Required<
		Pick<PolymarketApiConfig, "host" | "chainId" | "signatureType">
	> &
		Pick<PolymarketApiConfig, "privateKey" | "funderAddress">;

	constructor(config: PolymarketApiConfig = {}) {
		// Defaults from env with fallbacks
		const privateKey =
			config.privateKey ??
			process.env.POLYMARKET_KEY ??
			process.env.POLYMARKET_PRIVATE_KEY;
		const funderAddress = config.funderAddress ?? process.env.POLYMARKET_FUNDER;
		const host =
			config.host ?? process.env.CLOB_API_BASE ?? "https://clob.polymarket.com";
		const chainId =
			config.chainId ??
			(process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : 137);
		const signatureType =
			config.signatureType ??
			(process.env.SIGNATURE_TYPE ? Number(process.env.SIGNATURE_TYPE) : 1);

		this.cfg = { privateKey, funderAddress, host, chainId, signatureType };
		this.gamma = new GammaSDK();

		// Eagerly initialize CLOB SDK if creds exist
		if (privateKey && funderAddress) {
			this.clobSdk = new PolymarketSDK({
				privateKey,
				funderAddress,
				host,
				chainId,
				signatureType,
			});
		}
	}

	// ----- Market data (Gamma) -----
	async getMarketBySlug(slug: string) {
		return this.gamma.getMarketBySlug(slug);
	}

	async getEventBySlug(slug: string) {
		return this.gamma.getEventBySlug(slug);
	}

	async listActiveMarkets(limit = 20, offset = 0) {
		return this.gamma.getActiveMarkets({ limit, offset });
	}

	async searchMarkets(query: string) {
		return this.gamma.search({ q: query });
	}

	async getMarketsByTag(tagId: string, limit = 20, closed = false) {
		const parsedTagId = Number(tagId);
		if (Number.isNaN(parsedTagId)) {
			throw new Error("tag_id must be a number");
		}
		return this.gamma.getMarkets({ tag_id: parsedTagId, limit, closed });
	}

	async getAllTags() {
		return this.gamma.getTags({});
	}

	// ----- Order book (CLOB or public endpoint) -----
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
