# PRD Seed: A broken or unsafe setting stops the instance, quietly

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/config-parse-leak/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high for §3; medium elsewhere
**Date:** 2026-11-01

> A reverse-engineered baseline built from what shipped: a strawman for the product team, not a ratified spec.
> Tags: `[FROM FRAME]`, `[INFERRED]`, `[UNKNOWN — product input needed]`.
> It continues `audits/config-secret-logging/prd-seed.md`, whose §5 left open whether a broken settings file should
> block startup. This book answered yes.

## 1. Product vision

`[FROM FRAME]` A mistake in an instance's settings, or a secret with an awkward character in it, never ends up in the
logs and never runs as a command. `[INFERRED]` When the instance can't use its settings safely, it says so at startup,
pointing at the setting or the line, rather than starting and leaking later.

## 2. Personas

- `[INFERRED]` **The instance owner**, who sets the database password and other values through the container's
  environment, and now and then edits the settings file by hand inside a running container.
- `[INFERRED]` **Anyone with read access to the logs**, as in the earlier seed: not trusted with secrets.

## 3. Scope (as-built)

- `[FROM FRAME]` A setting whose value the settings file can't hold safely (it contains `"`, `$`, a backtick, `\` or
  a line break) stops startup, naming the setting, never the value.
- `[FROM FRAME]` A settings file bash can't parse stops startup, naming the line number, never the line.
- `[FROM FRAME]` The GrapeRank jobs, like the five readers before them, report a failed lookup by name and status,
  never with the settings line.
- `[FROM FRAME]` A test fails if any new code reads the settings file in a way that could leak.
- `[INFERRED]` Not in scope: hand edits inside a running container (checked only at the next start), bare-metal
  installs, production until promotion.

## 4. Domain model

`[INFERRED]` No domain entities. The things involved are the instance's environment values, the settings file
rendered from them at every start, and the logs.

## 5. Design rules (as-built)

- `[INFERRED]` Fail at startup, not at first use: an unsafe setting stops the container before any job reads it.
- `[INFERRED]` A refusal names what to fix (a setting, a line number) and never echoes the input, even its own error
  text from a tool that might.
- `[INFERRED]` Refuse rather than escape: a value is either written as-is or refused, so every reader of the file
  sees the same value.
- `[UNKNOWN — product input needed]` Whether owners should be able to use `"`, `$`, `` ` `` or `\` in a password at
  all. Today they can't; allowing it means escaping, which every reader would have to undo the same way.

## 6. Carry-forward & open questions

- The sandboxes' and the agent-memory instance's values need the same check before the next `main` promotion
  (audit §6).
- Two values the JavaScript reader still misreads, a `'` and an empty value (OPEN.md row
  `2026-10-31-quote-in-conf-value-misread`).
- A hand edit inside a running container is checked only at the next start (audit §6).

## 7. What product must validate

- [ ] Is refusing five characters in a password acceptable to owners, or does the product need escaping? (§5)
- [ ] Should a hand edit to the settings file be checked when it's made, which means a settings editor rather than a
      shell?
- [ ] Should the owner see, in the UI, why an instance refused to start, or is the container log enough?
