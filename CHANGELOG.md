# Changelog

## [0.2.0] — 2026-09-15

### Added — **Second Brain**
- **AEGIS Memory** — local SQLite-backed intelligence layer that persists across scans
- Every scan now enriches the score with historical context (deployers, wallets, bundles)
- Deployer reputation tracking: rug rate, alive tokens, first/last seen
- Wallet flags: `smart_money`, `known_rugger`, bundle appearances
- Token lifecycle recording: launched at, verdict, current status (live/rugged/abandoned)
- Score adjustment range: **±25** on top of the 6 base checks
- `npm run memory:stats` — top ruggers, smart-money wallets, tracked totals
- `npm run memory:flag` — manually flag a wallet
- Scanners now capture `deployer` and `buyers[]` fields for memory enrichment
- Bundle detection now records participating wallets to memory
- New env var: `AEGIS_MEMORY_PATH` (default: `data/memory.db`)

### Changed
- `solana.scanner.js`, `robinhood.scanner.js`, `base.scanner.js` now integrate Memory
- Scan results include `memory: { adjustment, reasons, deployer, wallets }`
- Bundle detection returns `{ detected, wallets, blockNumber }` (was `boolean`)

### Dependencies
- Added `better-sqlite3` (^11.3.0) — the only new runtime dependency

## [0.1.0] — 2026-09-12

### Added
- Token scanner for Solana (Pump.fun), Robinhood Chain (Pons V2), and Base (Clanker)
- Safety score engine with 6 weighted checks (mint authority, freeze authority, holder concentration, bundle detection, LP status, metadata)
- Live monitoring via WebSocket for all 3 chains
- React dashboard with manual scan and live feed tabs
- Chain selector (Solana / Robinhood / Base) in UI
- Grok AI integration for risk analysis (optional, via xAI API)
- RugCheck API integration for enhanced Solana scanning
- Jupiter sniper module for Solana (disabled by default)
- Uniswap V4 sniper stub for Robinhood Chain
- Full project documentation and README
- $LAPTOP case study with real data

### Known limitations
- Bundle detection is simplified (slot count, not full funder graph)
- LP burn check is a stub for Raydium pools
- Robinhood Chain scanner checks known addresses only (no full holder enumeration)
- Uniswap V4 sniper not fully implemented (Pons V2 hooks need custom integration)
