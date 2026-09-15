/**
 * AEGIS Memory — the second brain.
 *
 * Public API:
 *   import { enrichScan, recordToken } from "./memory/index.js";
 *
 *   // After running the 6 checks:
 *   const memory = enrichScan(scanResult);
 *   const finalScore = scanResult.baseScore + memory.adjustment;
 *   recordToken({ address, chain, deployer, score: finalScore, verdict });
 *
 * Environment:
 *   AEGIS_MEMORY_PATH — override SQLite file location (default: data/memory.db)
 */

export { initMemory, closeMemory, getDb } from "./db.js";
export { enrichScan, lookupDeployer, lookupWallets } from "./lookup.js";
export {
  recordToken,
  recordBundle,
  updateTokenStatus,
  flagWallet,
  getStats,
} from "./record.js";
