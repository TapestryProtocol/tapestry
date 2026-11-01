# Book of Work: A config file bash can't parse never reaches a log

**Slug:** config-parse-leak
**Status:** Open
**Opened:** 2026-10-31
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)** — the rest of ngit issue `c549202b`, queued at story 10's review
(`stories/_intake.md`, 2026-10-31, "A config file bash can't parse still leaks through the GrapeRank scripts and the
shell scripts"), restated:

### Acceptance frame

- [ ] When the entrypoint renders `/etc/brainstorm.conf` and bash can't parse it, the container refuses to start. Its
      message names the line number, never the line or any value. This closes the leak for the ~105 shell scripts
      that `source` the file, since none of them runs until the entrypoint has passed.
- [ ] Values that would parse but still misbehave when sourced (a `"`, `$`, backtick or `\` inside a secret, or a
      line like `B=pw TAILY` that bash runs as a command) are decided in an ADR: refused at render the same way, or
      written so bash reads them literally.
- [ ] The 11 GrapeRank `.js` files (27 `execSync` calls) keep bash's stderr out of their output and log a failed
      lookup by key and exit status, never `message` or `stderr`. The two dead copies are deleted or patched.
- [ ] Story 10's fixed list becomes a scan: a test fails when any code under `src/`, `lib/` or `bin/` sources the
      config file and lets bash's stderr through or logs the error's `message`/`stderr`.
- [x] Staging's and production's current config values pass the new check, shown before anything is pushed, so the
      change can't stop either from starting. *(2026-10-31, read-only over SSH with the owner's OK, counts only: on
      both droplets `bash -n /etc/brainstorm.conf` status 0, 0 of 10 substituted lines and 0 of the env and
      session-secret values hold `"`, `$`, a backtick, `\` or a line break. The sandboxes and the agent-memory
      instance also follow `main` and need the same check before `main` is promoted (review 11, non-blocking 7).)*
- [ ] What stays open is written down, not claimed fixed: a hand edit to the conf inside a running container still
      reaches shell-script logs until the next restart re-renders the file.
- [ ] The tests fail on the code before the fix and pass after; the story is reviewed PASS on its branch. Publishing
      (ngit, then GitHub `staging`) happens step by step on the owner's OK.

## Epics in this book
- `security-auth-exposure` — story 11, a config file bash can't parse never reaches a log.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/config-parse-leak/audit.md`
- Product feedback: `engineering-team/audits/config-parse-leak/prd-seed.md`
