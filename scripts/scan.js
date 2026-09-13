#!/usr/bin/env node
/**
 * CLI scanner — scan a token from the command line.
 * Usage: node scripts/scan.js <chain> <address>
 * Example: node scripts/scan.js solana 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
 */
import "dotenv/config";
import { scanSolanaToken } from "../src/aegis/scanners/solana.scanner.js";
import { scanRobinhoodToken } from "../src/aegis/scanners/robinhood.scanner.js";
import { scanBaseToken } from "../src/aegis/scanners/base.scanner.js";
import { calculateScore } from "../src/aegis/utils/score.js";
import { analyzeWithGrok, isGrokEnabled } from "../src/aegis/ai/grok.js";

const [chain, address] = process.argv.slice(2);

if (!chain || !address) {
  console.log("Usage: node scripts/scan.js <chain> <address>");
  console.log("Chains: solana, robinhood, base");
  process.exit(1);
}

const scanners = {
  solana: (addr) => scanSolanaToken(addr, process.env.SOLANA_RPC_URL),
  robinhood: (addr) => scanRobinhoodToken(addr, process.env.ROBINHOOD_RPC_URL),
  base: (addr) => scanBaseToken(addr, process.env.BASE_RPC_URL),
};

if (!scanners[chain]) {
  console.error(`Unknown chain: ${chain}. Use: solana, robinhood, base`);
  process.exit(1);
}

const checks = await scanners[chain](address);
const result = calculateScore(checks);

console.log("\n══════════════════════════════════════");
console.log(`  AEGIS Scan — ${chain} — ${address.slice(0, 12)}...`);
console.log("══════════════════════════════════════\n");
console.log(`  Score:   ${result.score}/100`);
console.log(`  Verdict: ${result.verdict}\n`);
console.log("  Breakdown:");
for (const [key, val] of Object.entries(result.breakdown)) {
  console.log(`    ${key.padEnd(20)} ${val}`);
}

if (isGrokEnabled()) {
  console.log("\n  Grok AI analysis...");
  const grok = await analyzeWithGrok({ ...checks, ...result });
  if (grok) {
    console.log(`\n  ${grok.recommendation} (${grok.confidence})`);
    console.log(`  ${grok.analysis}`);
  }
}
console.log("");
