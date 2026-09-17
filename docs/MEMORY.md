# Memory

The six checks read a contract. This reads the people behind it.

A contract scan is a snapshot: it tells you what a token looks like at
birth. A competent rugger passes all six checks every time, because
passing them is cheap. What they cannot hide is the pattern across
launches — the same funding wallet, the same LP-pull timing, the same
three bot wallets in the first block.

Memory is where that pattern is kept.

---

## The loop

```
scan ──▶ enrichScan() ──▶ score ──▶ act
  │                                  │
  └──────── recordToken() ───────────┘
                    │
              (time passes)
                    │
            followup job ──▶ updateTokenStatus()
                                   │
                          deployer reputation moves
                                   │
                    └──── feeds the next enrichScan()
```

The last arrow is the part that matters and the part that is easiest to
leave out. Without the follow-up job, `tokens_rugged` never increments,
every deployer keeps a neutral record forever, and `enrichScan()` returns
zero on every call. The memory would fill with rows and learn nothing.

---

## Tables

| table | one row per | why it exists |
|:--|:--|:--|
| `deployers` | address that created a token | reputation, rug rate |
| `wallets` | address seen buying or bundling | `known_rugger`, `smart_money` |
| `tokens` | token ever scanned | score at birth, fate later |
| `token_observations` | one health reading | the trajectory, not just the end state |
| `wallet_bundles` | wallet ↔ token in one block | who bought together |
| `wallet_deployers` | wallet ↔ deployer | the shared-crew edges |
| `schema_migrations` | applied migration | see below |

### Why observations are separate from tokens

`tokens.current_status` holds the latest verdict, which is what scoring
needs. `token_observations` holds every reading taken along the way,
which is what analysis needs. A token that halves, recovers, then dies a
week later looks identical to an instant rug if you only keep the final
flag.

---

## The adjustment

`enrichScan()` returns a number in **±25** and the reasons behind it.

```
serial rugger · 3 of 3 tokens died                        −15
2 known-rugger wallets in the first buys                  −10
smart money bought in the first three blocks              +10
trusted deployer · 5 of 6 alive after 30 days             +10
```

Two rules that are easy to get wrong:

**Reasons are only the things that moved the score.** A neutral lookup
("new deployer, no history") explains nothing. Listing it next to a −10
that came from wallets makes it read as the cause. Neutral observations
go in `notes`, not `reasons`.

**Chains do not share history.** A deployer with three rugs on Base gets
no penalty on Solana. Addresses are not portable between them, so
treating them as one identity would be a guess dressed as a fact.

---

## Migrations

The database is meant to live for months. Once a deployer has a year of
history in it, deleting the file to change a column is not an option, so
every schema change goes through `memory/migrate.js`.

```sh
npm run memory:migrate          # apply anything pending
npm run memory:migrate -- --status
```

Migrations run automatically on server boot. Each one is applied once,
in order, inside a transaction, and recorded in `schema_migrations`.

Adding one means appending to the list. **Never edit a migration that
has already shipped** — someone's database has already applied it, and
changing the definition will not re-run it.

---

## The follow-up job

```sh
npm run followup                # one pass
npm run followup -- --dry-run   # show what it would decide
npm run followup -- --watch     # keep running
```

Tokens are re-checked at roughly **24h, 72h and 7d**. A token is settled
— and leaves the queue — once it is called rugged or reaches the seven
day mark alive.

### How it decides

A token counts as rugged when the price has fallen **90% from its peak**
*and* liquidity is **under $2,000**. Either signal alone is noise: price
halves on ordinary bad days, and liquidity gets migrated between pools.
Requiring both costs some recall and buys a lot of precision, which is
the right trade when the output is a permanent mark on someone's record.

A missing price feed is treated as a rug **only after 24 hours**. Before
that it usually means the indexer has not caught up.

### Price source

`jobs/price.source.js` is a thin adapter. Default is DexScreener, which
needs no key. `AEGIS_PRICE_SOURCE=none` disables network calls entirely.

Robinhood Chain is **not indexed by DexScreener** at the time of writing,
so the adapter returns `null` for it rather than inventing a number. That
means Robinhood tokens will not settle automatically yet — an honest gap,
and better than poisoning the memory with fabricated prices.

---

## Querying it directly

It is plain SQLite. Nothing is hidden.

```sh
sqlite3 data/memory.db "
  SELECT address, tokens_rugged, tokens_total, reputation
    FROM deployers
   WHERE tokens_total >= 3
   ORDER BY CAST(tokens_rugged AS REAL)/tokens_total DESC
   LIMIT 20;"
```

```sh
# how a token actually died
sqlite3 data/memory.db "
  SELECT age_hours, status, price_usd, liquidity_usd
    FROM token_observations
   WHERE token_address = '0x…'
   ORDER BY observed_at;"
```

---

## Honest limits

```
Memory is only as good as what it has seen. It starts empty and useless.

A fresh wallet has no history, so a patient rugger who rotates addresses
  every launch pays no penalty. Nothing on-chain can fix that on day one.

Reputation is derived from outcomes the follow-up job observed. If the
  job has not run, the numbers are not wrong — they are absent.

The rug test is a heuristic with two thresholds. It will miss a slow
  bleed and it will occasionally mark a migration as a death.

Nothing here predicts. It records what happened and applies it to what
  is in front of you now.
```
