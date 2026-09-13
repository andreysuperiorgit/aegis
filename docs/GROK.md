# Grok AI Integration

## Setup

1. Get a free API key at [console.x.ai](https://console.x.ai)
2. Add to `.env`: `XAI_API_KEY=xai-your-key-here`
3. Optionally set model: `XAI_MODEL=grok-4.1-fast` (default)

## How it works

After each token scan, AEGIS sends the check results to xAI's Grok API. Grok analyzes the on-chain data and returns:

- **analysis** — plain-language risk breakdown
- **recommendation** — BUY / CAUTION / AVOID
- **confidence** — HIGH / MEDIUM / LOW
- **red_flags** — specific concerns
- **green_flags** — positive signals

## Cost

- Model `grok-4.1-fast`: $0.20 per million input tokens
- Each scan uses ~500 tokens ≈ $0.0001
- Free tier: $175/month = ~1.75 million scans

## API format

The xAI API is OpenAI-compatible. Endpoint: `https://api.x.ai/v1/chat/completions`
