import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TMP = path.join(os.tmpdir(), `aegis-memory-test-${process.pid}.db`);
process.env.AEGIS_MEMORY_PATH = TMP;
process.env.AEGIS_PRICE_SOURCE = "none";

const {
  initMemory, closeMemory, getDb,
  enrichScan, lookupDeployer, lookupWallets,
  recordToken, recordVerdict, recordBundle, updateTokenStatus,
  flagWallet, getStats,
} = await import("../src/aegis/memory/index.js");
const { migrate, currentVersion, latestVersion, migrationStatus } =
  await import("../src/aegis/memory/migrate.js");
const { classify, dueTokens, CHECKPOINTS_H } =
  await import("../src/aegis/jobs/followup.job.js");

const A = (s) => "0x" + s.padEnd(40, "0");
const HOUR = 3600 * 1000;

function reset() {
  const db = getDb();
  for (const t of ["token_observations", "wallet_bundles", "wallet_deployers",
                   "tokens", "wallets", "deployers"]) {
    try { db.exec(`DELETE FROM ${t}`); } catch { /* table may not exist yet */ }
  }
}

before(() => {
  for (const f of [TMP, TMP + "-wal", TMP + "-shm"]) {
    try { fs.rmSync(f, { force: true }); } catch {}
  }
  initMemory();
  migrate({ quiet: true });
});

after(() => {
  closeMemory();
  for (const f of [TMP, TMP + "-wal", TMP + "-shm"]) {
    try { fs.rmSync(f, { force: true }); } catch {}
  }
});

beforeEach(reset);


describe("migrations", () => {
  it("brings the schema to the latest version", () => {
    assert.equal(currentVersion(), latestVersion());
  });

  it("is idempotent", () => {
    const again = migrate({ quiet: true });
    assert.equal(again.applied.length, 0);
    assert.equal(again.from, again.to);
  });

  it("reports nothing pending once applied", () => {
    assert.equal(migrationStatus().pending.length, 0);
  });

  it("created the follow-up columns", () => {
    const cols = getDb().prepare("PRAGMA table_info(tokens)").all()
      .map((c) => c.name);
    assert.ok(cols.includes("last_checked_at"));
    assert.ok(cols.includes("check_count"));
  });
});


describe("recordToken", () => {
  it("creates the deployer before the token, without a FK error", () => {
    recordToken({ address: A("aa"), chain: "base", deployer: A("d1"),
                  score: 70, verdict: "CAUTION" });
    const dep = getDb().prepare("SELECT * FROM deployers WHERE address = ?")
      .get(A("d1"));
    assert.equal(dep.tokens_total, 1);
  });

  it("does not inflate tokens_total when the same token is re-scanned", () => {
    recordToken({ address: A("bb"), chain: "base", deployer: A("d2"),
                  score: 70, verdict: "CAUTION" });
    recordToken({ address: A("bb"), chain: "base", deployer: A("d2"),
                  score: 71, verdict: "CAUTION" });
    recordToken({ address: A("bb"), chain: "base", deployer: A("d2"),
                  score: 72, verdict: "CAUTION" });
    const dep = getDb().prepare("SELECT * FROM deployers WHERE address = ?")
      .get(A("d2"));
    assert.equal(dep.tokens_total, 1, "a re-scan is not a new launch");
  });

  it("accepts a token with no deployer", () => {
    recordToken({ address: A("cc"), chain: "solana", deployer: null,
                  score: 50, verdict: "WARNING" });
    const tok = getDb().prepare("SELECT * FROM tokens WHERE address = ?")
      .get(A("cc"));
    assert.equal(tok.deployer, null);
  });
});


describe("recordVerdict", () => {
  it("writes back the score the engine produced", () => {
    recordToken({ address: A("dd"), chain: "base", deployer: A("d3"),
                  score: null, verdict: null });
    recordVerdict(A("dd"), 42, "WARNING");
    const tok = getDb().prepare("SELECT * FROM tokens WHERE address = ?")
      .get(A("dd"));
    assert.equal(tok.first_score, 42);
    assert.equal(tok.verdict, "WARNING");
  });
});


describe("lookupDeployer", () => {
  it("is neutral on an address it has never seen", () => {
    const r = lookupDeployer(A("ff"), "base");
    assert.equal(r.adjustment, 0);
  });

  it("penalises a serial rugger", () => {
    for (let i = 0; i < 3; i++) {
      const tok = A("e" + i);
      recordToken({ address: tok, chain: "base", deployer: A("rug"),
                    score: 60, verdict: "CAUTION" });
      updateTokenStatus(tok, "rugged", 0.001);
    }
    const r = lookupDeployer(A("rug"), "base");
    assert.equal(r.adjustment, -15);
    assert.match(r.reason, /serial rugger/);
  });

  it("rewards a deployer whose tokens survive", () => {
    for (let i = 0; i < 6; i++) {
      const tok = A("g" + i);
      recordToken({ address: tok, chain: "base", deployer: A("good"),
                    score: 85, verdict: "SAFE" });
      updateTokenStatus(tok, i === 0 ? "rugged" : "alive", 1.2);
    }
    const r = lookupDeployer(A("good"), "base");
    assert.equal(r.adjustment, 10);
    assert.match(r.reason, /trusted/);
  });

  it("keeps chains separate", () => {
    for (let i = 0; i < 3; i++) {
      const tok = A("h" + i);
      recordToken({ address: tok, chain: "base", deployer: A("xchain"),
                    score: 60, verdict: "CAUTION" });
      updateTokenStatus(tok, "rugged", 0);
    }
    assert.equal(lookupDeployer(A("xchain"), "solana").adjustment, 0,
      "history on base must not leak into a solana lookup");
  });
});


describe("lookupWallets", () => {
  it("penalises known ruggers in the first buys", () => {
    flagWallet(A("w1"), "base", "known_rugger", "pulled lp");
    flagWallet(A("w2"), "base", "known_rugger", "pulled lp");
    const r = lookupWallets([A("w1"), A("w2"), A("w3")], "base");
    assert.equal(r.adjustment, -10);
  });

  it("needs two ruggers before it reacts", () => {
    flagWallet(A("w4"), "base", "known_rugger", "once");
    assert.equal(lookupWallets([A("w4")], "base").adjustment, 0);
  });

  it("rewards smart money", () => {
    flagWallet(A("sm"), "base", "smart_money", "good track record");
    assert.equal(lookupWallets([A("sm")], "base").adjustment, 10);
  });
});


describe("enrichScan", () => {
  it("clamps the combined adjustment to -25", () => {
    for (let i = 0; i < 3; i++) {
      const tok = A("k" + i);
      recordToken({ address: tok, chain: "base", deployer: A("bad"),
                    score: 60, verdict: "CAUTION" });
      updateTokenStatus(tok, "rugged", 0);
    }
    flagWallet(A("c1"), "base", "known_rugger", "");
    flagWallet(A("c2"), "base", "known_rugger", "");

    const m = enrichScan({ address: A("new"), chain: "base",
                           deployer: A("bad"), buyers: [A("c1"), A("c2")] });
    assert.equal(m.adjustment, -25);
    assert.equal(m.reasons.length, 2);
  });

  it("only reports reasons that actually moved the score", () => {
    flagWallet(A("c3"), "base", "known_rugger", "");
    flagWallet(A("c4"), "base", "known_rugger", "");
    const m = enrichScan({ address: A("new2"), chain: "base",
                           deployer: A("unseen"), buyers: [A("c3"), A("c4")] });
    assert.equal(m.adjustment, -10);
    assert.equal(m.reasons.length, 1, "a neutral lookup is not a reason");
    assert.match(m.reasons[0], /known-rugger/);
    assert.ok(m.notes.some((n) => /no history/.test(n)));
  });

  it("returns a neutral result with no deployer and no buyers", () => {
    const m = enrichScan({ address: A("new3"), chain: "base",
                           deployer: null, buyers: [] });
    assert.equal(m.adjustment, 0);
    assert.equal(m.reasons.length, 0);
  });
});


describe("updateTokenStatus", () => {
  it("moves deployer reputation down on a rug", () => {
    recordToken({ address: A("m1"), chain: "base", deployer: A("dm"),
                  score: 70, verdict: "CAUTION" });
    const before = getDb().prepare("SELECT reputation FROM deployers WHERE address = ?")
      .get(A("dm")).reputation;
    updateTokenStatus(A("m1"), "rugged", 0);
    const after = getDb().prepare("SELECT * FROM deployers WHERE address = ?")
      .get(A("dm"));
    assert.equal(after.tokens_rugged, 1);
    assert.ok(after.reputation < before);
  });

  it("does not double-count a token reported twice", () => {
    recordToken({ address: A("m2"), chain: "base", deployer: A("dn"),
                  score: 70, verdict: "CAUTION" });
    updateTokenStatus(A("m2"), "rugged", 0);
    updateTokenStatus(A("m2"), "rugged", 0);
    const dep = getDb().prepare("SELECT * FROM deployers WHERE address = ?")
      .get(A("dn"));
    assert.equal(dep.tokens_rugged, 1,
      "the second report is about a token already counted");
  });

  it("ignores an address it has never recorded", () => {
    assert.doesNotThrow(() => updateTokenStatus(A("ghost"), "rugged", 0));
  });
});


describe("recordBundle", () => {
  it("counts a wallet once per token", () => {
    const crew = [A("b1"), A("b2")];
    recordBundle(A("t1"), crew, 100, "base");
    recordBundle(A("t1"), crew, 100, "base");
    const w = getDb().prepare("SELECT * FROM wallets WHERE address = ?").get(A("b1"));
    assert.equal(w.bundle_count, 2,
      "bundle_count tracks appearances; the row insert is what de-dupes");
    const rows = getDb()
      .prepare("SELECT COUNT(*) c FROM wallet_bundles WHERE token_address = ?")
      .get(A("t1"));
    assert.equal(rows.c, 2, "one row per wallet per token");
  });
});


describe("getStats", () => {
  it("counts what memory holds", () => {
    recordToken({ address: A("s1"), chain: "base", deployer: A("sd"),
                  score: 80, verdict: "SAFE" });
    flagWallet(A("sw"), "base", "known_rugger", "");
    const s = getStats();
    assert.equal(s.tokensSeen, 1);
    assert.equal(s.deployersTracked, 1);
    assert.equal(s.walletsFlagged, 1);
  });
});


describe("followup: classify", () => {
  const token = { peak_price_usd: 10 };

  it("calls a 95% drop into no liquidity a rug", () => {
    assert.equal(classify({ priceUsd: 0.4, liquidityUsd: 500 }, token, 24),
                 "rugged");
  });

  it("does not call a big drop a rug while liquidity holds", () => {
    assert.equal(classify({ priceUsd: 0.4, liquidityUsd: 90_000 }, token, 24),
                 "live");
  });

  it("calls a thin old pool abandoned", () => {
    assert.equal(classify({ priceUsd: 9.8, liquidityUsd: 400 }, token, 96),
                 "abandoned");
  });

  it("settles a healthy token as alive at the last checkpoint", () => {
    assert.equal(
      classify({ priceUsd: 12, liquidityUsd: 80_000 }, token,
               CHECKPOINTS_H[CHECKPOINTS_H.length - 1]),
      "alive");
  });

  it("treats a missing feed on an old token as a rug", () => {
    assert.equal(classify(null, token, 48), "rugged");
  });

  it("does not judge a missing feed in the first hours", () => {
    assert.equal(classify(null, token, 3), "live");
  });
});


describe("followup: dueTokens", () => {
  it("skips tokens younger than the first checkpoint", () => {
    recordToken({ address: A("y1"), chain: "base", deployer: A("dy"),
                  score: 80, verdict: "SAFE" });
    assert.equal(dueTokens(Date.now()).length, 0);
  });

  it("returns a token once it passes 24h", () => {
    recordToken({ address: A("y2"), chain: "base", deployer: A("dy2"),
                  score: 80, verdict: "SAFE" });
    const due = dueTokens(Date.now() + 25 * HOUR);
    assert.equal(due.length, 1);
    assert.equal(due[0].checkpoint, 24);
  });

  it("stops offering a token once it is settled", () => {
    recordToken({ address: A("y3"), chain: "base", deployer: A("dy3"),
                  score: 80, verdict: "SAFE" });
    updateTokenStatus(A("y3"), "rugged", 0);
    assert.equal(dueTokens(Date.now() + 200 * HOUR).length, 0);
  });

  it("advances to the next checkpoint as checks accumulate", () => {
    recordToken({ address: A("y4"), chain: "base", deployer: A("dy4"),
                  score: 80, verdict: "SAFE" });
    getDb().prepare("UPDATE tokens SET check_count = 1 WHERE address = ?")
      .run(A("y4"));
    assert.equal(dueTokens(Date.now() + 30 * HOUR).length, 0,
      "72h checkpoint is not reached at 30h");
    assert.equal(dueTokens(Date.now() + 80 * HOUR).length, 1);
  });
});
