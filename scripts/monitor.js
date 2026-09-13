#!/usr/bin/env node
/**
 * Standalone monitor — watch new launches from the terminal.
 * Usage: node scripts/monitor.js <chain>
 */
import "dotenv/config";
import { SolanaMonitor } from "../src/aegis/monitors/solana.monitor.js";
import { RobinhoodMonitor } from "../src/aegis/monitors/robinhood.monitor.js";
import { BaseMonitor } from "../src/aegis/monitors/base.monitor.js";

const chain = process.argv[2] || "solana";

const monitors = {
  solana: () => new SolanaMonitor(process.env.SOLANA_WS_URL),
  robinhood: () => new RobinhoodMonitor(process.env.ROBINHOOD_WS_URL || process.env.ROBINHOOD_RPC_URL),
  base: () => new BaseMonitor(process.env.BASE_WS_URL || process.env.BASE_RPC_URL),
};

if (!monitors[chain]) {
  console.error(`Unknown chain: ${chain}`);
  process.exit(1);
}

const monitor = monitors[chain]();
monitor.on("newToken", (data) => {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] New token: ${data.token || data.signature || "?"}`);
});
monitor.on("error", (err) => console.error("Error:", err.message));

console.log(`Monitoring ${chain}... (Ctrl+C to stop)\n`);
await monitor.start();
