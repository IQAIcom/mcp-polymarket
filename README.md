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

### Trading Tools (Optional - Requires Private Key)
Trading tools are automatically enabled when `POLYMARKET_PRIVATE_KEY` is configured:
- **place_order**: Place limit orders (GTC/GTD)
- **place_market_order**: Execute market orders immediately (FOK/FAK)
- **get_open_orders**: View your open orders
- **get_order**: Get details of a specific order
- **cancel_order**: Cancel a specific order
- **cancel_all_orders**: Cancel all open orders
- **get_trade_history**: View your trade history
- **get_balance_allowance**: Check account balances and allowances
- **update_balance_allowance**: Update allowances (required before trading)

**Note**: Without a private key configured, only read-only market data tools are available.

## Installation

```bash
pnpm install
pnpm run build
```

## Configuration

The server runs on stdio transport and can be integrated with MCP-compatible clients like Claude Desktop.

### For Claude Desktop

Add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

#### Read-Only Mode (Market Data Only)
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

#### Trading Mode (With Private Key)
```json
{
  "mcpServers": {
    "polymarket": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-polymarket/build/index.js"],
      "env": {
        "POLYMARKET_PRIVATE_KEY": "your_private_key_here"
      }
    }
  }
}
```

**⚠️ Security Warning**: Your private key grants full access to your wallet. Only use this on trusted machines and never share your configuration file.

## Usage

Once configured, you can use the tools through your MCP client. Here are some example queries:

### Market Data Examples (Always Available)

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

### Trading Examples (Requires POLYMARKET_PRIVATE_KEY)

1. **Check your balance**:
   ```
   Check my COLLATERAL balance
   ```

2. **Place a limit order**:
   ```
   Place a buy order for 100 shares at 0.65 price on token ID "123456..."
   ```

3. **View open orders**:
   ```
   Show me all my open orders
   ```

4. **Cancel an order**:
   ```
   Cancel order with ID "0x123..."
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
pnpm run build
```

### Watch Mode
```bash
pnpm run watch
```

### Linting and Formatting
This project uses Biome for code quality:

```bash
pnpm run check    # Check and fix issues
pnpm run lint     # Lint only
pnpm run format   # Format only
```

### Release Management

This project uses [Changesets](https://github.com/changesets/changesets) for version management and automated releases.

#### Creating a changeset
When you make changes that should trigger a release, create a changeset:

```bash
pnpm changeset
```

This will prompt you to:
1. Select which packages to include (for this single package, just select it)
2. Choose the type of change (patch, minor, or major)
3. Write a description of the changes

#### Release Process
1. Create and merge your PR with the changeset
2. The GitHub Action will automatically create a "Release PR" 
3. When the Release PR is merged, it will:
   - Update the version in `package.json`
   - Generate/update `CHANGELOG.md`
   - Create a git tag
   - Publish to npm (if configured)

#### Manual Release (for maintainers)
```bash
pnpm run version  # Updates version and changelog
pnpm run release  # Builds and publishes to npm
```

## Project Structure

```
mcp-polymarket/
├── src/
│   ├── services/          # Service layer
│   │   ├── api.ts         # Gamma API client
│   │   ├── markets.ts     # Market data services
│   │   ├── orderbook.ts   # Order book services
│   │   └── trading.ts     # Trading client (CLOB)
│   ├── tools/             # MCP tool implementations
│   │   ├── get*.ts        # Read-only market data tools
│   │   ├── place*.ts      # Order placement tools (requires key)
│   │   ├── cancel*.ts     # Order cancellation tools (requires key)
│   │   └── update*.ts     # Account management tools (requires key)
│   └── index.ts           # Main MCP server
├── build/                 # Compiled JavaScript output
├── package.json           # Project dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── biome.json             # Biome configuration
└── README.md              # This file
```

## Technologies

- **TypeScript**: Type-safe development
- **@modelcontextprotocol/sdk**: MCP server implementation
- **@polymarket/clob-client**: Polymarket trading client
- **Biome**: Fast linter and formatter

## Trading Setup (Advanced)

To enable trading functionality:

1. **Set up a wallet with a private key**
   - Create or use an existing Ethereum wallet
   - Export the private key (never share this!)

2. **Fund the wallet with USDC on Polygon**
   - Bridge USDC to Polygon network
   - Ensure you have enough for trading + gas fees

3. **Configure the private key**
   - Add `POLYMARKET_PRIVATE_KEY` to your MCP server configuration
   - The server will automatically enable trading tools when detected

4. **Update allowances (first time only)**
   - Use `update_balance_allowance` tool before your first trade
   - This approves the Polymarket contract to use your funds

**⚠️ Security Warning**: 
- Never commit private keys to version control
- Only use private keys on trusted, secure machines
- Consider using a dedicated wallet for trading with limited funds

**Note on Dependencies**: This project uses `@polymarket/clob-client` which has transitive dependencies with known vulnerabilities in older versions of `axios`. These vulnerabilities (SSRF, CSRF) are mitigated in this use case because:
- The server only connects to trusted Polymarket API endpoints
- It runs locally on user machines, not as a public server
- All API interactions are authenticated and controlled

## License

MIT

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Ensure all code passes linting and type checking:
   ```bash
   pnpm run build
   pnpm run check
   ```
5. Create a changeset for your changes:
   ```bash
   pnpm changeset
   ```
6. Commit your changes and push to your fork
7. Create a Pull Request

### PR Requirements
- [ ] All tests pass
- [ ] Code is properly formatted and linted
- [ ] A changeset is included (unless it's a docs-only change)
- [ ] PR description follows the template

## Support

For issues or questions:
- Polymarket API Documentation: https://docs.polymarket.com/
- MCP Documentation: https://modelcontextprotocol.io/

## Disclaimer

This is an unofficial tool and is not affiliated with Polymarket. Use at your own risk. Always verify transactions and understand the risks involved in prediction market trading.
