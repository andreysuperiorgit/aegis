/**
 * AEGIS — the follow-up job.
 *
 * Scanning a token tells you what it looked like at birth. This job goes
 * back later and records what actually happened to it, which is the only
 * reason deployer reputation means anything: without it `tokens_rugged`
 * never increments and every deployer looks equally clean forever.
 *
 * A token is re-checked at roughly 24h, 72h and 7d after launch. Once
 * it has been settled — rugged, or alive at the seven-day mark — it
 * drops out of the queue.
 */

import { getDb } from "../memory/db.js";
import { updateTokenStatus } from "../memory/record.js";
import { createLogger } from "../utils/logger.js";
import { fetchTokenHealth } from "./price.source.js";

const log = createLogger("followup");

const HOUR = 3600 * 1000;
export const CHECKPOINTS_H = [24, 72, 168];   // 1d, 3d, 7d

// A token counts as dead when both of these collapse. Either alone is
// noise: price can halve on a bad day, and liquidity can be migrated.
const DEAD_PRICE_DROP = 0.90;     // 90% below its peak
const DEAD_LIQUIDITY_USD = 2_000;


/** Tokens that are due for their next observation. */
export function dueTokens(now = Date.now(), limit = 200) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT address, chain, launched_at, peak_price_usd, check_count,
              last_checked_at, current_status
         FROM tokens
        WHERE current_status = 'live'
        ORDER BY launched_at ASC
        LIMIT ?`,
    )
    .all(limit * 4);

  const due = [];
  for (const t of rows) {
    const ageH = (now - t.launched_at) / HOUR;
    const nextIdx = t.check_count || 0;
    if (nextIdx >= CHECKPOINTS_H.length) continue;      // already settled
    if (ageH < CHECKPOINTS_H[nextIdx]) continue;        // not yet
    due.push({ ...t, ageH, checkpoint: CHECKPOINTS_H[nextIdx] });
    if (due.length >= limit) break;
  }
  return due;
}


/**
 * Decide what a health reading means.
 * Kept separate from the I/O so it can be tested without a network.
 */
export function classify(health, token, ageH) {
  if (!health || health.priceUsd == null) {
    // No price feed at all usually means the pair is gone.
    return ageH >= 24 ? "rugged" : "live";
  }

  const peak = Math.max(token.peak_price_usd || 0, health.priceUsd);
  const drop = peak > 0 ? 1 - health.priceUsd / peak : 0;
  const thin = (health.liquidityUsd ?? Infinity) < DEAD_LIQUIDITY_USD;

  if (drop >= DEAD_PRICE_DROP && thin) return "rugged";
  if (thin && ageH >= 72) return "abandoned";
  if (ageH >= CHECKPOINTS_H[CHECKPOINTS_H.length - 1]) return "alive";
  return "live";
}


function recordObservation(token, health, ageH, status) {
  const db = getDb();
  db.prepare(
    `INSERT INTO token_observations
       (token_address, observed_at, age_hours, status, price_usd, liquidity_usd)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    token.address,
    Date.now(),
    Number(ageH.toFixed(2)),
    status,
    health?.priceUsd ?? null,
    health?.liquidityUsd ?? null,
  );

  db.prepare(
    `UPDATE tokens
        SET last_checked_at = ?,
            check_count = COALESCE(check_count, 0) + 1,
            current_price_usd = ?,
            peak_price_usd = MAX(COALESCE(peak_price_usd, 0), ?)
      WHERE address = ?`,
  ).run(Date.now(), health?.priceUsd ?? null, health?.priceUsd ?? 0, token.address);
}


/**
 * Run one pass. Returns a summary so the CLI and the API can report it.
 */
export async function runFollowup({ limit = 200, dryRun = false } = {}) {
  const now = Date.now();
  const due = dueTokens(now, limit);

  const summary = { checked: 0, rugged: 0, alive: 0, abandoned: 0, stillLive: 0,
                    errors: 0, dryRun };

  if (due.length === 0) {
    log.info("Nothing due");
    return summary;
  }

  log.info(`${due.length} token(s) due for follow-up`);

  for (const token of due) {
    try {
      const health = await fetchTokenHealth(token.address, token.chain);
      const status = classify(health, token, token.ageH);
      summary.checked++;

      const short = token.address.slice(0, 10) + "…";
      const price = health?.priceUsd != null ? `$${health.priceUsd}` : "no feed";

      if (dryRun) {
        log.info(`  [dry] ${short} @${token.checkpoint}h → ${status} (${price})`);
      } else {
        recordObservation(token, health, token.ageH, status);
        if (status !== "live") {
          // this is the call that finally moves deployer reputation
          updateTokenStatus(token.address, status, health?.priceUsd ?? null);
        }
        log.info(`  ${short} @${token.checkpoint}h → ${status} (${price})`);
      }

      if (status === "rugged") summary.rugged++;
      else if (status === "alive") summary.alive++;
      else if (status === "abandoned") summary.abandoned++;
      else summary.stillLive++;
    } catch (err) {
      summary.errors++;
      log.warn(`  ${token.address.slice(0, 10)}… failed: ${err.message}`);
    }
  }

  log.info(
    `Done — ${summary.checked} checked, ${summary.rugged} rugged, ` +
    `${summary.alive} alive, ${summary.abandoned} abandoned`,
  );
  return summary;
}


/**
 * Keep running on an interval. Used by the server so a long-lived
 * process closes its own loop without a cron entry.
 */
export function startFollowupLoop({ intervalMinutes = 30, limit = 200 } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;                 // never overlap passes
    running = true;
    try {
      await runFollowup({ limit });
    } catch (err) {
      log.error(`Follow-up pass failed: ${err.message}`);
    } finally {
      running = false;
    }
  };

  tick();
  const handle = setInterval(tick, intervalMinutes * 60 * 1000);
  log.info(`Follow-up loop started — every ${intervalMinutes} min`);
  return () => clearInterval(handle);
}
