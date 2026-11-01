# Two kinds of config value are read one way by bash and another by `getConfigFromFile()`: one holding a `'`, and an empty one

**Id:** 2026-10-31-quote-in-conf-value-misread
**Type:** bug
**Opened:** 2026-10-31 (book `config-parse-leak`, story `security-auth-exposure` #11, ADR `security-auth-exposure/0006`)
**Status:** OPEN
**Done:** —

Since story 11, `tools/render-conf-template.js` refuses a value containing `"`, `$`, a backtick, `\` or a line break,
so nothing it writes can run or expand when sourced. Two cases are still read differently by `getConfigFromFile()`
(`src/utils/config.js:27`) than by bash. Both are wrong values, not leaks, and both predate the story.

- **A `'` in a value.** It is allowed, and bash reads it literally inside double quotes, but `getConfigFromFile()`
  reads a quoted value with `=["'](.*?)["']`, which stops at the first `'` or `"`. A `NEO4J_PASSWORD` of `ab'cd`
  reaches the shell scripts and the control panel's environment as `ab'cd`, and a `getConfigFromFile` caller as `ab`.
  No instance is known to have one. (`lib/config.js` is not affected: it strips one pair of matching quotes,
  `lib/config.js:55-59`.)
- **An empty value.** For `BRAINSTORM_ADMIN_PUBKEYS=""` the quoted regex matches an empty string, which is falsy, so
  the unquoted fallback `=([^\s]+)` returns the two characters `""` (found at story 11's review). Bash reads it as
  empty. The template renders this variable empty whenever no admins are set.

Fix shapes: make the regex match the quote it opened with and accept an empty match (`=(["'])(.*?)\1`, tested with
`!== undefined` rather than truthiness), which fixes both; or add `'` to the renderer's refused characters, which
fixes only the first and may stop an instance whose password has one from starting (check the live values first, as
story 11's AC-5 did).

**Pointer:** `engineering-team/decisions/security-auth-exposure/0006-refuse-unsafe-conf-at-render.md` (Consequences);
`src/utils/config.js:27`.
