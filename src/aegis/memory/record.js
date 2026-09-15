/**
 * AEGIS Memory Recorder — writes what AEGIS learned back to the DB.
 */

import { getDb } from "./db.js";

export function recordToken({
  address,
  chain,
  deployer,
  score,
  verdict,
  sniped = false,
}) {
  const db = getDb();
  const now = Date.now();
  const dep = deployer ? deployer.toLowerCase() : null;

  // Deployer row must exist first — tokens.deployer is a foreign key.
  // Also guard against double-counting: only bump tokens_total when this
  // token is genuinely new, so a re-scan doesn't inflate the deployer's
  // history and skew their reputation.
  const alreadySeen = db
    .prepare("SELECT 1 FROM tokens WHERE address = ?")
    .get(address.toLowerCase());

  if (dep) {
    if (alreadySeen) {
      db.prepare(
        `INSERT INTO deployers (address, chain, first_seen, last_seen, tokens_total)
         VALUES (?, ?, ?, ?, 0)
         ON CONFLICT(address) DO UPDATE SET last_seen = excluded.last_seen`,
      ).run(dep, chain, now, now);
    } else {
      db.prepare(
        `INSERT INTO deployers (address, chain, first_seen, last_seen, tokens_total)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(address) DO UPDATE SET
           last_seen = excluded.last_seen,
           tokens_total = tokens_total + 1`,
      ).run(dep, chain, now, now);
    }
  }

  if (alreadySeen) {
    // Refresh the score/verdict but keep launch time and lifecycle status
    db.prepare(
      `UPDATE tokens SET first_score = ?, verdict = ?, sniped = ?
       WHERE address = ?`,
    ).run(score, verdict, sniped ? 1 : 0, address.toLowerCase());
  } else {
    db.prepare(
      `INSERT INTO tokens
       (address, chain, deployer, launched_at, first_score, verdict, sniped, current_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'live')`,
    ).run(address.toLowerCase(), chain, dep, now, score, verdict, sniped ? 1 : 0);
  }
}

export function recordBundle(tokenAddress, walletAddresses, blockNumber, chain) {
  const db = getDb();
  const now = Date.now();

  const insertBundle = db.prepare(
    "INSERT OR IGNORE INTO wallet_bundles (token_address, wallet_address, block_number) VALUES (?, ?, ?)",
  );

  const upsertWallet = db.prepare(
    `INSERT INTO wallets (address, chain, first_seen, bundle_count)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(address) DO UPDATE SET
       bundle_count = bundle_count + 1`,
  );

  const tx = db.transaction((wallets) => {
    for (const w of wallets) {
      insertBundle.run(tokenAddress.toLowerCase(), w.toLowerCase(), blockNumber);
      upsertWallet.run(w.toLowerCase(), chain, now);
    }
  });

  tx(walletAddresses);
}

/**
 * Called by the follow-up job that checks token health after 24h/72h/1w.
 */
export function updateTokenStatus(address, status, priceUsd = null) {
  const db = getDb();
  const now = Date.now();

  const token = db
    .prepare("SELECT * FROM tokens WHERE address = ?")
    .get(address.toLowerCase());

  if (!token) return;

  const wasAlive = token.current_status === "live";
  const isDead = status === "rugged" || status === "abandoned";

  db.prepare(
    `UPDATE tokens SET current_status = ?, died_at = ?, current_price_usd = ?
     WHERE address = ?`,
  ).run(status, isDead ? now : null, priceUsd, address.toLowerCase());

  if (token.deployer && wasAlive && isDead) {
    db.prepare(
      `UPDATE deployers
       SET tokens_rugged = tokens_rugged + 1,
           reputation = MAX(0, reputation - 5)
       WHERE address = ?`,
    ).run(token.deployer);
  } else if (token.deployer && wasAlive && status === "alive") {
    db.prepare(
      `UPDATE deployers
       SET tokens_alive = tokens_alive + 1,
           reputation = MIN(100, reputation + 2)
       WHERE address = ?`,
    ).run(token.deployer);
  }
}

export function flagWallet(address, chain, flag, note = "") {
  const db = getDb();
  const now = Date.now();
  const col = flag === "smart_money" ? "smart_money" : "known_rugger";

  db.prepare(
    `INSERT INTO wallets (address, chain, first_seen, ${col}, notes)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(address) DO UPDATE SET
       ${col} = 1,
       notes = COALESCE(notes || ' · ', '') || excluded.notes`,
  ).run(address.toLowerCase(), chain, now, note);
}

export function getStats() {
  const db = getDb();
  return {
    tokensSeen: db.prepare("SELECT COUNT(*) as c FROM tokens").get().c,
    deployersTracked: db.prepare("SELECT COUNT(*) as c FROM deployers").get().c,
    walletsFlagged: db
      .prepare("SELECT COUNT(*) as c FROM wallets WHERE bundle_count > 0 OR known_rugger = 1 OR smart_money = 1")
      .get().c,
  };
}
