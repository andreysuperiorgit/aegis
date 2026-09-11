import React, { useState, useCallback } from "react";
import { useWebSocket } from "./hooks/useWebSocket";

const API = "http://localhost:3001";

function ScoreRing({ score, verdict }) {
  return <div className={`score-ring ${(verdict || "danger").toLowerCase()}`}>{score ?? "–"}</div>;
}

function CheckRow({ name, value, maxValue, pass }) {
  const cls = pass === true ? "pass" : pass === false ? "fail" : "partial";
  return (
    <div className="check-row">
      <span className="check-name">{name}</span>
      <span className={`check-value ${cls}`}>{value}/{maxValue}</span>
    </div>
  );
}

function ScanResult({ result }) {
  if (!result) return null;
  const { score, verdict, breakdown, mint, chain } = result;

  return (
    <div className="card">
      <div className="card-header">
        <h3>Scan Result</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`chain-badge ${chain}`}>
            {chain === "robinhood" ? "Robinhood" : chain === "base" ? "Base" : "Solana"}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
            {mint?.slice(0, 8)}...{mint?.slice(-6)}
          </span>
        </div>
      </div>

      <ScoreRing score={score} verdict={verdict} />
      <p style={{ textAlign: "center", marginBottom: 16, color: "var(--text-muted)" }}>{verdict}</p>

      {result.details?.name && (
        <p style={{ textAlign: "center", marginBottom: 16, fontSize: 14 }}>
          {result.details.name} ({result.details.symbol})
        </p>
      )}

      {breakdown && (
        <>
          <CheckRow name="Mint authority" value={breakdown.mintAuthority} maxValue={20} pass={breakdown.mintAuthority === 20} />
          <CheckRow name="Freeze authority" value={breakdown.freezeAuthority} maxValue={15} pass={breakdown.freezeAuthority === 15} />
          <CheckRow name="Holder concentration" value={breakdown.topHolderConc} maxValue={20} pass={breakdown.topHolderConc >= 15} />
          <CheckRow name="Bundle detection" value={breakdown.bundleDetected} maxValue={20} pass={breakdown.bundleDetected === 20} />
          <CheckRow name="LP status" value={breakdown.lpStatus} maxValue={15} pass={breakdown.lpStatus >= 12} />
          <CheckRow name="Metadata" value={breakdown.metadataFlags} maxValue={10} pass={breakdown.metadataFlags >= 8} />
        </>
      )}

      {result.details?.topHolders?.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: 12 }}>
            Top holders ({result.details.topHolders.length})
          </summary>
          <div style={{ marginTop: 8, fontSize: 11 }}>
            {result.details.topHolders.map((h, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span style={{ color: "var(--text-muted)" }}>{h.address.slice(0, 8)}...{h.address.slice(-4)}</span>
                <span>{h.percent}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {result.grok && (
        <div style={{ marginTop: 16, padding: 12, background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>🤖</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Grok Analysis</span>
            <span style={{
              fontSize: 10, padding: "2px 6px", borderRadius: 4, marginLeft: "auto",
              background: result.grok.recommendation === "BUY" ? "rgba(52,211,153,0.15)" :
                result.grok.recommendation === "AVOID" ? "rgba(239,68,68,0.15)" : "rgba(251,191,36,0.15)",
              color: result.grok.recommendation === "BUY" ? "var(--green)" :
                result.grok.recommendation === "AVOID" ? "var(--red)" : "var(--yellow)",
            }}>
              {result.grok.recommendation} · {result.grok.confidence}
            </span>
          </div>
          <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text)" }}>{result.grok.analysis}</p>
          {result.grok.redFlags?.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11 }}>
              <span style={{ color: "var(--red)" }}>⛔ </span>
              {result.grok.redFlags.join(" · ")}
            </div>
          )}
          {result.grok.greenFlags?.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 11 }}>
              <span style={{ color: "var(--green)" }}>✅ </span>
              {result.grok.greenFlags.join(" · ")}
            </div>
          )}
          <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-muted)" }}>
            Powered by xAI {result.grok.model}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveFeed({ messages }) {
  const launches = messages.filter(m => m.type === "newLaunch" || m.type === "scanResult");

  if (launches.length === 0) {
    return (
      <div className="card" style={{ color: "var(--text-muted)", textAlign: "center", padding: 40 }}>
        No tokens detected yet. Start monitoring to see live launches.
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>Live Feed</h3>
        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{launches.length} events</span>
      </div>
      {launches.slice(0, 50).map((msg, i) => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const chain = msg.data?.chain || "solana";
        const name = msg.data?.symbol || msg.data?.name || "";
        const addr = msg.data?.token || msg.data?.mint || msg.data?.signature?.slice(0, 16) || "";
        const score = msg.data?.score;
        const scoreColor = score >= 80 ? "var(--green)" : score >= 60 ? "var(--yellow)" : score >= 40 ? "var(--orange)" : "var(--red)";

        return (
          <div key={i} className="feed-item">
            <span className="feed-time">{time}</span>
            <span className={`chain-badge ${chain}`}>{chain === "robinhood" ? "RH" : chain === "base" ? "BASE" : "SOL"}</span>
            <span className="feed-mint">{name ? `${name} · ` : ""}{addr.slice(0, 12)}...</span>
            {score != null && <span className="feed-score" style={{ color: scoreColor }}>{score}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("scan");
  const [chain, setChain] = useState("solana");
  const [address, setAddress] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const { connected, messages } = useWebSocket(`ws://${window.location.hostname}:3001/ws`);

  const handleScan = useCallback(async () => {
    if (!address.trim()) return;
    setScanning(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${API}/api/scan/${chain}/${address.trim()}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) { setError(err.message); }
    finally { setScanning(false); }
  }, [address, chain]);

  const toggleMonitor = useCallback(async (ch, action) => {
    await fetch(`${API}/api/monitor/${action}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chain: ch }),
    }).catch(console.error);
  }, []);

  return (
    <div className="app">
      <header>
        <h1><span>◆</span> AEGIS</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={`status-dot ${connected ? "connected" : "disconnected"}`} />
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </header>

      <div className="tabs">
        <button className={`tab ${tab === "scan" ? "active" : ""}`} onClick={() => setTab("scan")}>Manual Scan</button>
        <button className={`tab ${tab === "monitor" ? "active" : ""}`} onClick={() => setTab("monitor")}>Live Monitor</button>
      </div>

      {tab === "scan" && (
        <>
          <div className="scanner">
            <select value={chain} onChange={(e) => setChain(e.target.value)}>
              <option value="solana">Solana</option>
              <option value="robinhood">Robinhood</option>
              <option value="base">Base</option>
            </select>
            <input value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder={chain === "solana" ? "Solana token mint address..." : "EVM token address (0x...)..."}
              onKeyDown={(e) => e.key === "Enter" && handleScan()} />
            <button className="btn" onClick={handleScan} disabled={scanning}>
              {scanning ? "Scanning..." : "Scan"}
            </button>
          </div>
          {error && <div className="card" style={{ borderColor: "var(--red)", color: "var(--red)" }}>{error}</div>}
          <ScanResult result={result} />
        </>
      )}

      {tab === "monitor" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => toggleMonitor("solana", "start")}>▶ Solana (Pump.fun)</button>
            <button className="btn-outline btn" onClick={() => toggleMonitor("solana", "stop")}>⏹ Solana</button>
            <button className="btn" style={{ background: "#059669" }} onClick={() => toggleMonitor("robinhood", "start")}>
              ▶ Robinhood (Pons V2)
            </button>
            <button className="btn-outline btn" onClick={() => toggleMonitor("robinhood", "stop")}>⏹ Robinhood</button>
            <button className="btn" style={{ background: "#2563eb" }} onClick={() => toggleMonitor("base", "start")}>
              ▶ Base (Clanker)
            </button>
            <button className="btn-outline btn" onClick={() => toggleMonitor("base", "stop")}>⏹ Base</button>
          </div>
          <LiveFeed messages={messages} />
        </>
      )}
    </div>
  );
}
