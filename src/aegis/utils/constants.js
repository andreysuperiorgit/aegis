// ═══════════════════════════════════════════
// Solana — Pump.fun
// ═══════════════════════════════════════════
export const PUMP_FUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export const PUMP_FUN_FEE = "CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbCJ4GMKfMaB3M";
export const RAYDIUM_AMM = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

// ═══════════════════════════════════════════
// Robinhood Chain — Pons V2
// Chain ID 4663, Arbitrum Orbit L2, ETH gas
// ═══════════════════════════════════════════
export const ROBINHOOD_CHAIN_ID = 4663;
export const ROBINHOOD_RPC_PUBLIC = "https://rpc.mainnet.chain.robinhood.com";
export const ROBINHOOD_WS_PUBLIC = "wss://rpc.mainnet.chain.robinhood.com";
export const ROBINHOOD_EXPLORER = "https://robinhoodchain.blockscout.com";

// Pons V2 contracts (verified via Bitquery & Mobula docs)
export const PONS_V2_FACTORY = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";
export const PONS_V2_LOCKER = "0x267444d099b10fb5ed7c3cc7b7c767adca574952";
export const PONS_V2_MEME_HOOK = "0xe5e702641ea86f4ae6cc3cdaed2b886f976be044";
export const PONS_V2_ROUTER = "0xe33e9e479df8802cb0866d5d05258bec4cf62948";
export const PONS_V2_GRADUATION = "0xc7819b64a1daecd7ec19856d026cb14efbd89046";
export const PONS_V2_FEE_ESCROW = "0xd3afeb2a57f70ef218aa82451c51b2fb0416ac9e";
export const PONS_V2_BUYBACK = "0x42df2a798f82289e177311362e8f5ccc45c1219c";
export const PONS_V1_FACTORY = "0xa5aab3f0c6eeadf30ef1d3eb997108e976351feb";

// Uniswap V4 on Robinhood Chain
export const UNISWAP_V4_POOL_MANAGER = "0x8366a39cc670b4001a1121b8f6a443a643e40951";

// ═══════════════════════════════════════════
// Safety Score Weights (total = 100)
// ═══════════════════════════════════════════
export const SCORE_WEIGHTS = {
  mintAuthority: 20,
  freezeAuthority: 15,
  topHolderConc: 20,
  bundleDetected: 20,
  lpStatus: 15,
  metadataFlags: 10,
};

// ═══════════════════════════════════════════
// Base — Clanker / Virtuals / Aerodrome
// Chain ID 8453, OP Stack L2, ETH gas
// LAPTOP token launched here (Sept 9, 2026)
// ═══════════════════════════════════════════
export const BASE_CHAIN_ID = 8453;
export const BASE_RPC_PUBLIC = "https://mainnet.base.org";
export const BASE_EXPLORER = "https://basescan.org";

// $LAPTOP token on Base (Hunter Biden's memecoin)
export const LAPTOP_TOKEN_BASE = "0xB095274743941e953c746F9C228DA9c18Bb6ec29";

// Clanker — AI-powered token launcher on Base
// Clanker creates standard DEX pairs (no bonding curve)
// Tokens are tradeable immediately upon launch
export const CLANKER_PROTOCOL = "Clanker";

// Aerodrome — leading DEX on Base
export const AERODROME_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";

// Uniswap V3 on Base
export const UNISWAP_V3_FACTORY_BASE = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
export const UNISWAP_V3_ROUTER_BASE = "0x2626664c2603336E57B271c5C0b26F421741e481";

// Thresholds
export const HOLDER_CONCENTRATION_DANGER = 0.30;
export const HOLDER_CONCENTRATION_WARNING = 0.15;
export const BUNDLE_TIME_WINDOW_SLOTS = 5;
export const MIN_LP_BURN_PERCENT = 0.95;
