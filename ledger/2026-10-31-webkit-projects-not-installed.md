# Playwright's webkit and Mobile Safari projects are configured but not installed on the Mac Studio, so phone-only behaviour goes unchecked in Safari

**Id:** 2026-10-31-webkit-projects-not-installed
**Type:** meta
**Opened:** 2026-10-31 (appearance-setting #1, review round 3)
**Status:** OPEN
**Done:** —

`playwright.config.js` defines `webkit` and `Mobile Safari` projects, but `~/Library/Caches/ms-playwright` holds only
chromium, and B-class specs are run with `--project=chromium`. Behaviour that exists only on phones, such as
appearance-setting #1's phone Appearance popover, therefore never runs in the browser most phones use. Round 3 of that
story's review found a likely WebKit-only defect (a `blur` with no `relatedTarget` closing the popover before a press
lands) that chromium can't show. The fix was proven only by imitating WebKit's focus model in chromium (E11).

Fix shape: either install the WebKit browser where B-class specs run, or name where WebKit and Mobile Safari runs
happen (for example CI). Then run phone-only specs under those projects as part of Review.

**Pointer:** `engineering-team/reviews/appearance-setting/1-appearance-switch-and-design-shell-dark.md` (round 3,
harness friction).
