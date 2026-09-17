#!/usr/bin/env node
/**
 * memory-migrate — bring the memory schema forward.
 *
 *   npm run memory:migrate
 *   npm run memory:migrate -- --status
 */

import "dotenv/config";
import { initMemory, closeMemory, memoryPath } from "../src/aegis/memory/index.js";
import { migrate, migrationStatus } from "../src/aegis/memory/migrate.js";

const args = process.argv.slice(2);
initMemory();

const c = { dim: "\x1b[90m", green: "\x1b[32m", yellow: "\x1b[33m",
            cyan: "\x1b[36m", bold: "\x1b[1m", reset: "\x1b[0m" };

if (args.includes("--status")) {
  const st = migrationStatus();
  console.log(`\n${c.bold}${c.cyan}memory schema${c.reset}`);
  console.log(`${c.dim}${"─".repeat(52)}${c.reset}`);
  console.log(`  database   ${typeof memoryPath === "function" ? memoryPath() : "(default)"}`);
  console.log(`  current    ${c.bold}v${st.current}${c.reset}`);
  console.log(`  latest     ${c.bold}v${st.latest}${c.reset}\n`);
  for (const m of st.applied) {
    const when = new Date(m.applied_at).toISOString().slice(0, 16).replace("T", " ");
    console.log(`  ${c.green}✓${c.reset} v${m.version}  ${m.name.padEnd(24)} ${c.dim}${when}${c.reset}`);
  }
  for (const m of st.pending) {
    console.log(`  ${c.yellow}·${c.reset} v${m.version}  ${m.name.padEnd(24)} ${c.dim}pending${c.reset}`);
  }
  console.log();
} else {
  const r = migrate();
  if (r.applied.length === 0) console.log("nothing to do");
}

closeMemory();
