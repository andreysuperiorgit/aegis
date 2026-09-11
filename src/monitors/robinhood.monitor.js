import { ethers } from "ethers";
import { createLogger } from "../utils/logger.js";
import { PONS_V2_FACTORY, ROBINHOOD_CHAIN_ID } from "../utils/constants.js";
import { EventEmitter } from "events";

const log = createLogger("robinhood-monitor");

// Pons V2 Launch Factory emits TokenCreated when a new token is deployed
const FACTORY_ABI = [
  "event TokenCreated(address indexed token, address indexed creator, string name, string symbol)",
];

/**
 * Monitors Pons V2 on Robinhood Chain for new token launches.
 * Connects to the factory at 0x7ed598bc... and listens for TokenCreated events.
 *
 * Emits:
 *   "newToken" → { chain, token, creator, name, symbol, blockNumber, txHash }
 *   "error" / "status"
 */
export class RobinhoodMonitor extends EventEmitter {
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

    log.info("Starting Pons V2 monitor on Robinhood Chain...");
    log.info(`Factory: ${PONS_V2_FACTORY}`);

    try {
      if (this.rpcUrl.startsWith("wss://")) {
        this.provider = new ethers.WebSocketProvider(this.rpcUrl);
      } else {
        // Polling mode for HTTP RPC — checks every 4 seconds
        this.provider = new ethers.JsonRpcProvider(this.rpcUrl, {
          chainId: ROBINHOOD_CHAIN_ID, name: "robinhood",
        });
      }

      const network = await this.provider.getNetwork();
      log.info(`Connected to chain ID: ${network.chainId}`);

      this.contract = new ethers.Contract(PONS_V2_FACTORY, FACTORY_ABI, this.provider);

      this.contract.on("TokenCreated", (token, creator, name, symbol, event) => {
        log.info(`New Pons token: ${symbol} (${token})`);
        this.emit("newToken", {
          chain: "robinhood",
          token,
          creator,
          name,
          symbol,
          blockNumber: event.log.blockNumber,
          txHash: event.log.transactionHash,
          timestamp: Date.now(),
        });
      });

      this.emit("status", { connected: true });
      log.info("Listening for Pons V2 TokenCreated events");
    } catch (err) {
      log.error("Robinhood monitor failed:", err.message);
      this.emit("error", err);
    }
  }

  async stop() {
    this.running = false;
    this.contract?.removeAllListeners();
    await this.provider?.destroy?.();
    this.emit("status", { connected: false });
    log.info("Robinhood monitor stopped");
  }
}
