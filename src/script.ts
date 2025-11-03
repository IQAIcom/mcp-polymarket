#!/usr/bin/env node

import { tradeApi } from "./services/trading.js";

/**
 * Script to place a market order on Polymarket
 *
 * This script demonstrates how to place a BUY market order
 * with specific parameters.
 */
async function placeMarketOrder() {
	try {
		console.log("🚀 Placing market order...");

		// Market order parameters
		const params = {
			side: "BUY" as const,
			tokenId:
				"60487116984468020978247225474488676749601001829886755968952521846780452448915",
			amount: 1, // For BUY orders, this is the dollar amount ($USD) to spend
		};

		console.log("📋 Order parameters:", JSON.stringify(params, null, 2));

		// Execute the market order
		const result = await tradeApi.placeMarketOrder(params);

		console.log("✅ Market order placed successfully!");
		console.log("📊 Result:", JSON.stringify(result, null, 2));

		return result;
	} catch (error) {
		console.error("❌ Error placing market order:", error);

		// Check if it's an approval error
		if (error && typeof error === "object" && "message" in error) {
			console.error("Error details:", error.message);
		}

		throw error;
	}
}

// Run the script
placeMarketOrder()
	.then(() => {
		console.log("🎉 Script completed successfully");
		process.exit(0);
	})
	.catch((error) => {
		console.error("💥 Script failed:", error);
		process.exit(1);
	});
