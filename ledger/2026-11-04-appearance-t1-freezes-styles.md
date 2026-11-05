# The appearance book's T1 check fails on any new unscoped rule in ui/src/styles.css, so every later story that needs CSS must reuse classes or re-aim it

**Id:** 2026-11-04-appearance-t1-freezes-styles
**Type:** meta
**Opened:** 2026-11-04 (setup-create-account #1, Test Design)
**Status:** OPEN
**Done:** —

`test/appearance-setting-working.test.js` T1 parses `ui/src/styles.css` now and at the appearance book's
base (`34bd3957b`, read with `git show`). It fails on any rule that changed, any rule that's gone, **and
any "new unscoped declaration"** (selectors not under `[data-appearance` or `[data-preload-family`).
The first two guard what T1 was written for: Dark and untouched pages staying as they were. The third
also catches new rules for new classes, which can't change an existing page.

So since that book closed (2026-11-01), no story can add a plain CSS rule without T1 going red. The
check runs in the stack-free gate on every PR.

**Found by:** setup-create-account ADR 0001 planned "a few rules" for the new Create your account
page. The Architect didn't know about T1, and the Tester found it while mapping the regression suites.
The ADR's Amendment 1 sidesteps it: the page reuses existing classes and adds no rule.

**Fix shape** (needs an owner's call; a harness story):

- **(a)** T1 ignores declarations whose every class is absent from the base stylesheet, so a new class
  family is free and existing selectors stay frozen;
- **(b)** T1 compares against a base that each story that legitimately changes CSS moves forward, with
  the move reviewed;
- **(c)** keep it as it is and write the rule down in AGENTS.md or BIBLE: new CSS goes under
  `[data-appearance]` scopes.

Either way, the Architect's role or workflow should say to grep the regression suites for checks on a
file before planning edits to it.

**Pointer:** `test/appearance-setting-working.test.js:124-140`;
`engineering-team/decisions/setup-create-account/0001-a-page-from-sign-in-and-one-assistant-per-person.md`
§ Amendment 1.
