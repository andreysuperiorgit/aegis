# Security

## Reporting

Open a [private security advisory](https://github.com/andreysuperiorgit/aegis/security/advisories/new)
rather than a public issue. If that is not available to you, anything
that reaches the maintainer privately is fine.

Please include what you did, what happened, and what you expected. A
proof of concept helps but is not required to file.

## What this project touches

AEGIS reads public chain state and, if you turn the sniper on, signs
transactions with a key you supply. Two consequences follow.

**Your key is the whole attack surface.** `SNIPER_ENABLED` is off by
default and should stay off unless you have read `src/aegis/sniper/`
and understand what it will do without asking you first. Use a wallet
funded with only what you are prepared to lose. There is no "just try
it" mode for money.

**The memory database is yours and stays local.** `data/memory.db` is
plain SQLite on your disk. Nothing is uploaded. If that ever changes it
will be a flag you opt into, not a default you discover.

## Scope

In scope:

- key or seed leakage through logs, errors, or the API
- an unauthenticated route that can move funds or alter memory
- SQL injection into the memory layer
- a scan result that can be manipulated by a hostile contract into
  scoring itself SAFE

Out of scope:

- a token passing the six checks and going to zero anyway — that is
  risk, not a vulnerability
- rate limits or availability of third-party RPC and price endpoints
- findings that require an already-compromised machine

## Running it safely

- keep `.env` out of version control (it already is, via `.gitignore`)
- put the API behind something that authenticates before exposing it
- back up `data/memory.db` — the history in it is not reproducible
