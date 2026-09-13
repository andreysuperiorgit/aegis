import { ethers } from "ethers";
import { createLogger } from "../utils/logger.js";
import { BASE_CHAIN_ID, UNISWAP_V3_FACTORY_BASE } from "../utils/constants.js";
import { EventEmitter } from "events";

const log = createLogger("base-monitor");

// Uniswap V3 Factory emits PoolCreated when a new trading pair is created
const FACTORY_ABI = [
  "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
];

/**
 * Monitors Base chain for new token launches.
 * Listens for PoolCreated events on Uniswap V3 Factory —
 * when a new pool is created, it likely means a new token launched.
 *
 * Clanker tokens create standard DEX pairs without bonding curves,
 * so we catch them through Uniswap pool creation events.
 */
export class BaseMonitor extends EventEmitter {
  constructor(rpcUrl) {
    super();
    this.rpcUrl = rpcUrl;
    this.provider = null;
    this.contract = null;
    this.running = false;
  }

  async start() {
    if (this.running) return;
    this.running = true;

    log.info("Starting Base monitor...");
    log.info(`Watching Uniswap V3 Factory: ${UNISWAP_V3_FACTORY_BASE}`);

    try {
      if (this.rpcUrl.startsWith("wss://")) {
        this.provider = new ethers.WebSocketProvider(this.rpcUrl);
      } else {
        this.provider = new ethers.JsonRpcProvider(this.rpcUrl, {
          chainId: BASE_CHAIN_ID, name: "base",
        });
      }

      const network = await this.provider.getNetwork();
      log.info(`Connected to Base, chain ID: ${network.chainId}`);

      this.contract = new ethers.Contract(
        UNISWAP_V3_FACTORY_BASE, FACTORY_ABI, this.provider
      );

      this.contract.on("PoolCreated", (token0, token1, fee, tickSpacing, pool, event) => {
        // Filter: one of the tokens should be WETH or a stablecoin
        // The other is the new memecoin
        const WETH = "0x4200000000000000000000000000000000000006";
        let newToken, quoteToken;

        if (token0.toLowerCase() === WETH.toLowerCase()) {
          newToken = token1;
          quoteToken = "WETH";
        } else if (token1.toLowerCase() === WETH.toLowerCase()) {
          newToken = token0;
          quoteToken = "WETH";
        } else {
          newToken = token0;
          quoteToken = token1;
        }

        log.info(`New Base pool: ${newToken} / ${quoteToken}`);
        this.emit("newToken", {
          chain: "base",
          token: newToken,
          quoteToken,
          pool,
          fee: Number(fee),
          blockNumber: event.log.blockNumber,
          txHash: event.log.transactionHash,
          timestamp: Date.now(),
        });
      });

      this.emit("status", { connected: true });
      log.info("Listening for new Base pool creation events");
    } catch (err) {
      log.error("Base monitor failed:", err.message);
      this.emit("error", err);
    }
  }

  async stop() {
    this.running = false;
    this.contract?.removeAllListeners();
    await this.provider?.destroy?.();
    this.emit("status", { connected: false });
    log.info("Base monitor stopped");
  }
}
