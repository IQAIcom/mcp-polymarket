import { fetchClobAPI } from "./api.js";

export async function getOrderBook(tokenId: string): Promise<unknown> {
	return fetchClobAPI(`/book?token_id=${tokenId}`);
}
