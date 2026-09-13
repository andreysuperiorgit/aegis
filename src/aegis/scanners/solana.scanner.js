import { Connection, PublicKey } from "@solana/web3.js";
import { createLogger } from "../utils/logger.js";
import { BUNDLE_TIME_WINDOW_SLOTS } from "../utils/constants.js";

const log = createLogger("solana-scanner");

export async function scanSolanaToken(mintAddress, rpcUrl) {
  const connection = new Connection(rpcUrl, "confirmed");
  const mint = new PublicKey(mintAddress);
  log.info(`Scanning ${mintAddress}`);

  const results = {
    chain: "solana", mint: mintAddress, timestamp: Date.now(),
    mintAuthorityRevoked: false, freezeAuthorityRevoked: false,
    topHolderPercent: 1.0, bundleDetected: false,
    lpBurnPercent: 0, metadataWarnings: [], details: {},
  };

  try {
    const mintInfo = await connection.getParsedAccountInfo(mint);
    const mintData = mintInfo?.value?.data?.parsed?.info;
    if (!mintData) { results.metadataWarnings.push("Mint account not found"); return results; }

    results.mintAuthorityRevoked = mintData.mintAuthority === null;
    results.freezeAuthorityRevoked = mintData.freezeAuthority === null;
    results.details.supply = mintData.supply;
    results.details.decimals = mintData.decimals;

    log.info(`  Mint authority: ${results.mintAuthorityRevoked ? "REVOKED ✓" : "ACTIVE ✗"}`);
    log.info(`  Freeze authority: ${results.freezeAuthorityRevoked ? "REVOKED ✓" : "ACTIVE ✗"}`);

    const topHolders = await connection.getTokenLargestAccounts(mint);
    if (topHolders?.value?.length > 0) {
      const totalSupply = BigInt(mintData.supply);
      if (totalSupply > 0n) {
        const top10Sum = topHolders.value.slice(0, 10).reduce((sum, h) => sum + BigInt(h.amount), 0n);
        results.topHolderPercent = Number(top10Sum) / Number(totalSupply);
      }
      results.details.topHolders = topHolders.value.slice(0, 10).map((h) => ({
        address: h.address.toBase58(), amount: h.amount,
        percent: totalSupply > 0n ? ((Number(BigInt(h.amount)) / Number(totalSupply)) * 100).toFixed(2) + "%" : "0%",
      }));
    }
    log.info(`  Top 10 holders: ${(results.topHolderPercent * 100).toFixed(1)}%`);

    results.bundleDetected = await detectBundles(connection, mint);
    log.info(`  Bundle detected: ${results.bundleDetected ? "YES ✗" : "NO ✓"}`);

    results.lpBurnPercent = 0.5; // TODO: query Raydium pool accounts
    results.metadataWarnings = checkMetadataFlags(mintData);
  } catch (err) {
    log.error(`Scan failed: ${err.message}`);
    results.metadataWarnings.push(`Scan error: ${err.message}`);
  }
  return results;
}

async function detectBundles(connection, mint) {
  try {
    const sigs = await connection.getSignaturesForAddress(mint, { limit: 20 });
    if (sigs.length < 3) return false;
    const firstSlot = sigs[sigs.length - 1].slot;
    return sigs.filter(s => s.slot <= firstSlot + BUNDLE_TIME_WINDOW_SLOTS).length >= 5;
  } catch { return false; }
}

function checkMetadataFlags(mintData) {
  const warnings = [];
  const realSupply = Number(BigInt(mintData.supply)) / 10 ** mintData.decimals;
  if (realSupply > 1e15) warnings.push("Extremely large supply");
  if (mintData.decimals === 0) warnings.push("Zero decimals");
  return warnings;
}
