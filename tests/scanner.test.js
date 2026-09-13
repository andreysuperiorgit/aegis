import { describe, it, assert } from "node:test";

describe("Solana scanner", () => {
  it("module exports scanSolanaToken function", async () => {
    const mod = await import("../src/aegis/scanners/solana.scanner.js");
    assert.strictEqual(typeof mod.scanSolanaToken, "function");
  });
});

describe("Robinhood scanner", () => {
  it("module exports scanRobinhoodToken function", async () => {
    const mod = await import("../src/aegis/scanners/robinhood.scanner.js");
    assert.strictEqual(typeof mod.scanRobinhoodToken, "function");
  });
});

describe("Base scanner", () => {
  it("module exports scanBaseToken function", async () => {
    const mod = await import("../src/aegis/scanners/base.scanner.js");
    assert.strictEqual(typeof mod.scanBaseToken, "function");
  });
});
