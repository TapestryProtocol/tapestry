# PRD Seed: Secrets stay out of an instance's logs

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/config-secret-logging/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high for §3; medium elsewhere
**Date:** 2026-10-31

> A reverse-engineered baseline built from what shipped: a strawman for the product team, not a ratified spec.
> Tags: `[FROM FRAME]`, `[INFERRED]`, `[UNKNOWN — product input needed]`.

## 1. Product vision

`[FROM FRAME]` An instance's logs say what it read and where each setting came from, but never what a secret is.
`[INFERRED]` The owner of a self-hosted instance often shares or ships logs while asking for help, so a log has to be
safe to hand over.

## 2. Personas

- `[INFERRED]` **The instance owner**, who runs the container, reads its logs when something breaks, and edits
  `brainstorm.conf` by hand now and then.
- `[INFERRED]` **Anyone with read access to the logs**: someone with a shell in the container, a log shipper, a helper
  the owner pastes logs to. Not trusted with the session secret or the database password.

## 3. Scope (as-built)

- `[FROM FRAME]` The shared config reader never logs a value, for any of the four ways it resolves a key.
- `[FROM FRAME]` Five readers keep a broken config line out of the log and report the failed key and exit status.
- `[FROM FRAME]` Proven by stack-free tests, a throwaway instance, and the staging droplet's startup log.
- `[INFERRED]` Not in scope: the GrapeRank scripts and the shell scripts, which still pass a broken line to their own
  logs; production, until promotion.

## 4. Domain model

`[INFERRED]` No domain entities. The things involved are the instance's settings file, its secrets (session secret,
database password, relay keys) and its logs.

## 5. Design rules (as-built)

- `[INFERRED]` A log line names a setting and its source; it never carries the value, even for settings that aren't
  secret today, so a future secret can't leak through the same line.
- `[INFERRED]` A failure says which setting failed and how (an exit status), never the input that caused it.
- `[UNKNOWN — product input needed]` Whether a broken settings file should stop the instance from starting, with a
  message naming the line number. It is the fix that would close the remaining scripts (audit §6).

## 6. Carry-forward & open questions

- The GrapeRank and shell scripts, and an entrypoint check of `brainstorm.conf` (`stories/_intake.md`, 2026-10-31).
- Promotion to production, then rotating the secrets old logs may hold (OPEN.md row
  `2026-10-31-rotate-secrets-after-log-fix`).
- Less log noise from the config reader (a debug level).

## 7. What product must validate

- [ ] Should a settings file bash can't parse block startup, or only warn? (§5)
- [ ] Is "names, never values" the rule for every log in the product, not only the config readers?
- [ ] Should the owner be told, in the UI, when a secret may have been exposed and needs rotating?
