/**
 * Price and liquidity readings for the follow-up job.
 *
 * Deliberately a thin adapter: the job only needs two numbers, and
 * swapping where they come from should not touch the job's logic.
 *
 * Default source is DexScreener, which covers all three chains and
 * needs no key. Set AEGIS_PRICE_SOURCE=none to disable network calls
 * entirely (useful for tests and offline runs).
 */

import { createLogger } from "../utils/logger.js";

const log = createLogger("price");

const CHAIN_SLUG = {
  solana: "solana",
  base: "base",
  robinhood: "robinhood",     // not on DexScreener yet; see note below
};

const TIMEOUT_MS = 8000;


async function withTimeout(promise, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await promise(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}


/**
 * @returns {{priceUsd: number|null, liquidityUsd: number|null, source: string}|null}
 */
export async function fetchTokenHealth(address, chain) {
  const source = process.env.AEGIS_PRICE_SOURCE || "dexscreener";

  if (source === "none") return null;

  if (source === "dexscreener") {
    return fetchDexScreener(address, chain);
  }

  log.warn(`Unknown AEGIS_PRICE_SOURCE "${source}" — skipping`);
  return null;
}


async function fetchDexScreener(address, chain) {
  // Robinhood Chain is not indexed by DexScreener at the time of writing.
  // Returning null is honest: the job treats "no feed" on an old token as
  // a rug signal, so silently faking a price here would corrupt memory.
  if (chain === "robinhood") {
    return null;
  }

  const url = `https://api.dexscreener.com/latest/dex/tokens/${address}`;

  try {
    const res = await withTimeout(
      (signal) => fetch(url, { signal, headers: { accept: "application/json" } }),
      TIMEOUT_MS,
    );
    if (!res.ok) {
      log.warn(`DexScreener ${res.status} for ${address.slice(0, 10)}…`);
      return null;
    }
    const data = await res.json();
    const pairs = data?.pairs;
    if (!Array.isArray(pairs) || pairs.length === 0) return null;

    const slug = CHAIN_SLUG[chain];
    const onChain = pairs.filter((p) => !slug || p.chainId === slug);
    const pool = onChain.length ? onChain : pairs;

    // deepest pool is the one that actually reflects the market
    pool.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    const best = pool[0];

    return {
      priceUsd: best.priceUsd != null ? Number(best.priceUsd) : null,
      liquidityUsd: best.liquidity?.usd != null ? Number(best.liquidity.usd) : null,
      source: "dexscreener",
    };
  } catch (err) {
    if (err.name === "AbortError") {
      log.warn(`DexScreener timed out for ${address.slice(0, 10)}…`);
    } else {
      log.warn(`DexScreener failed for ${address.slice(0, 10)}…: ${err.message}`);
    }
    return null;
  }
}
