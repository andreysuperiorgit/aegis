/**
 * AEGIS Memory — schema migrations.
 *
 * The memory database is meant to live for months. Once a deployer has
 * a year of history in it, throwing the file away to change a column is
 * not an option — so every schema change goes through here.
 *
 * Each migration is applied once, in order, inside a transaction, and
 * recorded in `schema_migrations`. Adding one means appending to the
 * list below; never edit a migration that has already shipped.
 */

import { getDb } from "./db.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("memory-migrate");

const MIGRATIONS = [
  {
    version: 1,
    name: "baseline",
    // The original four tables. Written as IF NOT EXISTS so databases
    // created before migrations existed adopt version 1 cleanly instead
    // of failing on tables that are already there.
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS deployers (
          address       TEXT PRIMARY KEY,
          chain         TEXT NOT NULL,
          first_seen    INTEGER NOT NULL,
          last_seen     INTEGER NOT NULL,
          tokens_total  INTEGER DEFAULT 0,
          tokens_rugged INTEGER DEFAULT 0,
          tokens_alive  INTEGER DEFAULT 0,
          reputation    INTEGER DEFAULT 50
        );
        CREATE TABLE IF NOT EXISTS wallets (
          address      TEXT PRIMARY KEY,
          chain        TEXT NOT NULL,
          first_seen   INTEGER NOT NULL,
          bundle_count INTEGER DEFAULT 0,
          smart_money  INTEGER DEFAULT 0,
          known_rugger INTEGER DEFAULT 0,
          reputation   INTEGER DEFAULT 50,
          notes        TEXT
        );
        CREATE TABLE IF NOT EXISTS tokens (
          address           TEXT PRIMARY KEY,
          chain             TEXT NOT NULL,
          deployer          TEXT,
          launched_at       INTEGER NOT NULL,
          first_score       INTEGER,
          verdict           TEXT,
          sniped            INTEGER DEFAULT 0,
          current_status    TEXT DEFAULT 'live',
          died_at           INTEGER,
          peak_price_usd    REAL,
          current_price_usd REAL,
          FOREIGN KEY(deployer) REFERENCES deployers(address)
        );
        CREATE TABLE IF NOT EXISTS wallet_bundles (
          token_address  TEXT NOT NULL,
          wallet_address TEXT NOT NULL,
          block_number   INTEGER,
          PRIMARY KEY (token_address, wallet_address)
        );
      `);
    },
  },
  {
    version: 2,
    name: "followup scheduling",
    // The follow-up job needs to know when a token was last looked at
    // and how many times, otherwise it either re-checks everything on
    // every pass or loses track of what it has already settled.
    up: (db) => {
      addColumn(db, "tokens", "last_checked_at", "INTEGER");
      addColumn(db, "tokens", "check_count", "INTEGER DEFAULT 0");
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_tokens_followup
          ON tokens(current_status, last_checked_at);
      `);
    },
  },
  {
    version: 3,
    name: "outcome history",
    // One row per observation, so a token that limps before it dies is
    // visible as a trajectory rather than a single final flag.
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS token_observations (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          token_address TEXT NOT NULL,
          observed_at   INTEGER NOT NULL,
          age_hours     REAL,
          status        TEXT NOT NULL,
          price_usd     REAL,
          liquidity_usd REAL,
          note          TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_obs_token
          ON token_observations(token_address, observed_at DESC);
      `);
    },
  },
  {
    version: 4,
    name: "wallet linkage",
    // Which deployers a wallet has funded or bought into. This is the
    // edge set the dashboards draw as "shared crew"; deriving it from
    // wallet_bundles on every read was getting expensive.
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS wallet_deployers (
          wallet_address   TEXT NOT NULL,
          deployer_address TEXT NOT NULL,
          chain            TEXT NOT NULL,
          times_seen       INTEGER DEFAULT 1,
          first_seen       INTEGER NOT NULL,
          last_seen        INTEGER NOT NULL,
          PRIMARY KEY (wallet_address, deployer_address)
        );
        CREATE INDEX IF NOT EXISTS idx_wd_deployer
          ON wallet_deployers(deployer_address);
      `);
    },
  },
];


/** Add a column only if it is missing, so re-running is harmless. */
function addColumn(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}


function ensureMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);
}


export function currentVersion(db = getDb()) {
  ensureMigrationTable(db);
  const row = db
    .prepare("SELECT MAX(version) AS v FROM schema_migrations")
    .get();
  return row?.v || 0;
}


export function latestVersion() {
  return MIGRATIONS[MIGRATIONS.length - 1].version;
}


/**
 * Bring the database up to the newest schema.
 * Safe to call on every boot — already-applied migrations are skipped.
 */
export function migrate({ quiet = false } = {}) {
  const db = getDb();
  ensureMigrationTable(db);

  const from = currentVersion(db);
  const pending = MIGRATIONS.filter((m) => m.version > from);

  if (pending.length === 0) {
    if (!quiet) log.info(`Memory schema up to date (v${from})`);
    return { from, to: from, applied: [] };
  }

  const applied = [];
  for (const m of pending) {
    const run = db.transaction(() => {
      m.up(db);
      db.prepare(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
      ).run(m.version, m.name, Date.now());
    });
    run();
    applied.push(m);
    if (!quiet) log.info(`  applied v${m.version} — ${m.name}`);
  }

  const to = currentVersion(db);
  if (!quiet) log.info(`Memory schema v${from} → v${to}`);
  return { from, to, applied: applied.map((m) => m.version) };
}


export function migrationStatus() {
  const db = getDb();
  ensureMigrationTable(db);
  const done = db
    .prepare("SELECT version, name, applied_at FROM schema_migrations ORDER BY version")
    .all();
  const doneVersions = new Set(done.map((r) => r.version));
  return {
    current: currentVersion(db),
    latest: latestVersion(),
    applied: done,
    pending: MIGRATIONS.filter((m) => !doneVersions.has(m.version))
      .map((m) => ({ version: m.version, name: m.name })),
  };
}
