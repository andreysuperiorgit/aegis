# ◆ AEGIS

**Multi-chain scam filter + smart sniper for Solana (Pump.fun), Robinhood Chain (Pons V2), and Base (Clanker)**

Enter a contract address or monitor new launches in real time — AEGIS scans for bundles, honeypots, hidden mint, holder concentration, gives a safety score 0–100, and can auto-snipe only "clean" tokens.

---

## Why AEGIS Exists

The numbers tell the story:

- **Pons V2** launched 207,893 tokens in 32 days on Robinhood Chain. Only 1.55% graduated to Uniswap. **66.8% of wallets lost money.**
- **$LAPTOP** (Hunter Biden's memecoin) hit $199 and crashed to $0.87 within 90 minutes on September 9, 2026 — a 99.6% drop. Sniper bots and thin liquidity ($48K backing a $144B FDV) wiped out thousands of traders. 80% of LAPTOP buyers lost money.
- On Solana, **Pump.fun** has the same pattern: thousands of daily launches, most are rugs, bundles, or honeypots.

AEGIS is a local tool that sits between you and these launchpads. It catches what your eyes can't in the 30 seconds before everyone else apes in.

---

## Features

- **Token Scanner** — paste any CA, get a full safety breakdown with score 0–100
- **Live Monitor** — real-time stream of new Pump.fun and Pons V2 launches with auto-scan
- **Multi-chain** — Solana + Robinhood Chain from one dashboard
- **6 On-chain Checks** — mint authority, freeze authority, holder concentration, bundle detection, LP status, metadata flags
- **RugCheck Integration** — optional enhanced scanning via RugCheck API
- **Auto-Sniper** — buy tokens that pass your score threshold via Jupiter (Solana) or Uniswap V4 (Robinhood Chain). Disabled by default.
- **Grok AI Analysis** — optional xAI Grok integration that reads scan results and gives a human-language risk breakdown with BUY/AVOID/CAUTION recommendation. Free $175/month API credits.

---

## The $LAPTOP Case Study

On September 9, 2026, Hunter Biden launched the $LAPTOP memecoin on Base. Here's what AEGIS would have flagged:

| Check | What happened | AEGIS flag |
|-------|---------------|------------|
| Holder concentration | A project wallet received 100M tokens (10% supply) a week before launch | ⛔ DANGER |
| LP liquidity | $48,000 backing a token that briefly hit $144B FDV | ⛔ DANGER |
| Insider selling | 42.5M tokens dumped by pre-allocated wallet at open | ⛔ DANGER |
| Bundle detection | Market makers GSR and Wintermute received tokens days before trading | ⛔ DANGER |
| Score | Would have been **< 20** — auto-skipped by sniper | ✅ Saved |

Before $LAPTOP even launched on Base, 14+ copycat LAPTOP tokens appeared on **Robinhood Chain**, Solana, TON, and BNB Chain. AEGIS monitors Pons V2 and Pump.fun for exactly this — catching the copycats and the originals alike.

---

## Supported Chains

### Solana — Pump.fun
The original memecoin factory. AEGIS subscribes to the Pump.fun program (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`) via Solana WebSocket and parses every new token creation in real time. Swaps via Jupiter API.

### Robinhood Chain — Pons V2
The new hotspot. Robinhood Chain is an Arbitrum Orbit L2 (chain ID `4663`) launched July 1, 2026. Pons V2 is the dominant launchpad — 25,000 tokens per day, $544M daily volume, $6M in daily fees. AEGIS listens to the Pons V2 factory contract for `TokenCreated` events and scans each token. Swaps via Uniswap V4.

**Key Pons V2 contracts on Robinhood Chain:**

| Contract | Address |
|----------|---------|
| Pons V2 Launch Factory | `0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e` |
| Pons V2 Launch Locker | `0x267444d099b10fb5ed7c3cc7b7c767adca574952` |
| Pons V2 Meme Hook | `0xe5e702641ea86f4ae6cc3cdaed2b886f976be044` |
| Pons V2 Launch Router | `0xe33e9e479df8802cb0866d5d05258bec4cf62948` |
| Pons V2 Graduation Executor | `0xc7819b64a1daecd7ec19856d026cb14efbd89046` |
| Uniswap V4 PoolManager | `0x8366a39cc670b4001a1121b8f6a443a643e40951` |
| Pons V1 Factory (legacy) | `0xa5aab3f0c6eeadf30ef1d3eb997108e976351feb` |

### Base — Clanker / Aerodrome
Where $LAPTOP launched and crashed 99.6%. Base is Coinbase's OP Stack L2 (chain ID `8453`). Clanker is the leading AI-powered token launcher — creates standard DEX pairs (no bonding curve), tokens tradeable immediately. Aerodrome is the top DEX. AEGIS monitors Uniswap V3 Factory on Base for new pool creation events and scans each new token. Swaps via Uniswap V3 / Aerodrome.

**$LAPTOP token on Base:** `0xB095274743941e953c746F9C228DA9c18Bb6ec29`

---

## Architecture

```
┌───────────────────────────────────────────────────┐
│  Frontend — React (localhost:3000)                          │
│  Manual scan │ Live feed │ Score details │ Snipe controls   │
└────────────────────┬───────────────────────────────────────┘
                     │ WebSocket + REST
┌────────────────────┴───────────────────────────────────────┐
│  Backend — Node.js + Express (localhost:3001)               │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────┐   │
│  │ Monitor      │ → │ Scanner      │ → │ Score Engine  │   │
│  │ • Solana     │   │ • Solana     │   │ 0–100         │   │
│  │ • Robinhood  │   │ • Robinhood  │   └───────┬───────┘   │
│  │ • Base       │   │ • Base       │           ↓           │
│  └──────────────┘   │ • RugCheck   │   ┌───────────────┐   │
│                     └──────────────┘   │ Sniper        │   │
│                                        │ • Jupiter     │   │
│                                        │ • Uniswap V4  │   │
│                                        │ • Aerodrome   │   │
│                                        └───────────────┘   │
└────────────────────────────────────────────────────────────┘
       ↑              ↑              ↑             ↑
  Solana RPC    Robinhood RPC    Base RPC    RugCheck API
  (Pump.fun)    (Pons V2)       (Clanker)
```

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) ≥ 18
- npm (comes with Node.js)

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/aegis.git
cd aegis
```

### 2. Install

```bash
npm install
cd client && npm install && cd ..
```

### 3. Configure

```bash
cp .env.example .env
```

The defaults work out of the box — free public RPCs for both Solana and Robinhood Chain. Edit `.env` for paid RPCs or to enable the sniper.

### 4. Run

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

### 5. Scan a token

Paste any Solana or Robinhood Chain contract address into the scanner and hit Scan. You'll see the safety score and a breakdown of all 6 checks.

---

## Safety Checks

| # | Check | Weight | What it catches |
|---|-------|--------|-----------------|
| 1 | Mint Authority | 20 | **Hidden mint** — creator can print unlimited tokens and dump |
| 2 | Freeze Authority | 15 | **Honeypot** — creator can freeze your wallet, you can't sell |
| 3 | Holder Concentration | 20 | **Whale risk** — top 10 wallets control too much of supply |
| 4 | Bundle Detection | 20 | **Dev snipe** — first buys are coordinated wallets (Jito bundles on Solana, same-block buys on EVM) |
| 5 | LP Status | 15 | **Rug pull** — liquidity not locked or burned after graduation |
| 6 | Metadata Flags | 10 | Suspicious name, symbol, supply, or missing metadata |

**Score = 100 minus penalties.** 80+ is relatively clean. Below 40 is high risk. No score guarantees safety.

---

## How Monitoring Works

### Solana (Pump.fun)

AEGIS connects to Solana's WebSocket RPC and uses `logsSubscribe` filtered to the Pump.fun program. Every token creation transaction is parsed in real time. For faster detection, configure a Yellowstone gRPC endpoint (Helius, Shyft, Triton).

### Robinhood Chain (Pons V2)

AEGIS connects to Robinhood Chain's RPC (`rpc.mainnet.chain.robinhood.com`, chain ID 4663) and uses standard EVM `eth_subscribe` to filter for `TokenCreated` events from the Pons V2 factory at `0x7ed5...`. Since Robinhood Chain is Arbitrum Orbit, all standard Ethereum tooling (ethers.js, viem, Hardhat) works out of the box.

Pons V2 supports custom quote assets — tokens can be paired against ETH, USDG, cbBTC, or even **tokenized stocks** (NVDA, AAPL, TSLA). AEGIS handles all pair types.

---

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/scan/solana/:address` | Scan a Solana token |
| `GET` | `/api/scan/robinhood/:address` | Scan a Robinhood Chain token |
| `GET` | `/api/scan/base/:address` | Scan a Base token |
| `GET` | `/api/monitor/status` | Monitor status for both chains |
| `POST` | `/api/monitor/start` | Start monitoring (`{ "chain": "solana" \| "robinhood" }`) |
| `POST` | `/api/monitor/stop` | Stop monitoring |
| `POST` | `/api/snipe` | Manual snipe trigger (requires `SNIPER_ENABLED=true`) |
| `WS` | `/ws` | Live feed — new tokens, scores, monitor events |

---

## Project Structure

```
aegis/
├── src/
│   ├── index.js                    # Entry point
│   ├── monitors/
│   │   ├── solana.monitor.js       # Pump.fun WebSocket listener
│   │   ├── robinhood.monitor.js    # Pons V2 event listener
│   │   └── base.monitor.js        # Clanker / Uniswap V3 pool events
│   ├── scanners/
│   │   ├── solana.scanner.js       # Solana on-chain checks
│   │   ├── robinhood.scanner.js    # Robinhood Chain on-chain checks
│   │   ├── base.scanner.js        # Base on-chain checks
│   │   └── rugcheck.js             # RugCheck API integration
│   ├── ai/
│   │   └── grok.js                 # xAI Grok risk analysis
│   ├── sniper/
│   │   ├── jupiter.sniper.js       # Solana swaps via Jupiter
│   │   └── uniswap.sniper.js       # Robinhood swaps via Uniswap V4
│   ├── api/
│   │   └── server.js               # Express + WebSocket server
│   └── utils/
│       ├── constants.js            # Addresses, weights, thresholds
│       ├── score.js                # Safety score calculator
│       └── logger.js               # Structured logging
├── client/
│   ├── src/
│   │   ├── App.jsx                 # Dashboard UI
│   │   ├── components/             # React components
│   │   ├── hooks/                  # useWebSocket, etc.
│   │   └── styles/                 # CSS
│   ├── index.html
│   └── package.json
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## RPC Providers

The free public RPCs work for manual scanning. For live monitoring, you need a paid RPC to avoid dropped connections and rate limits.

| Provider | Chains | Pricing | Notes |
|----------|--------|---------|-------|
| [Helius](https://helius.dev) | Solana | Free tier / $50+/mo | Yellowstone gRPC, fastest Pump.fun detection |
| [QuickNode](https://quicknode.com) | Solana + Robinhood | $50+/mo | Supports both chains, Metis Jupiter endpoint |
| [Chainstack](https://chainstack.com) | Robinhood | Free tier / paid | Official Robinhood Chain integration partner |
| [Alchemy](https://alchemy.com) | Robinhood | Free tier / paid | Full archive node access |

---

## Robinhood Chain Resources

- **RPC endpoint**: `https://rpc.mainnet.chain.robinhood.com`
- **WebSocket**: `wss://rpc.mainnet.chain.robinhood.com`
- **Chain ID**: `4663` (mainnet) / `46630` (testnet)
- **Explorer**: [robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com)
- **Developer docs**: [docs.robinhood.com/chain](https://docs.robinhood.com/chain)
- **Gas token**: ETH
- **DEX**: Uniswap V4 (PoolManager: `0x8366a39cc670b4001a1121b8f6a443a643e40951`)
- **Other launchpads**: Pools.trade, hood.fun, Flap

## Grok AI Integration

AEGIS can optionally send scan results to **xAI's Grok** for AI-powered risk analysis. After each scan, Grok reads the on-chain data and returns:

- **Plain-language analysis** — what's wrong (or right) with this token
- **Recommendation** — BUY / CAUTION / AVOID
- **Red flags & green flags** — specific concerns and positive signals

### Setup

1. Get a free API key at [console.x.ai](https://console.x.ai) — $175/month in free credits included
2. Add to your `.env`: `XAI_API_KEY=xai-your-key-here`
3. That's it. The next scan will include a Grok analysis panel.

Default model is `grok-4.1-fast` ($0.20/M tokens — cheapest). Each scan uses ~500 tokens ≈ $0.0001. Your free credits cover ~1.75 million scans per month.

---

## Base Resources

- **RPC endpoint**: `https://mainnet.base.org`
- **Chain ID**: `8453`
- **Explorer**: [basescan.org](https://basescan.org)
- **Gas token**: ETH
- **Launchpads**: Clanker, Virtuals Protocol, Zora
- **DEXes**: Aerodrome, Uniswap V3
- **Uniswap V3 Factory**: `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`

---

## Roadmap

- [x] Token scanner (Solana)
- [x] Token scanner (Robinhood Chain)
- [x] Safety score engine (6 checks)
- [x] Live monitoring (Pump.fun + Pons V2)
- [x] React dashboard
- [x] Jupiter sniper (Solana)
- [x] Uniswap V4 sniper (Robinhood Chain)
- [ ] Telegram alerts bot
- [ ] Advanced bundle detection (Jito bundle ID, funder graph)
- [ ] Insider wallet tracking (Arkham-style)
- [ ] Historical score database
- [ ] Support for TON, BNB Chain

---

## Disclaimer

**This is educational/research software. Use at your own risk.**

- Cryptocurrency trading involves significant financial risk
- No safety score guarantees a token is legitimate — a score of 100 can rug 5 minutes later
- The sniper module sends real transactions with real funds when enabled
- 66.8% of Pons wallets and 80% of $LAPTOP buyers lost money. This tool reduces risk — it doesn't eliminate it
- Always DYOR

---

## License

MIT

---

## Contributing

PRs welcome. If you want to add support for a new chain or launchpad, open an issue first so we can discuss the architecture.
