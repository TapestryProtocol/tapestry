# A `'` in a config value is read one way by bash and another by `getConfigFromFile()`

**Id:** 2026-10-31-quote-in-conf-value-misread
**Type:** bug
**Opened:** 2026-10-31 (book `config-parse-leak`, story `security-auth-exposure` #11, ADR `security-auth-exposure/0006`)
**Status:** OPEN
**Done:** —

Since story 11, `tools/render-conf-template.js` refuses a value containing `"`, `$`, a backtick, `\` or a line break,
so bash and the JavaScript readers agree on every value it writes, except one case. A `'` is allowed (bash reads it
literally inside double quotes), but `getConfigFromFile()` reads a quoted value with `=["'](.*?)["']`
(`src/utils/config.js:27`, and `lib/config.js` the same way), which stops at the first `'` or `"`. So a
`NEO4J_PASSWORD` of `ab'cd` reaches the shell scripts and the control panel's environment as `ab'cd` and a
`getConfigFromFile('NEO4J_PASSWORD')` caller as `ab`. That is a wrong value, not a leak, and no instance is known to
have one.

Fix shapes: make the regex match the quote it opened with (`=(["'])(.*?)\1`), so a `'` inside double quotes is kept;
or add `'` to the renderer's refused characters, which is simpler but may stop an instance whose password has one
from starting (check staging and production first, as story 11's AC-5 did).

**Pointer:** `engineering-team/decisions/security-auth-exposure/0006-refuse-unsafe-conf-at-render.md` (Consequences);
`src/utils/config.js:27`.
