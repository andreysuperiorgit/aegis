# Changelog

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
