import { Connection, PublicKey } from "@solana/web3.js";
import { createLogger } from "../utils/logger.js";
import { PUMP_FUN_PROGRAM } from "../utils/constants.js";
import { EventEmitter } from "events";

const log = createLogger("solana-monitor");

export class SolanaMonitor extends EventEmitter {
  constructor(wsUrl) {
    super();
    this.wsUrl = wsUrl;
    this.connection = null;
    this.subscriptionId = null;
    this.running = false;
    this.reconnectTimer = null;
    this.seenSigs = new Set();
  }

  async start() {
    if (this.running) return;
    this.running = true;
    log.info("Starting Pump.fun monitor...");
    await this._subscribe();
  }

  async stop() {
    this.running = false;
    clearTimeout(this.reconnectTimer);
    if (this.connection && this.subscriptionId !== null) {
      try { await this.connection.removeOnLogsListener(this.subscriptionId); } catch {}
    }
    this.subscriptionId = null;
    this.emit("status", { connected: false });
    log.info("Solana monitor stopped");
  }

  async _subscribe() {
    try {
      this.connection = new Connection(this.wsUrl, {
        wsEndpoint: this.wsUrl, commitment: "confirmed",
      });

      this.subscriptionId = this.connection.onLogs(
        new PublicKey(PUMP_FUN_PROGRAM),
        (logInfo) => this._handleLog(logInfo),
        "confirmed"
      );

      this.emit("status", { connected: true });
      log.info(`Subscribed to Pump.fun (sub ID: ${this.subscriptionId})`);
    } catch (err) {
      log.error("Subscribe failed:", err.message);
      this.emit("error", err);
      this._scheduleReconnect();
    }
  }

  _handleLog(logInfo) {
    if (logInfo.err) return;
    const logs = logInfo.logs || [];
    const isCreation = logs.some(l =>
      l.includes("Program log: Instruction: Create") || l.includes("InitializeMint")
    );
    if (!isCreation) return;

    const sig = logInfo.signature;
    if (this.seenSigs.has(sig)) return;
    this.seenSigs.add(sig);
    if (this.seenSigs.size > 10000) {
      this.seenSigs = new Set([...this.seenSigs].slice(-5000));
    }

    log.info(`New Pump.fun launch: ${sig}`);
    this.emit("newToken", { chain: "solana", signature: sig, slot: logInfo.slot, timestamp: Date.now() });
  }

  _scheduleReconnect() {
    if (!this.running) return;
    log.info("Reconnecting in 5s...");
    this.reconnectTimer = setTimeout(() => this._subscribe(), 5000);
  }
}
