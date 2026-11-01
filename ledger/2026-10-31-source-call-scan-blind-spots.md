# The tree scan for `source` calls checks the next catch in the text, and misses some ways of writing the command

**Id:** 2026-10-31-source-call-scan-blind-spots
**Type:** cleanup
**Opened:** 2026-10-31 (story `security-auth-exposure` #11 review, non-blocking findings 1 and 2)
**Status:** OPEN
**Done:** —

`test/config-parse-leak.test.js` (AC-3/AC-4) finds every exec-family call whose command runs `source` under `src/`,
`lib/` and `bin/`, and requires each to keep bash's stderr out and its catch to log only `.status`. It is sound for
today's tree (the reviewer confirmed all 38 calls sit inside the try of the catch it checks), but two gaps let a
future change through:

- **It checks the first `catch (x) {` after the call in the text, not the catch that guards it** (`:234`). With
  `getPubkey`'s new try/catch in `calculateFromLibrary.ts` removed, the suite still passes, because the next catch
  in the file belongs to `getConfig`. The `CATCH` regex (`:216`) also skips a bare `catch {` and a promise
  `.catch(`. Fix shape: require the call to sit inside the `try` block whose catch is checked (find the enclosing
  `try {` by brace depth), and treat a call with no enclosing try as an offender unless its function's every caller
  is checked.
- **`SOURCE_LITERAL` (`:214`) does not see `source "${X}"`, `. ${X}` or `source ./x`.** A call rewritten that way is
  caught only by the floor of 38 calls; a new one would pass. None is in the tree today. Fix shape: widen the
  pattern to an optional quote after `source `, and the `. ` form followed by a path or variable.

The leak itself does not depend on either: `stdio: ['ignore', 'pipe', 'ignore']` keeps bash's stderr out of the
error's `message` too, so a catch that logs `message` no longer prints the conf.

**Pointer:** `engineering-team/reviews/security-auth-exposure/11-unparseable-config-never-logged.md` (non-blocking 1,
2); `test/config-parse-leak.test.js:214-243`.
