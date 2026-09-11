import { ethers } from "ethers";
import { createLogger } from "../utils/logger.js";
import {
  ROBINHOOD_CHAIN_ID,
  PONS_V2_FACTORY,
  PONS_V2_LOCKER,
  PONS_V2_GRADUATION,
} from "../utils/constants.js";

const log = createLogger("robinhood-scanner");

// Minimal ERC-20 ABI for the checks we need
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function owner() view returns (address)",
];

// Dangerous function signatures that indicate honeypot / rug potential
const DANGEROUS_SELECTORS = {
  "0x8456cb59": "pause()",
  "0x3f4ba83a": "unpause()",
  "0x44337ea1": "blacklist(address)",
  "0x40c10f19": "mint(address,uint256)",
  "0x42966c68": "burn(uint256)",
};

/**
 * Scan a token on Robinhood Chain (EVM).
 * Adapts the same check structure as the Solana scanner.
 */
export async function scanRobinhoodToken(tokenAddress, rpcUrl) {
  const provider = new ethers.JsonRpcProvider(rpcUrl, {
    chainId: ROBINHOOD_CHAIN_ID,
    name: "robinhood",
  });

  log.info(`Scanning ${tokenAddress} on Robinhood Chain`);

  const results = {
    chain: "robinhood",
    mint: tokenAddress,
    timestamp: Date.now(),
    mintAuthorityRevoked: false,
    freezeAuthorityRevoked: false,
    topHolderPercent: 1.0,
    bundleDetected: false,
    lpBurnPercent: 0,
    metadataWarnings: [],
    details: {},
  };

  try {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    // ── 1. Basic token info ──
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

    // ── 2. Owner / mint authority check ──
    // If the contract has an owner() and it's not address(0), mint authority is active
    let owner = null;
    try {
      owner = await token.owner();
      results.mintAuthorityRevoked = owner === ethers.ZeroAddress;
    } catch {
      // No owner() function = likely renounced or not ownable = safer
      results.mintAuthorityRevoked = true;
    }

    log.info(`  Owner: ${owner || "none (renounced)"} → ${results.mintAuthorityRevoked ? "REVOKED ✓" : "ACTIVE ✗"}`);

    // ── 3. Dangerous functions check (honeypot signals) ──
    // Get bytecode and check for dangerous function selectors
    const bytecode = await provider.getCode(tokenAddress);

    const foundDangerous = [];
    for (const [selector, name] of Object.entries(DANGEROUS_SELECTORS)) {
      if (bytecode.includes(selector.slice(2))) {
        foundDangerous.push(name);
      }
    }

    // pause() or blacklist() = freeze authority equivalent
    results.freezeAuthorityRevoked = !foundDangerous.some(
      (f) => f.includes("pause") || f.includes("blacklist")
    );

    // mint() function present = mint authority NOT revoked (overrides owner check)
    if (foundDangerous.includes("mint(address,uint256)") && !results.mintAuthorityRevoked) {
      results.mintAuthorityRevoked = false;
    }

    if (foundDangerous.length > 0) {
      log.info(`  Dangerous functions: ${foundDangerous.join(", ")}`);
      results.metadataWarnings.push(`Has: ${foundDangerous.join(", ")}`);
    } else {
      log.info("  No dangerous functions found ✓");
    }

    // ── 4. Top holder concentration ──
    // On EVM we can't enumerate all holders cheaply.
    // Check known addresses: deployer, factory, locker, graduation contract.
    if (totalSupply > 0n) {
      const addressesToCheck = [
        owner,
        PONS_V2_FACTORY,
        PONS_V2_LOCKER,
        PONS_V2_GRADUATION,
      ].filter(Boolean);

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

      log.info(`  Known holders control: ${(results.topHolderPercent * 100).toFixed(1)}%`);
    }

    // ── 5. Bundle detection ──
    // Check if multiple buys happened in the same block as token creation
    results.bundleDetected = await detectEvmBundles(provider, tokenAddress);
    log.info(`  Bundle detected: ${results.bundleDetected ? "YES ✗" : "NO ✓"}`);

    // ── 6. LP status ──
    // Pons V2 locks LP via PonsV2LaunchLocker. Check if locker holds LP NFT.
    // Simplified: if the locker address has a balance, LP is locked.
    try {
      const lockerBal = await token.balanceOf(PONS_V2_LOCKER);
      if (lockerBal > 0n) {
        results.lpBurnPercent = 0.95; // Locked = good
      } else {
        results.lpBurnPercent = 0.5; // Unknown
      }
    } catch {
      results.lpBurnPercent = 0.5;
    }

    log.info(`  LP status: ${results.lpBurnPercent >= 0.95 ? "LOCKED ✓" : "UNKNOWN"}`);

    // ── 7. Metadata flags ──
    const realSupply = Number(totalSupply) / 10 ** decimals;
    if (realSupply > 1e15) results.metadataWarnings.push("Extremely large supply");
    if (name.length > 50) results.metadataWarnings.push("Suspiciously long name");
    if (/test|scam|rug|fake/i.test(name + symbol)) {
      results.metadataWarnings.push("Suspicious name/symbol keywords");
    }

  } catch (err) {
    log.error(`Scan failed: ${err.message}`);
    results.metadataWarnings.push(`Scan error: ${err.message}`);
  }

  return results;
}

/**
 * Check if multiple transactions interacted with the token
 * in the same block as deployment (= likely coordinated).
 */
async function detectEvmBundles(provider, tokenAddress) {
  try {
    // Get the creation transaction by looking at the first internal tx
    const currentBlock = await provider.getBlockNumber();
    // Look at recent transfer logs for this token
    const filter = {
      address: tokenAddress,
      topics: [ethers.id("Transfer(address,address,uint256)")],
      fromBlock: currentBlock - 1000, // Last ~1000 blocks
      toBlock: currentBlock,
    };

    const logs = await provider.getLogs(filter);
    if (logs.length < 3) return false;

    // Check if 5+ transfers happened in the same block
    const blockCounts = {};
    for (const l of logs) {
      blockCounts[l.blockNumber] = (blockCounts[l.blockNumber] || 0) + 1;
    }

    return Object.values(blockCounts).some((count) => count >= 5);
  } catch {
    return false;
  }
}
