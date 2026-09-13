import { createLogger } from "../utils/logger.js";

const log = createLogger("grok");

// xAI API is OpenAI-compatible
const XAI_API_URL = "https://api.x.ai/v1/chat/completions";

/**
 * Send scan results to Grok and get a human-readable risk analysis.
 *
 * Uses Grok 4.1 Fast by default ($0.20/M input — cheapest option).
 * xAI gives $175/month free credits to all developers.
 *
 * @param {Object} scanResult - Full scan result with checks and score
 * @returns {{ analysis: string, recommendation: string, confidence: string }}
 */
export async function analyzeWithGrok(scanResult) {
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) {
    log.warn("No XAI_API_KEY set — skipping Grok analysis");
    return null;
  }

  const { chain, mint, score, verdict, breakdown, details, metadataWarnings } = scanResult;

  const prompt = `You are AEGIS, a crypto token safety analyst. Analyze this token scan and give a brief, direct risk assessment.

TOKEN SCAN RESULTS:
- Chain: ${chain}
- Address: ${mint}
- Safety Score: ${score}/100 (${verdict})
- Mint Authority: ${breakdown?.mintAuthority ?? "?"}/20 ${scanResult.mintAuthorityRevoked ? "(revoked ✓)" : "(ACTIVE ✗)"}
- Freeze Authority: ${breakdown?.freezeAuthority ?? "?"}/15 ${scanResult.freezeAuthorityRevoked ? "(revoked ✓)" : "(ACTIVE ✗)"}
- Holder Concentration: ${breakdown?.topHolderConc ?? "?"}/20 (top 10 hold ${((scanResult.topHolderPercent || 0) * 100).toFixed(1)}%)
- Bundle Detection: ${breakdown?.bundleDetected ?? "?"}/20 ${scanResult.bundleDetected ? "(BUNDLES FOUND ✗)" : "(clean ✓)"}
- LP Status: ${breakdown?.lpStatus ?? "?"}/15 (${((scanResult.lpBurnPercent || 0) * 100).toFixed(0)}% burned/locked)
- Metadata: ${breakdown?.metadataFlags ?? "?"}/10 ${metadataWarnings?.length ? "warnings: " + metadataWarnings.join(", ") : "(clean)"}
${details?.name ? `- Token Name: ${details.name} (${details.symbol})` : ""}
${details?.topHolders?.length ? `- Top holders: ${details.topHolders.slice(0, 5).map(h => h.percent).join(", ")}` : ""}

Respond in this exact JSON format, nothing else:
{
  "analysis": "2-3 sentences explaining the main risks or safety signals",
  "recommendation": "BUY / AVOID / CAUTION",
  "confidence": "HIGH / MEDIUM / LOW",
  "red_flags": ["list of specific concerns"],
  "green_flags": ["list of positive signals"]
}`;

  try {
    const model = process.env.XAI_MODEL || "grok-4.1-fast";

    log.info(`Sending scan to Grok (${model})...`);

    const res = await fetch(XAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a crypto token safety analyst. Respond only in valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      log.error(`Grok API error ${res.status}: ${errText}`);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      log.warn("Empty response from Grok");
      return null;
    }

    // Parse JSON response (strip markdown fences if present)
    const clean = content.replace(/```json\n?|```\n?/g, "").trim();
    const parsed = JSON.parse(clean);

    log.info(`Grok says: ${parsed.recommendation} (${parsed.confidence} confidence)`);

    return {
      analysis: parsed.analysis,
      recommendation: parsed.recommendation,
      confidence: parsed.confidence,
      redFlags: parsed.red_flags || [],
      greenFlags: parsed.green_flags || [],
      model,
    };

  } catch (err) {
    log.error(`Grok analysis failed: ${err.message}`);
    return null;
  }
}

/**
 * Quick check — is Grok configured and available?
 */
export function isGrokEnabled() {
  return !!process.env.XAI_API_KEY;
}
