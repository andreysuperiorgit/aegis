import {describe, it} from "node:test";
import assert from "node:assert/strict";
import { calculateScore } from "../src/aegis/utils/score.js";

describe("calculateScore", () => {
  it("returns 100 for a perfectly clean token", () => {
    const result = calculateScore({
      mintAuthorityRevoked: true,
      freezeAuthorityRevoked: true,
      topHolderPercent: 0.05,
      bundleDetected: false,
      lpBurnPercent: 0.99,
      metadataWarnings: [],
    });
    assert.strictEqual(result.score, 100);
    assert.strictEqual(result.verdict, "SAFE");
  });

  it("returns 0 for maximum danger token", () => {
    const result = calculateScore({
      mintAuthorityRevoked: false,
      freezeAuthorityRevoked: false,
      topHolderPercent: 0.95,
      bundleDetected: true,
      lpBurnPercent: 0,
      metadataWarnings: ["flag1", "flag2", "flag3", "flag4"],
    });
    assert.strictEqual(result.score, 0);
    assert.strictEqual(result.verdict, "DANGER");
  });

  it("returns CAUTION for mixed signals", () => {
    const result = calculateScore({
      mintAuthorityRevoked: true,
      freezeAuthorityRevoked: true,
      topHolderPercent: 0.20,
      bundleDetected: true,
      lpBurnPercent: 0.7,
      metadataWarnings: ["one warning"],
    });
    assert.ok(result.score >= 40 && result.score < 80);
  });
});
