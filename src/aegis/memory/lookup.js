/**
 * AEGIS Memory Lookup — the intelligence layer.
 *
 * Takes a scan result and enriches it with historical context.
 * Returns a memory adjustment (-25..+25) plus human-readable reasons.
 */

import { getDb } from "./db.js";

export function lookupDeployer(deployerAddress, chain) {
  if (!deployerAddress) return { adjustment: 0, reason: null, stats: null };

  const db = getDb();
  const dep = db
    .prepare("SELECT * FROM deployers WHERE address = ? AND chain = ?")
    .get(deployerAddress.toLowerCase(), chain);

  if (!dep || dep.tokens_total === 0) {
    return { adjustment: 0, reason: "new deployer, no history", stats: null };
  }

  const rugRate = dep.tokens_rugged / dep.tokens_total;
  let adjustment = 0;
  let reason = "";

  if (dep.tokens_total >= 3 && rugRate >= 0.66) {
    adjustment = -15;
    reason = `serial rugger: ${dep.tokens_rugged}/${dep.tokens_total} tokens died`;
  } else if (dep.tokens_total >= 5 && rugRate <= 0.2) {
    adjustment = +10;
    reason = `trusted deployer: ${dep.tokens_alive}/${dep.tokens_total} tokens still alive`;
  } else if (rugRate >= 0.5) {
    adjustment = -8;
    reason = `mixed history: ${dep.tokens_rugged}/${dep.tokens_total} rugged`;
  }

  return { adjustment, reason, stats: dep };
}

export function lookupWallets(walletAddresses, chain) {
  if (!walletAddresses || walletAddresses.length === 0) {
    return { adjustment: 0, reason: null, breakdown: null };
  }

  const db = getDb();
  const placeholders = walletAddresses.map(() => "?").join(",");
  const wallets = db
    .prepare(
      `SELECT * FROM wallets WHERE chain = ? AND address IN (${placeholders})`,
    )
    .all(chain, ...walletAddresses.map((a) => a.toLowerCase()));

  if (wallets.length === 0) {
    return {
      adjustment: 0,
      reason: "no known wallets in buyers",
      breakdown: null,
    };
  }

  const smartMoney = wallets.filter((w) => w.smart_money === 1).length;
  const knownRuggers = wallets.filter((w) => w.known_rugger === 1).length;

  let adjustment = 0;
  const parts = [];

  if (knownRuggers >= 2) {
    adjustment -= 10;
    parts.push(`${knownRuggers} known-rugger wallets in first buys`);
  }
  if (smartMoney >= 1) {
    adjustment += 10;
    parts.push(`${smartMoney} smart-money wallets bought in`);
  }

  return {
    adjustment,
    reason: parts.length > 0 ? parts.join("; ") : null,
    breakdown: { smartMoney, knownRuggers, totalKnown: wallets.length },
  };
}

/**
 * Full memory enrichment — called after the 6 checks are done.
 */
export function enrichScan(scanResult) {
  const { deployer, buyers = [], chain } = scanResult;

  const dep = lookupDeployer(deployer, chain);
  const wal = lookupWallets(buyers, chain);

  const total = dep.adjustment + wal.adjustment;
  const clamped = Math.max(-25, Math.min(25, total));

  // Only report what actually moved the score. A neutral lookup
  // ("new deployer, no history") explains nothing, and listing it beside
  // a -10 from wallets misattributes the cause.
  const reasons = [];
  const notes = [];
  for (const part of [dep, wal]) {
    if (!part.reason) continue;
    if (part.adjustment === 0) notes.push(part.reason);
    else reasons.push(part.reason);
  }

  return {
    adjustment: clamped,
    reasons,
    notes,
    deployer: dep.stats,
    wallets: wal.breakdown,
  };
}
