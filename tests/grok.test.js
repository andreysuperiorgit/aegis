import {describe, it} from "node:test";
import assert from "node:assert/strict";
import { isGrokEnabled } from "../src/aegis/ai/grok.js";

describe("Grok AI", () => {
  it("returns false when no API key is set", () => {
    delete process.env.XAI_API_KEY;
    assert.strictEqual(isGrokEnabled(), false);
  });

  it("returns true when API key is set", () => {
    process.env.XAI_API_KEY = "test-key";
    assert.strictEqual(isGrokEnabled(), true);
    delete process.env.XAI_API_KEY;
  });
});
