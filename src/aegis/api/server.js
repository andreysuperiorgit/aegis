import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import { createLogger } from "../utils/logger.js";
import { scanSolanaToken } from "../scanners/solana.scanner.js";
import { scanRobinhoodToken } from "../scanners/robinhood.scanner.js";
import { scanBaseToken } from "../scanners/base.scanner.js";
import { getRugCheckReport } from "../scanners/rugcheck.js";
import { calculateScore } from "../utils/score.js";
import { analyzeWithGrok, isGrokEnabled } from "../ai/grok.js";
import { initMemory, getStats, getDb } from "../memory/index.js";

const log = createLogger("server");

export function createServer({ solanaMonitor, robinhoodMonitor, baseMonitor }) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Set();

  wss.on("connection", (ws) => {
    clients.add(ws);
    log.info(`WS client connected (${clients.size})`);
    ws.on("close", () => { clients.delete(ws); });
  });

  function broadcast(type, data) {
    const msg = JSON.stringify({ type, data, timestamp: Date.now() });
    for (const c of clients) { if (c.readyState === 1) c.send(msg); }
  }

  // Wire monitors
  if (solanaMonitor) {
    solanaMonitor.on("newToken", (d) => broadcast("newLaunch", d));
    solanaMonitor.on("status", (s) => broadcast("monitorStatus", { chain: "solana", ...s }));
  }
  if (robinhoodMonitor) {
    robinhoodMonitor.on("newToken", async (d) => {
      broadcast("newLaunch", d);
      // Auto-scan Pons tokens
      if (d.token) {
        try {
          const checks = await scanRobinhoodToken(d.token, process.env.ROBINHOOD_RPC_URL);
          const result = calculateScore(checks);
          broadcast("scanResult", { ...checks, ...result });
        } catch (err) { log.error("Auto-scan failed:", err.message); }
      }
    });
    robinhoodMonitor.on("status", (s) => broadcast("monitorStatus", { chain: "robinhood", ...s }));
  }

  if (baseMonitor) {
    baseMonitor.on("newToken", async (d) => {
      broadcast("newLaunch", d);
      if (d.token) {
        try {
          const checks = await scanBaseToken(d.token, process.env.BASE_RPC_URL);
          const result = calculateScore(checks);
          broadcast("scanResult", { ...checks, ...result });
        } catch (err) { log.error("Base auto-scan failed:", err.message); }
      }
    });
    baseMonitor.on("status", (s) => broadcast("monitorStatus", { chain: "base", ...s }));
  }

  // Health
  app.get("/api/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

  // ── Second Brain ──────────────────────────────────
  app.get("/api/memory/stats", (req, res) => {
    try {
      initMemory();
      res.json(getStats());
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/memory/deployer/:address", (req, res) => {
    try {
      initMemory();
      const db = getDb();
      const addr = req.params.address.toLowerCase();
      const deployer = db
        .prepare("SELECT * FROM deployers WHERE address = ?")
        .get(addr);
      if (!deployer) return res.status(404).json({ error: "deployer not seen yet" });
      const tokens = db
        .prepare("SELECT address, chain, first_score, verdict, current_status, launched_at " +
                 "FROM tokens WHERE deployer = ? ORDER BY launched_at DESC LIMIT 50")
        .all(addr);
      res.json({ deployer, tokens });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/memory/wallet/:address", (req, res) => {
    try {
      initMemory();
      const db = getDb();
      const wallet = db
        .prepare("SELECT * FROM wallets WHERE address = ?")
        .get(req.params.address.toLowerCase());
      if (!wallet) return res.status(404).json({ error: "wallet not seen yet" });
      res.json(wallet);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Scan Solana token
  app.get("/api/scan/solana/:address", async (req, res) => {
    try {
      const checks = await scanSolanaToken(req.params.address, process.env.SOLANA_RPC_URL);
      const result = calculateScore(checks);
      let rugcheck = null;
      if (process.env.RUGCHECK_API_KEY) rugcheck = await getRugCheckReport(req.params.address);
      const scanData = { ...checks, ...result, rugcheck };
      // Grok AI analysis (if configured)
      if (isGrokEnabled()) scanData.grok = await analyzeWithGrok(scanData);
      res.json(scanData);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Scan Robinhood Chain token
  app.get("/api/scan/robinhood/:address", async (req, res) => {
    try {
      const checks = await scanRobinhoodToken(req.params.address, process.env.ROBINHOOD_RPC_URL);
      const result = calculateScore(checks);
      const scanData = { ...checks, ...result };
      if (isGrokEnabled()) scanData.grok = await analyzeWithGrok(scanData);
      res.json(scanData);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Scan Base token
  app.get("/api/scan/base/:address", async (req, res) => {
    try {
      const checks = await scanBaseToken(req.params.address, process.env.BASE_RPC_URL);
      const result = calculateScore(checks);
      const scanData = { ...checks, ...result };
      if (isGrokEnabled()) scanData.grok = await analyzeWithGrok(scanData);
      res.json(scanData);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Monitor controls
  app.post("/api/monitor/start", async (req, res) => {
    const { chain } = req.body;
    if (chain === "solana" && solanaMonitor) { await solanaMonitor.start(); res.json({ status: "started", chain }); }
    else if (chain === "robinhood" && robinhoodMonitor) { await robinhoodMonitor.start(); res.json({ status: "started", chain }); }
    else if (chain === "base" && baseMonitor) { await baseMonitor.start(); res.json({ status: "started", chain }); }
    else res.status(400).json({ error: "Invalid chain" });
  });

  app.post("/api/monitor/stop", async (req, res) => {
    const { chain } = req.body;
    if (chain === "solana") await solanaMonitor?.stop();
    if (chain === "robinhood") await robinhoodMonitor?.stop();
    if (chain === "base") await baseMonitor?.stop();
    res.json({ status: "stopped", chain });
  });

  app.get("/api/monitor/status", (req, res) => {
    res.json({
      solana: { running: solanaMonitor?.running ?? false },
      robinhood: { running: robinhoodMonitor?.running ?? false },
      base: { running: baseMonitor?.running ?? false },
    });
  });

  return { app, server, broadcast };
}
