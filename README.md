# Polymarket MCP Server

A Model Context Protocol (MCP) server implementation for interacting with Polymarket's prediction markets. This server provides tools for retrieving market data and executing trades through the Polymarket API.

## Features

### Market Data Tools
- **get_market_by_slug**: Get detailed information about a specific market
- **get_event_by_slug**: Get information about events (groups of related markets)
- **list_active_markets**: List currently active markets with pagination
- **search_markets**: Search for markets, events, and profiles
- **get_markets_by_tag**: Filter markets by category tags
- **get_all_tags**: Get all available market tags
- **get_order_book**: View current order book for a market

### Trading Tools (Requires Configuration)
The trading functionality is implemented but requires proper configuration with private keys and wallet setup. See the `src/trading.ts` file for implementation details.

## Installation

```bash
npm install
npm run build
```

## Configuration

The server runs on stdio transport and can be integrated with MCP-compatible clients like Claude Desktop.

### For Claude Desktop

Add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "polymarket": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-polymarket/build/index.js"]
    }
  }
}
```

## Usage

Once configured, you can use the tools through your MCP client. Here are some example queries:

### Market Data Examples

1. **Get a specific market**:
   ```
   Get information about the market with slug "will-trump-win-2024"
   ```

2. **Search markets**:
   ```
   Search for markets related to "elections"
   ```

3. **List active markets**:
   ```
   Show me the 10 most recent active markets
   ```

4. **Get order book**:
   ```
   Show me the order book for token ID "123456..."
   ```

## API Documentation

This server uses the following Polymarket APIs:

- **Gamma Markets API**: For market data retrieval
  - Base URL: `https://gamma-api.polymarket.com`
  - [Documentation](https://docs.polymarket.com/developers/gamma-markets-api/overview)

- **CLOB API**: For order book and trading
  - Base URL: `https://clob.polymarket.com`
  - [Documentation](https://docs.polymarket.com/developers/CLOB/orders/orders)

## Development

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run watch
```

### Linting and Formatting
This project uses Biome for code quality:

```bash
npm run check    # Check and fix issues
npm run lint     # Lint only
npm run format   # Format only
```

## Project Structure

```
mcp-polymarket/
├── src/
│   ├── index.ts      # Main MCP server implementation
│   └── trading.ts    # Trading functionality (requires configuration)
├── build/            # Compiled JavaScript output
├── package.json      # Project dependencies and scripts
├── tsconfig.json     # TypeScript configuration
├── biome.json        # Biome configuration
└── README.md         # This file
```

## Technologies

- **TypeScript**: Type-safe development
- **@modelcontextprotocol/sdk**: MCP server implementation
- **@polymarket/clob-client**: Polymarket trading client
- **Biome**: Fast linter and formatter

## Trading Setup (Advanced)

To enable trading functionality, you need to:

1. Set up a wallet with a private key
2. Fund the wallet with USDC on Polygon
3. Configure the trading client in your implementation

**⚠️ Security Warning**: Never commit private keys or expose them in your code. Use environment variables or secure key management.

## License

MIT

## Contributing

Contributions are welcome! Please ensure all code passes linting and type checking:

```bash
npm run build
npm run check
```

## Support

For issues or questions:
- Polymarket API Documentation: https://docs.polymarket.com/
- MCP Documentation: https://modelcontextprotocol.io/

## Disclaimer

This is an unofficial tool and is not affiliated with Polymarket. Use at your own risk. Always verify transactions and understand the risks involved in prediction market trading.
