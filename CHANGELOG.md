# Changelog

## 0.0.4

### Patch Changes

- 6c2982d: Adds dist in files

## 0.0.3

### Patch Changes

- 3c39366: Changes the build

## 0.0.2

### Patch Changes

- d003edc: Adds trade tools to mcp
- f014136: Removes viem
- 1dce032: makes mcp to only show trade related tools when the polymarket private key is given

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-10-28

### Added

- Initial implementation of Polymarket MCP Server
- TypeScript project setup with strict type checking
- Biome configuration for linting and formatting
- Market data retrieval tools:
  - `get_market_by_slug` - Get specific market details
  - `get_event_by_slug` - Get event information
  - `list_active_markets` - List active markets with pagination
  - `search_markets` - Search for markets, events, and profiles
  - `get_markets_by_tag` - Filter markets by category tags
  - `get_all_tags` - Get all available market tags
  - `get_order_book` - View current order book for a market
- Trading functionality implementation:
  - Trading client class with API credential initialization
  - Limit order placement (GTC/GTD)
  - Market order placement (FOK/FAK)
  - Order management (get, cancel individual, cancel all)
  - Trade history retrieval
  - Balance and allowance management
- Comprehensive documentation in README
- Example environment configuration file
- Test script for manual validation
- Configurable API endpoints via environment variables

### Security

- CodeQL security scan with no vulnerabilities found
- Proper handling of sensitive data (private keys)
- Use of environment variables for configuration
- Documentation of transitive dependency vulnerabilities and mitigation

### Dependencies

- `@modelcontextprotocol/sdk` ^1.20.2 - MCP server implementation
- `@polymarket/clob-client` ^4.22.8 - Polymarket trading client
- `ethers` ^5.7.2 - Ethereum wallet and signing (v5 for compatibility)
- `zod` ^3.25.76 - Schema validation
- `@biomejs/biome` ^2.3.1 - Linting and formatting
- `typescript` ^5.9.3 - Type-safe development
