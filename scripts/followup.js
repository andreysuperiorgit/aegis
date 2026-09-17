#!/usr/bin/env node
/**
 * followup — go back and record what happened to tokens already scanned.
 *
 *   npm run followup                 one pass
 *   npm run followup -- --dry-run    show what it would do
 *   npm run followup -- --watch      keep running every 30 minutes
 *   npm run followup -- --limit 50
 */

import "dotenv/config";
import { initMemory, closeMemory } from "../src/aegis/memory/index.js";
import { migrate } from "../src/aegis/memory/migrate.js";
import { runFollowup, startFollowupLoop, dueTokens }
  from "../src/aegis/jobs/followup.job.js";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i === -1 ? d : args[i + 1];
};

initMemory();
migrate({ quiet: true });

if (has("--help") || has("-h")) {
  console.log(`
  followup — record what happened to tokens after the scan

    --dry-run        report without writing
    --watch          run continuously
    --interval <m>   minutes between passes with --watch (default 30)
    --limit <n>      max tokens per pass (default 200)
`);
  closeMemory();
  process.exit(0);
}

const limit = parseInt(val("--limit", "200"), 10);

if (has("--watch")) {
  const interval = parseInt(val("--interval", "30"), 10);
  startFollowupLoop({ intervalMinutes: interval, limit });
  process.on("SIGINT", () => {
    console.log("\nstopping");
    closeMemory();
    process.exit(0);
  });
} else {
  const pending = dueTokens(Date.now(), limit).length;
  if (pending === 0) {
    console.log("nothing due — every scanned token is either settled or too young");
  }
  await runFollowup({ limit, dryRun: has("--dry-run") });
  closeMemory();
}
