# Story 9: The config reader logs key names, never values

**Status:** Approved
**Created:** 2026-10-31
**Type:** Bug (security / secret exposure)
**Epic:** `security-auth-exposure`
**Book:** `audits/config-secret-logging/`
**Source:** ngit issue `c549202b` ("Config reader logs secret values (NEO4J_PASSWORD, SESSION_SECRET) in plain text")

## Background

`getConfigFromFile()` in `src/utils/config.js` reads one key from `brainstorm.conf` (or the file `BRAINSTORM_CONF_PATH`
names) and logs as it goes. Four of its log lines print the value it found or falls back to:

- a quoted match: `Found <KEY>=<value> (quoted)`;
- an unquoted match: `Found <KEY>=<value> (unquoted)`;
- the `source` fallback, used when neither pattern matches: `Source command result for <KEY>: '<value>'`. That
  fallback echoes the key from a bash shell that inherits the process environment, so a key that is only in the
  environment is printed too;
- the default: `Using default value for <KEY>: <default>`.

The control panel reads `NEO4J_PASSWORD` and `SESSION_SECRET` through this function at startup, so the app's startup
log (`/var/log/supervisor/brainstorm.log` in the container) holds both in plain text. The issue confirmed it on a fresh
instance at `H2_0`. The installer reads `BRAINSTORM_RELAY_PRIVKEY` and `BRAINSTORM_RELAY_NSEC` the same way, so an
install whose `brainstorm.conf` still holds the relay key logs that key too.

`SESSION_SECRET` signs the control panel's session cookies: whoever reads the log can forge any session, the owner's
included. `NEO4J_PASSWORD` opens the database wherever its ports are reachable. The log is readable from a shell in the
container and by anything that copies or ships logs, and it lives as long as the container does.

The default value matters too: when `SESSION_SECRET` is missing, the log prints the public default secret, which tells
a reader that this instance's cookies can be forged with a string anyone can find in the repo.

**What this story is not about.** It changes only what one function writes to the log. It changes no value the
function returns, and it touches no point of view, publishing path or graph state (principles 1–4 don't apply).
Rotating `SESSION_SECRET` and `NEO4J_PASSWORD` on deployments whose old logs may hold them is operational follow-up for
the owner, not part of this fix.

## User-facing description

As the owner of a Brainstorm instance, I want my startup log to say which settings were read and where each came from,
but never what they are, so that anyone who can read or copy my logs can't learn my session secret, my database
password or a relay key from them.

## Acceptance criteria

- [ ] **AC-1 A found value is never logged.** Given a config file holding a key with a distinctive value, quoted or
      unquoted, when `getConfigFromFile` reads it, then it returns that value as before, and nothing the function
      writes to the console (`log`, `info`, `warn`, `error`) contains the value.
- [ ] **AC-2 The `source` fallback's value is never logged.** Given a key that neither pattern finds but the `source`
      fallback resolves (for example a key present only in the process environment), when `getConfigFromFile` reads
      it, then it returns the value as before, and nothing it writes to the console contains the value.
- [ ] **AC-3 The default is never logged.** Given a key the file doesn't hold and nothing else resolves, when
      `getConfigFromFile` reads it with a default, then it returns the default as before, and nothing it writes to the
      console contains the default.
- [ ] **AC-4 The log still helps diagnosis.** In each case above, the function still logs the key's name and how it
      was resolved (quoted, unquoted, `source`, default, or file not found), so an operator can still tell from the
      log which settings were read and where each came from.
- [ ] **AC-5 Seen on a running instance.** On a fresh throwaway instance started from the fixed code, and then on the
      staging droplet after deploy, the app's startup log holds the names `NEO4J_PASSWORD` and `SESSION_SECRET` but
      not their values.

## Out of scope

- **Log volume.** The function logs on every call (one startup reads `BRAINSTORM_OWNER_PUBKEY` 15 times). The issue
  suggests a debug level; that is a separate, behaviour-neutral cleanup, filed if the owner wants it.
- **Other loggers.** A sweep of the repo for value-bearing log lines found none that print a secret read from config
  (the installer's `Neo4j password: neo4j` line prints the hard-coded factory default on an empty config, not a
  configured value). No other file changes.
- **Rotating secrets** on existing deployments, and cleaning old logs. Operational, owner's call.

## Phase path

Bug, Standard strictness: Planning → Test Design → Implementation → Review. Architecture is skipped: the fix is
obvious (drop the value from four log lines) and makes no design choice.
