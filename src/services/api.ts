const API_CONFIG = {
	GAMMA_API_BASE:
		process.env.GAMMA_API_BASE || "https://gamma-api.polymarket.com",
	CLOB_API_BASE: process.env.CLOB_API_BASE || "https://clob.polymarket.com",
};

export async function fetchGammaAPI(endpoint: string): Promise<unknown> {
	const url = `${API_CONFIG.GAMMA_API_BASE}${endpoint}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(
			`Gamma API request failed: ${response.status} ${response.statusText}`,
		);
	}

	return response.json();
}

export async function fetchClobAPI(endpoint: string): Promise<unknown> {
	const url = `${API_CONFIG.CLOB_API_BASE}${endpoint}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(
			`CLOB API request failed: ${response.status} ${response.statusText}`,
		);
	}

	return response.json();
}
