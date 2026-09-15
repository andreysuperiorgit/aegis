#!/usr/bin/env node
/**
 * memory-flag — manually flag a wallet as smart-money or known-rugger.
 *
 * Usage:
 *   npm run memory:flag -- --address 0x... --chain base --smart "wallet from @proof_of_pizza"
 *   npm run memory:flag -- --address 0x... --chain robinhood --rugger "pulled LP on $XYZ Sept 12"
 */

import { initMemory, flagWallet, closeMemory } from "../src/aegis/memory/index.js";

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return null;
  return args[idx + 1];
}

const address = getArg("address");
const chain = getArg("chain");
const smartNote = getArg("smart");
const ruggerNote = getArg("rugger");

if (!address || !chain || (!smartNote && !ruggerNote)) {
  console.error("Usage: npm run memory:flag -- --address 0x... --chain <solana|robinhood|base> --smart|--rugger \"note\"");
  process.exit(1);
}

initMemory();
const flag = smartNote ? "smart_money" : "known_rugger";
const note = smartNote || ruggerNote;

flagWallet(address, chain, flag, note);
console.log(`✓ Flagged ${address} on ${chain} as ${flag}`);
console.log(`  note: ${note}`);
closeMemory();
