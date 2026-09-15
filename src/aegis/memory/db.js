/**
 * AEGIS Memory — SQLite backing store.
 *
 * Persists what AEGIS has seen so every future scan is smarter:
 * deployers with history, wallets we've flagged, tokens that lived or died.
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH =
  process.env.AEGIS_MEMORY_PATH ||
  path.join(__dirname, "../../../data/memory.db");

let db = null;

export function initMemory() {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

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
      address        TEXT PRIMARY KEY,
      chain          TEXT NOT NULL,
      first_seen     INTEGER NOT NULL,
      bundle_count   INTEGER DEFAULT 0,
      smart_money    INTEGER DEFAULT 0,
      known_rugger   INTEGER DEFAULT 0,
      reputation     INTEGER DEFAULT 50,
      notes          TEXT
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
      token_address   TEXT NOT NULL,
      wallet_address  TEXT NOT NULL,
      block_number    INTEGER,
      PRIMARY KEY (token_address, wallet_address)
    );

    CREATE INDEX IF NOT EXISTS idx_deployers_chain ON deployers(chain);
    CREATE INDEX IF NOT EXISTS idx_wallets_chain ON wallets(chain);
    CREATE INDEX IF NOT EXISTS idx_tokens_deployer ON tokens(deployer);
    CREATE INDEX IF NOT EXISTS idx_tokens_launched ON tokens(launched_at DESC);
  `);

  return db;
}

export function getDb() {
  if (!db) initMemory();
  return db;
}

export function closeMemory() {
  if (db) {
    db.close();
    db = null;
  }
}
