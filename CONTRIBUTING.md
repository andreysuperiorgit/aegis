# Contributing to AEGIS

Thanks for your interest in making memecoin trading a bit less suicidal.

## How to contribute

1. **Open an issue first** — before writing code, describe what you want to change
2. **Fork the repo** and create a feature branch: `git checkout -b feat/my-feature`
3. **Write the code** — keep it clean, add comments where logic is non-obvious
4. **Test manually** — scan a few tokens, make sure nothing breaks
5. **Submit a PR** — reference the issue, describe what changed

## What we need help with

- **Bundle detection** — improving Jito bundle ID parsing and funder graph analysis
- **New chains** — TON, BNB Chain, Avalanche, Arbitrum
- **LP lock verification** — Raydium, Aerodrome, Uniswap LP burn/lock checks
- **Grok prompts** — better risk analysis prompts, multi-language support
- **Testing** — automated test suite with mock RPC responses
- **UI/UX** — the dashboard could always look better

## Code style

- ES Modules (`import/export`)
- Descriptive variable names > comments
- One file per scanner/monitor/chain
- Log everything useful via `createLogger`

## Important

- Never commit `.env` files or private keys
- The sniper module is dangerous — test with tiny amounts
- Be honest in the README about what works and what doesn't
