# 📊 Polymarket MCP Server

A Model Context Protocol (MCP) server implementation for interacting with Polymarket's prediction markets. This server provides tools for retrieving market data and executing trades through the Polymarket API, enabling AI agents to interact with prediction markets seamlessly.

## ✨ Features

### 📈 Market Data Tools
- **get_market_by_slug**: Get detailed information about a specific market
- **get_event_by_slug**: Get information about events (groups of related markets)
- **list_active_markets**: List currently active markets with pagination
- **search_markets**: Search for markets, events, and profiles
- **get_markets_by_tag**: Filter markets by category tags
- **get_all_tags**: Get all available market tags
- **get_order_book**: View current order book for a market

### 💰 Trading Tools (Optional - Requires Private Key)
Trading tools are automatically enabled when `POLYMARKET_PRIVATE_KEY` is configured:
- **place_order**: Place limit orders (GTC/GTD)
- **place_market_order**: Execute market orders immediately (FOK/FAK)
- **get_open_orders**: View your open orders
- **get_order**: Get details of a specific order
- **cancel_order**: Cancel a specific order
- **cancel_all_orders**: Cancel all open orders
- **get_trade_history**: View your trade history
- **get_balance_allowance**: Check account balances and allowances
- **update_balance_allowance**: Update allowances (still available; approvals are now auto-managed on first run)

**Note**: Without a private key configured, only read-only market data tools are available.

## 🚀 Quick Start

This MCP server is published on npm and can be used directly with `npx` - no installation required!

### 📦 Using with npx (Recommended)

The easiest way to use this MCP server is with `npx`, which runs the package directly from npm:

#### Read-Only Mode (Market Data Only)
```json
{
  "mcpServers": {
    "polymarket": {
      "command": "npx",
      "args": ["-y", "@iqai/mcp-polymarket"]
    }
  }
}
```

#### Trading Mode (With Private Key)
```json
{
  "mcpServers": {
    "polymarket": {
      "command": "npx",
      "args": ["-y", "@iqai/mcp-polymarket"],
      "env": {
        "POLYMARKET_PRIVATE_KEY": "your_private_key_here"
      }
    }
  }
}
```

Optionally, you can configure a custom Polygon RPC endpoint (recommended for reliability):

```json
{
   "mcpServers": {
      "polymarket": {
         "command": "npx",
         "args": ["-y", "@iqai/mcp-polymarket"],
         "env": {
            "POLYMARKET_PRIVATE_KEY": "your_private_key_here",
            "POLYMARKET_RPC_URL": "https://polygon-mainnet.g.alchemy.com/v2/<YOUR_KEY>"
         }
      }
   }
}
```

### 🔧 Manual Installation (For Development)

If you want to modify the server or contribute to development:

```bash
git clone https://github.com/IQAIcom/mcp-polymarket
cd mcp-polymarket
pnpm install
pnpm run build
```

## ⚙️ Configuration

The server runs on stdio transport and can be integrated with MCP-compatible clients like Claude Desktop, Cline, or any other MCP-compatible AI agent system.

### For Claude Desktop

Add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

If you've cloned and built the project locally, you can use it with an absolute path:

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

## 🔐 Security & Privacy

### Private Key Security

When using the trading features, you'll need to provide your Ethereum wallet's private key. **Here's what you need to know:**

✅ **Your Key Stays Safe:**
- The MCP server runs **entirely on your local machine** in a Node.js environment
- Your private key **never leaves your computer**
- No data is sent to any third-party servers except Polymarket's official API endpoints
- The key is only stored in memory during operation and is never written to disk

⚠️ **Important Security Practices:**
- **Never commit** your private key to version control
- **Never share** your configuration file containing the private key
- Only use this on **trusted, secure machines**
- Consider using a **dedicated wallet** for trading with limited funds
- Keep your operating system and Node.js updated with security patches

🔒 **How It Works:**
1. You configure your private key in your MCP client's config file
2. The key is passed as an environment variable to the Node.js process
3. The server uses it to sign transactions locally on your machine
4. Signed transactions are sent to Polymarket's API
5. When the process ends, the key is cleared from memory

**Without a private key configured, only read-only market data tools are available.**

## 💡 Usage Examples

Once configured, you can use the tools through your MCP client. Here are some example queries:

### 🤖 Sample Questions for AI Agents

Your AI agent can now answer questions and perform actions like:

**Market Intelligence Questions:**
- "What are the most active prediction markets right now?"
- "Show me all markets related to artificial intelligence"
- "What's the current probability that Bitcoin will reach $100k by end of year?"
- "Find all markets in the 'Crypto' category"
- "What events are trending on Polymarket today?"

**Market Analysis Questions:**
- "What's the order book depth for the 2024 election market?"
- "Show me the bid-ask spread for [specific market]"
- "What are all the available tags I can filter markets by?"
- "Get detailed information about the 'will-spacex-reach-mars' market"

**Trading & Portfolio Questions** (requires private key):
- "What's my current USDC balance and allowance?"
- "Show me all my open orders across all markets"
- "What's my trading history for the past week?"
- "Place a limit buy order for 50 shares at 0.60 on [market]"
- "Cancel all my open orders on [market]"
- "What's my profit/loss on my recent trades?"

### 📖 Detailed Examples

#### Market Data Examples (Always Available)

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

#### Trading Examples (Requires POLYMARKET_PRIVATE_KEY)

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

## 📚 API Documentation

This server uses the following Polymarket APIs:

- **Gamma Markets API**: For market data retrieval
  - Base URL: `https://gamma-api.polymarket.com`
  - [Documentation](https://docs.polymarket.com/developers/gamma-markets-api/overview)

- **CLOB API**: For order book and trading
  - Base URL: `https://clob.polymarket.com`
  - [Documentation](https://docs.polymarket.com/developers/CLOB/orders/orders)

## 🛠️ Development

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

## 📁 Project Structure

```
mcp-polymarket/
├── src/
│   ├── services/          # Service layer
│   │   ├── api.ts         # Gamma API client
│   │   ├── config.ts      # Configuration management
│   │   └── trading.ts     # Trading client (CLOB)
│   ├── tools/             # MCP tool implementations
│   │   ├── cancel-all-orders.ts
│   │   ├── cancel-order.ts
│   │   ├── get-all-tags.ts
│   │   ├── get-balance-allowance.ts
│   │   └── ...            # Additional tool files
│   ├── index.ts           # Main MCP server
│   └── trading.ts         # Trading utilities
├── dist/                  # Compiled JavaScript output
├── .changeset/            # Changeset configuration
├── .github/               # GitHub Actions and templates
├── node_modules/          # Dependencies
├── .env.example           # Environment variables template
├── biome.json             # Biome configuration
├── package.json           # Project dependencies and scripts
├── package-lock.json      # Lockfile
├── pnpm-lock.yaml         # pnpm lockfile
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

## 🔧 Technologies

- **TypeScript**: Type-safe development
- **fastmcp**: MCP server implementation
- **@polymarket/clob-client**: Polymarket trading client
- **Biome**: Fast linter and formatter

## 🎯 Trading Setup (Advanced)

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

4. **Allowances and approvals**
   - The server now automatically checks and sets the required USDC and Conditional Tokens approvals during initialization (first run may take a few seconds while transactions confirm)
   - The `update_balance_allowance` tool remains available if you want to manage allowances manually

### Environment Variables

The following environment variables are supported:

- `POLYMARKET_PRIVATE_KEY` (required for trading): Private key of the wallet used for trading
- `POLYMARKET_RPC_URL` (optional): Polygon RPC URL to broadcast approval transactions. Defaults to `https://polygon-rpc.com`

**Note on Dependencies**: This project uses `@polymarket/clob-client` which has transitive dependencies with known vulnerabilities in older versions of `axios`. These vulnerabilities (SSRF, CSRF) are mitigated in this use case because:
- The server only connects to trusted Polymarket API endpoints
- It runs locally on user machines, not as a public server
- All API interactions are authenticated and controlled
- Your private key never leaves your machine

## ⚠️ Disclaimer

This is an unofficial tool and is not affiliated with Polymarket. Use at your own risk. Always verify transactions and understand the risks involved in prediction market trading.
