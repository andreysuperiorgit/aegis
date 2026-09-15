#!/usr/bin/env node
/**
 * memory-stats — print what the Second Brain has learned so far.
 *
 * Usage:
 *   npm run memory:stats
 *   npm run memory:stats -- --top-ruggers 20
 */

import { initMemory, getDb, getStats, closeMemory } from "../src/aegis/memory/index.js";

const args = process.argv.slice(2);
const topN = args.includes("--top-ruggers")
  ? parseInt(args[args.indexOf("--top-ruggers") + 1], 10) || 10
  : 10;

initMemory();
const db = getDb();
const stats = getStats();

const clean = "\x1b[36m";
const dim = "\x1b[90m";
const red = "\x1b[31m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const reset = "\x1b[0m";
const bold = "\x1b[1m";

console.log();
console.log(`${bold}${clean}AEGIS · Second Brain${reset}`);
console.log(`${dim}${"─".repeat(50)}${reset}`);
console.log(`  tokens seen:        ${bold}${stats.tokensSeen}${reset}`);
console.log(`  deployers tracked:  ${bold}${stats.deployersTracked}${reset}`);
console.log(`  wallets flagged:    ${bold}${stats.walletsFlagged}${reset}`);
console.log();

const topRuggers = db
  .prepare(
    `SELECT address, chain, tokens_total, tokens_rugged, reputation
     FROM deployers
     WHERE tokens_total >= 2 AND tokens_rugged >= 1
     ORDER BY tokens_rugged DESC, tokens_total DESC
     LIMIT ?`,
  )
  .all(topN);

if (topRuggers.length > 0) {
  console.log(`${bold}${red}Top ruggers${reset}`);
  console.log(`${dim}${"─".repeat(50)}${reset}`);
  for (const d of topRuggers) {
    const rate = ((d.tokens_rugged / d.tokens_total) * 100).toFixed(0);
    const short = d.address.slice(0, 10) + "..." + d.address.slice(-6);
    console.log(`  ${red}${short}${reset}  ${d.chain.padEnd(10)}  ${d.tokens_rugged}/${d.tokens_total} rugged  (${rate}%)`);
  }
  console.log();
}

const smartMoney = db
  .prepare(
    `SELECT address, chain, notes FROM wallets WHERE smart_money = 1 LIMIT 20`,
  )
  .all();

if (smartMoney.length > 0) {
  console.log(`${bold}${green}Smart money${reset}`);
  console.log(`${dim}${"─".repeat(50)}${reset}`);
  for (const w of smartMoney) {
    const short = w.address.slice(0, 10) + "..." + w.address.slice(-6);
    console.log(`  ${green}${short}${reset}  ${w.chain.padEnd(10)}  ${w.notes || ""}`);
  }
  console.log();
}

const knownRuggers = db
  .prepare(
    `SELECT address, chain, notes FROM wallets WHERE known_rugger = 1 LIMIT 20`,
  )
  .all();

if (knownRuggers.length > 0) {
  console.log(`${bold}${yellow}Known-rugger wallets${reset}`);
  console.log(`${dim}${"─".repeat(50)}${reset}`);
  for (const w of knownRuggers) {
    const short = w.address.slice(0, 10) + "..." + w.address.slice(-6);
    console.log(`  ${yellow}${short}${reset}  ${w.chain.padEnd(10)}  ${w.notes || ""}`);
  }
  console.log();
}

closeMemory();
