import { fetchGammaAPI } from "./api.js";

export async function getMarketBySlug(slug: string): Promise<unknown> {
	return fetchGammaAPI(`/markets/slug/${slug}`);
}

export async function getEventBySlug(slug: string): Promise<unknown> {
	return fetchGammaAPI(`/events/slug/${slug}`);
}

export async function listActiveMarkets(
	limit = 20,
	offset = 0,
): Promise<unknown> {
	return fetchGammaAPI(
		`/events?order=id&ascending=false&closed=false&limit=${limit}&offset=${offset}`,
	);
}

export async function searchMarkets(query: string): Promise<unknown> {
	return fetchGammaAPI(`/public-search?query=${encodeURIComponent(query)}`);
}

export async function getMarketsByTag(
	tagId: string,
	limit = 20,
	closed = false,
): Promise<unknown> {
	return fetchGammaAPI(
		`/markets?tag_id=${tagId}&limit=${limit}&closed=${closed}`,
	);
}

export async function getAllTags(): Promise<unknown> {
	return fetchGammaAPI("/tags");
}
