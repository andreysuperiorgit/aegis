import { Connection, PublicKey } from "@solana/web3.js";
import { createLogger } from "../utils/logger.js";
import { BUNDLE_TIME_WINDOW_SLOTS } from "../utils/constants.js";
import { enrichScan, recordToken, recordBundle } from "../memory/index.js";

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
    deployer: null, buyers: [],
    memory: { adjustment: 0, reasons: [] },
  };

  try {
    const mintInfo = await connection.getParsedAccountInfo(mint);
    const mintData = mintInfo?.value?.data?.parsed?.info;
    if (!mintData) { results.metadataWarnings.push("Mint account not found"); return results; }

    results.mintAuthorityRevoked = mintData.mintAuthority === null;
    results.freezeAuthorityRevoked = mintData.freezeAuthority === null;
    results.details.supply = mintData.supply;
    results.details.decimals = mintData.decimals;
    results.deployer = mintData.mintAuthority || mintData.freezeAuthority || null;

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
      // Capture first-buyer wallets for memory
      results.buyers = topHolders.value.slice(0, 10).map(h => h.address.toBase58());
    }
    log.info(`  Top 10 holders: ${(results.topHolderPercent * 100).toFixed(1)}%`);

    const bundleInfo = await detectBundles(connection, mint);
    results.bundleDetected = bundleInfo.detected;
    if (bundleInfo.detected && bundleInfo.wallets.length > 0) {
      try {
        recordBundle(mintAddress, bundleInfo.wallets, bundleInfo.blockNumber, "solana");
      } catch (e) { log.warn(`  Memory bundle write failed: ${e.message}`); }
    }
    log.info(`  Bundle detected: ${results.bundleDetected ? "YES ✗" : "NO ✓"}`);

    results.lpBurnPercent = 0.5; // TODO: query Raydium pool accounts
    results.metadataWarnings = checkMetadataFlags(mintData);

    // [SECOND BRAIN] Enrich with historical context
    try {
      const memory = enrichScan({
        address: mintAddress,
        chain: "solana",
        deployer: results.deployer,
        buyers: results.buyers,
      });
      results.memory = memory;
      if (memory.adjustment !== 0) {
        log.info(`  Second Brain: ${memory.adjustment > 0 ? "+" : ""}${memory.adjustment} — ${memory.reasons.join("; ")}`);
      }
    } catch (e) {
      log.warn(`  Second Brain lookup failed: ${e.message}`);
    }
  } catch (err) {
    log.error(`Scan failed: ${err.message}`);
    results.metadataWarnings.push(`Scan error: ${err.message}`);
  }

  // [SECOND BRAIN] Record what we saw for future scans
  try {
    recordToken({
      address: mintAddress,
      chain: "solana",
      deployer: results.deployer,
      score: null,   // score computed by score.js after this returns
      verdict: null,
    });
  } catch (e) { log.warn(`  Memory token write failed: ${e.message}`); }

  return results;
}

async function detectBundles(connection, mint) {
  try {
    const sigs = await connection.getSignaturesForAddress(mint, { limit: 20 });
    if (sigs.length < 3) return { detected: false, wallets: [], blockNumber: null };
    const firstSlot = sigs[sigs.length - 1].slot;
    const bundleSigs = sigs.filter(s => s.slot <= firstSlot + BUNDLE_TIME_WINDOW_SLOTS);
    if (bundleSigs.length < 5) return { detected: false, wallets: [], blockNumber: firstSlot };

    // Extract wallet addresses from the bundle signatures
    const wallets = [];
    for (const s of bundleSigs.slice(0, 10)) {
      try {
        const tx = await connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
        const signer = tx?.transaction?.message?.accountKeys?.find(k => k.signer)?.pubkey?.toBase58();
        if (signer && !wallets.includes(signer)) wallets.push(signer);
      } catch {}
    }
    return { detected: true, wallets, blockNumber: firstSlot };
  } catch { return { detected: false, wallets: [], blockNumber: null }; }
}

function checkMetadataFlags(mintData) {
  const warnings = [];
  const realSupply = Number(BigInt(mintData.supply)) / 10 ** mintData.decimals;
  if (realSupply > 1e15) warnings.push("Extremely large supply");
  if (mintData.decimals === 0) warnings.push("Zero decimals");
  return warnings;
}
