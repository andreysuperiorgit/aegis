const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL || "info"] ?? 1;

function timestamp() {
  return new Date().toISOString().slice(11, 23);
}

function colorize(level) {
  const colors = { debug: "\x1b[90m", info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m" };
  return `${colors[level] || ""}${level.toUpperCase().padEnd(5)}\x1b[0m`;
}

function log(level, module, message, data) {
  if (LEVELS[level] < currentLevel) return;
  const prefix = `${timestamp()} ${colorize(level)} [${module}]`;
  if (data !== undefined) {
    console.log(`${prefix} ${message}`, typeof data === "object" ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export function createLogger(module) {
  return {
    debug: (msg, data) => log("debug", module, msg, data),
    info: (msg, data) => log("info", module, msg, data),
    warn: (msg, data) => log("warn", module, msg, data),
    error: (msg, data) => log("error", module, msg, data),
  };
}
