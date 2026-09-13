# Architecture

## Overview

AEGIS is a three-layer system: monitors detect new tokens, scanners analyze them, and actors (score engine, Grok AI, sniper) decide what to do.

## Data flow

```
Blockchain RPCs
    ↓ WebSocket / polling
Monitors (solana, robinhood, base)
    ↓ emit "newToken"
Scanners (on-chain checks)
    ↓ raw check results
Score Engine (weighted 0–100)
    ↓ score + verdict
    ├── Grok AI (risk analysis)
    ├── Sniper (auto-buy if clean)
    └── WebSocket → Dashboard
```

## Modules

| Module | Path | Responsibility |
|:---|:---|:---|
| Monitors | `src/aegis/monitors/` | Subscribe to chain events, emit new token detections |
| Scanners | `src/aegis/scanners/` | On-chain checks per chain (mint, freeze, holders, bundles, LP) |
| Score | `src/aegis/utils/score.js` | Weighted score calculation |
| Grok | `src/aegis/ai/grok.js` | xAI API integration for risk analysis |
| Sniper | `src/aegis/sniper/` | Swap execution via Jupiter / Uniswap |
| API | `src/aegis/api/server.js` | Express REST + WebSocket server |
| Dashboard | `client/` | React frontend with Vite |

## Chain specifics

### Solana
- Uses `logsSubscribe` on Pump.fun program `6EF8...`
- SPL token account parsing for mint/freeze authority
- `getTokenLargestAccounts` for holder concentration
- Signature analysis for bundle detection

### Robinhood Chain (EVM, chain 4663)
- `eth_subscribe` on Pons V2 factory `0x7ed5...`
- Contract bytecode scanning for dangerous functions
- `balanceOf` checks on known addresses

### Base (EVM, chain 8453)
- Monitors Uniswap V3 Factory for `PoolCreated` events
- Same EVM scanner as Robinhood with Base-specific addresses
