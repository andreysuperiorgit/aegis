import { createLogger } from "../utils/logger.js";

const log = createLogger("rugcheck");
const BASE_URL = "https://api.rugcheck.xyz/v1";

export async function getRugCheckReport(mintAddress) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (process.env.RUGCHECK_API_KEY) headers["X-API-KEY"] = process.env.RUGCHECK_API_KEY;

    const res = await fetch(`${BASE_URL}/tokens/${mintAddress}/report`, { headers });
    if (!res.ok) { log.warn(`RugCheck ${res.status} for ${mintAddress}`); return null; }

    const report = await res.json();
    return {
      score: report.score ?? null,
      verdict: report.verdict ?? null,
      risks: (report.risks || []).map((r) => ({
        name: r.name, level: r.level, description: r.description,
      })),
      sellable: report.sellable ?? null,
      topHolders: report.topHolders ?? [],
    };
  } catch (err) {
    log.error(`RugCheck failed: ${err.message}`);
    return null;
  }
}
