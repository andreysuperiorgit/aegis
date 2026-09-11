import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("jupiter-sniper");
const JUPITER_API = "https://public.jupiterapi.com";
const SOL_MINT = "So11111111111111111111111111111111111111112";

export async function snipeSolanaToken(mintAddress, amountSol, slippageBps = 500) {
  if (process.env.SNIPER_ENABLED !== "true") {
    return { success: false, reason: "disabled" };
  }
  if (!process.env.SOLANA_PRIVATE_KEY) {
    return { success: false, reason: "no_key" };
  }

  const connection = new Connection(process.env.SOLANA_RPC_URL, "confirmed");
  // Dynamic import for bs58 since it may not be installed
  const bs58 = (await import("bs58")).default;
  const wallet = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
  const amountLamports = Math.floor(amountSol * 1e9);

  log.info(`Sniping ${mintAddress} — ${amountSol} SOL`);

  try {
    const quoteRes = await fetch(
      `${JUPITER_API}/quote?inputMint=${SOL_MINT}&outputMint=${mintAddress}&amount=${amountLamports}&slippageBps=${slippageBps}`
    );
    const quote = await quoteRes.json();
    if (quote.error) return { success: false, reason: quote.error };

    const swapRes = await fetch(`${JUPITER_API}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: wallet.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
      }),
    });
    const swapData = await swapRes.json();

    const tx = VersionedTransaction.deserialize(Buffer.from(swapData.swapTransaction, "base64"));
    tx.sign([wallet]);

    const sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true, maxRetries: 2,
    });

    const confirmation = await connection.confirmTransaction(sig, "confirmed");
    if (confirmation.value.err) return { success: false, reason: "tx_failed", signature: sig };

    log.info(`Snipe successful: ${sig}`);
    return { success: true, signature: sig, outAmount: quote.outAmount };
  } catch (err) {
    log.error(`Snipe failed: ${err.message}`);
    return { success: false, reason: err.message };
  }
}
