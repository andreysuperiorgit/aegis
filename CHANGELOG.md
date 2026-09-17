# Changelog

## [0.3.0]

### Added — the feedback loop
- **`src/aegis/jobs/followup.job.js`** — goes back at 24h / 72h / 7d and
  records what actually happened to a token. Without this nothing ever
  called `updateTokenStatus()`, so `tokens_rugged` never incremented and
  deployer reputation stayed flat forever. The Second Brain could not learn.
- `src/aegis/jobs/price.source.js` — thin price/liquidity adapter
  (DexScreener by default, `AEGIS_PRICE_SOURCE=none` to go offline)
- `scripts/followup.js` — `npm run followup`, `--dry-run`, `--watch`
- the loop starts with the server unless `AEGIS_FOLLOWUP=off`

### Added — schema migrations
- **`src/aegis/memory/migrate.js`** — versioned, transactional, recorded in
  `schema_migrations`. The database is meant to live for months; deleting it
  to change a column was not an option.
- `scripts/memory-migrate.js` — `npm run memory:migrate -- --status`
- migrations run automatically on boot
- new tables: `token_observations` (the trajectory, not just the final flag),
  `wallet_deployers` (shared-crew edges)
- new columns: `tokens.last_checked_at`, `tokens.check_count`

### Added — everything else
- `tests/memory.test.js` — 33 tests covering lookup, record, enrich,
  migrations and the follow-up classifier
- `docs/MEMORY.md` — how the subsystem works and where it is weak
- `Dockerfile`, `docker-compose.yml`, `.dockerignore` — multi-stage so the
  native toolchain stays out of the runtime image
- `SECURITY.md`, `.github/ISSUE_TEMPLATE/`

### Fixed
- **`npm test` never ran.** `node --test tests/` resolves the directory as a
  module on Node 22 and exits. Now globs the test files.
- **Every existing test was broken.** They imported `assert` from `node:test`,
  which does not export it, so all 8 would have failed the moment the runner
  worked. Now imported from `node:assert/strict`.
- **Final verdicts were never stored.** Scanners record a token before the
  weights run, so `tokens.verdict` stayed `null` and deployer history read as
  blanks. Added `recordVerdict()` and wired it into the API routes.
- **`AEGIS_MEMORY_PATH` was read at import time**, so setting it from code
  silently wrote to the default path. Now resolved lazily in `memoryPath()`.
- **Memory reasons misattributed the cause.** A neutral lookup ("new deployer,
  no history") was listed beside adjustments it had nothing to do with.
  `enrichScan()` now separates `reasons` from `notes`.


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
