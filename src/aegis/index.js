import "dotenv/config";
import { createServer } from "./api/server.js";
import { SolanaMonitor } from "./monitors/solana.monitor.js";
import { RobinhoodMonitor } from "./monitors/robinhood.monitor.js";
import { BaseMonitor } from "./monitors/base.monitor.js";
import { createLogger } from "./utils/logger.js";
import { initMemory } from "./memory/index.js";
import { migrate } from "./memory/migrate.js";
import { startFollowupLoop } from "./jobs/followup.job.js";

const log = createLogger("main");
const PORT = process.env.PORT || 3001;

async function main() {
  log.info("═══════════════════════════════════════");
  log.info("  AEGIS — Multi-chain Scam Filter");
  log.info("  Solana · Robinhood Chain · Base");
  log.info("═══════════════════════════════════════");

  // The memory outlives any single run, so the schema is brought
  // forward before anything is allowed to write to it.
  initMemory();
  migrate();

  // Without this loop nothing ever records what happened to a scanned
  // token, so deployer reputation would stay flat forever.
  let stopFollowup = null;
  if (process.env.AEGIS_FOLLOWUP !== "off") {
    const every = parseInt(process.env.AEGIS_FOLLOWUP_MINUTES || "30", 10);
    stopFollowup = startFollowupLoop({ intervalMinutes: every });
  } else {
    log.warn("Follow-up loop: disabled (AEGIS_FOLLOWUP=off)");
  }

  let solanaMonitor = null;
  let robinhoodMonitor = null;
  let baseMonitor = null;

  if (process.env.SOLANA_WS_URL) {
    solanaMonitor = new SolanaMonitor(process.env.SOLANA_WS_URL);
    log.info("Solana monitor: configured (Pump.fun)");
  } else { log.warn("Solana monitor: no SOLANA_WS_URL, skipping"); }

  if (process.env.ROBINHOOD_RPC_URL) {
    robinhoodMonitor = new RobinhoodMonitor(
      process.env.ROBINHOOD_WS_URL || process.env.ROBINHOOD_RPC_URL
    );
    log.info("Robinhood Chain monitor: configured (Pons V2)");
  } else { log.warn("Robinhood monitor: no ROBINHOOD_RPC_URL, skipping"); }

  if (process.env.BASE_RPC_URL) {
    baseMonitor = new BaseMonitor(
      process.env.BASE_WS_URL || process.env.BASE_RPC_URL
    );
    log.info("Base monitor: configured (Clanker / Uniswap V3)");
  } else { log.warn("Base monitor: no BASE_RPC_URL, skipping"); }

  const { server } = createServer({ solanaMonitor, robinhoodMonitor, baseMonitor });

  server.listen(PORT, () => {
    log.info(`API server: http://localhost:${PORT}`);
    log.info(`WebSocket:  ws://localhost:${PORT}/ws`);
    log.info("───────────────────────────────────");
    log.info("Dashboard: http://localhost:3000");
  });

  if (process.env.SNIPER_ENABLED === "true") {
    log.warn("⚠️  SNIPER IS ENABLED — real funds will be used!");
  }

  process.on("SIGINT", async () => {
    log.info("Shutting down...");
    await solanaMonitor?.stop();
    await robinhoodMonitor?.stop();
    await baseMonitor?.stop();
    server.close();
    process.exit(0);
  });
}

main().catch((err) => { log.error("Fatal:", err.message); process.exit(1); });
