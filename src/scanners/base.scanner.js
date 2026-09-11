import { ethers } from "ethers";
import { createLogger } from "../utils/logger.js";
import { BASE_CHAIN_ID } from "../utils/constants.js";

const log = createLogger("base-scanner");

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function owner() view returns (address)",
];

const DANGEROUS_SELECTORS = {
  "0x8456cb59": "pause()",
  "0x3f4ba83a": "unpause()",
  "0x44337ea1": "blacklist(address)",
  "0x40c10f19": "mint(address,uint256)",
};

/**
 * Scan a token on Base (Coinbase L2, OP Stack).
 * Same check structure as Solana/Robinhood scanners.
 */
export async function scanBaseToken(tokenAddress, rpcUrl) {
  const provider = new ethers.JsonRpcProvider(rpcUrl, {
    chainId: BASE_CHAIN_ID, name: "base",
  });

  log.info(`Scanning ${tokenAddress} on Base`);

  const results = {
    chain: "base", mint: tokenAddress, timestamp: Date.now(),
    mintAuthorityRevoked: false, freezeAuthorityRevoked: false,
    topHolderPercent: 1.0, bundleDetected: false,
    lpBurnPercent: 0, metadataWarnings: [], details: {},
  };

  try {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    // ── 1. Basic info ──
    const [name, symbol, totalSupply, decimals] = await Promise.all([
      token.name().catch(() => "Unknown"),
      token.symbol().catch(() => "???"),
      token.totalSupply().catch(() => 0n),
      token.decimals().catch(() => 18),
    ]);

    results.details.name = name;
    results.details.symbol = symbol;
    results.details.supply = totalSupply.toString();
    results.details.decimals = decimals;
    log.info(`  Token: ${name} (${symbol})`);

    // ── 2. Owner check ──
    let owner = null;
    try {
      owner = await token.owner();
      results.mintAuthorityRevoked = owner === ethers.ZeroAddress;
    } catch {
      results.mintAuthorityRevoked = true; // no owner() = renounced
    }
    log.info(`  Owner: ${owner || "renounced"} → ${results.mintAuthorityRevoked ? "REVOKED ✓" : "ACTIVE ✗"}`);

    // ── 3. Dangerous functions (bytecode scan) ──
    const bytecode = await provider.getCode(tokenAddress);
    const foundDangerous = [];
    for (const [sel, name] of Object.entries(DANGEROUS_SELECTORS)) {
      if (bytecode.includes(sel.slice(2))) foundDangerous.push(name);
    }

    results.freezeAuthorityRevoked = !foundDangerous.some(
      f => f.includes("pause") || f.includes("blacklist")
    );

    if (foundDangerous.includes("mint(address,uint256)") && !results.mintAuthorityRevoked) {
      results.mintAuthorityRevoked = false;
    }

    if (foundDangerous.length > 0) {
      log.info(`  Dangerous functions: ${foundDangerous.join(", ")}`);
      results.metadataWarnings.push(`Has: ${foundDangerous.join(", ")}`);
    }

    // ── 4. Top holders (check deployer + known addresses) ──
    if (totalSupply > 0n) {
      const addressesToCheck = [owner].filter(Boolean);
      let knownHoldings = 0n;
      const holderDetails = [];

      for (const addr of addressesToCheck) {
        try {
          const bal = await token.balanceOf(addr);
          if (bal > 0n) {
            knownHoldings += bal;
            holderDetails.push({
              address: addr,
              amount: bal.toString(),
              percent: ((Number(bal) / Number(totalSupply)) * 100).toFixed(2) + "%",
            });
          }
        } catch {}
      }

      results.topHolderPercent = Number(knownHoldings) / Number(totalSupply);
      results.details.topHolders = holderDetails;
      log.info(`  Known holders: ${(results.topHolderPercent * 100).toFixed(1)}%`);
    }

    // ── 5. Bundle detection ──
    results.bundleDetected = await detectEvmBundles(provider, tokenAddress);
    log.info(`  Bundle: ${results.bundleDetected ? "YES ✗" : "NO ✓"}`);

    // ── 6. LP status ──
    // Clanker creates standard DEX pairs — LP exists if token is trading.
    // Check if there's a Uniswap/Aerodrome pool with liquidity.
    results.lpBurnPercent = 0.5; // TODO: check Aerodrome/Uniswap pool LP lock

    // ── 7. Metadata flags ──
    const realSupply = Number(totalSupply) / 10 ** decimals;
    if (realSupply > 1e15) results.metadataWarnings.push("Extremely large supply");
    if (name.length > 50) results.metadataWarnings.push("Suspiciously long name");
    if (/test|scam|rug|fake/i.test(name + symbol)) {
      results.metadataWarnings.push("Suspicious keywords in name");
    }

  } catch (err) {
    log.error(`Scan failed: ${err.message}`);
    results.metadataWarnings.push(`Scan error: ${err.message}`);
  }

  return results;
}

async function detectEvmBundles(provider, tokenAddress) {
  try {
    const currentBlock = await provider.getBlockNumber();
    const filter = {
      address: tokenAddress,
      topics: [ethers.id("Transfer(address,address,uint256)")],
      fromBlock: currentBlock - 1000,
      toBlock: currentBlock,
    };
    const logs = await provider.getLogs(filter);
    if (logs.length < 3) return false;

    const blockCounts = {};
    for (const l of logs) blockCounts[l.blockNumber] = (blockCounts[l.blockNumber] || 0) + 1;
    return Object.values(blockCounts).some(c => c >= 5);
  } catch { return false; }
}
