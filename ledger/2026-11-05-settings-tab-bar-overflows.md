# The Settings page's tab bar doesn't wrap, so at some widths its last tabs sit off to the right, reachable only by scrolling the content sideways

**Id:** 2026-11-05-settings-tab-bar-overflows
**Type:** bug
**Opened:** 2026-11-05 (setup-create-account #2, Implementation)
**Status:** OPEN
**Done:** —

`.tab-bar` (`ui/src/styles.css:1389`) is a one-row flex box with no wrap. The Settings page
(`ui/src/pages/settings/Index.jsx`) puts eight tabs in it since setup-create-account #2 added "👥 Accounts". The tabs
shrink to fit at 768, 1024 and 1280 px. At 375 px and at 900 px (the width where the sidebar shows), they don't. The
last tabs overflow, and `.main-content` (`overflow-x: auto`) scrolls sideways to reach them.

**Measured** on a mocked build, 2026-11-05: at 900 px the last tab ends 115 px past the content's edge, and at 375 px
360 px past it. With seven tabs, "🔍 Auditing Tools" was already about 25 px off at 900 px. So the eighth tab made an
existing problem visible; it didn't cause it.

**Fix shape:** let the Settings tab bar wrap (or scroll with a visible affordance). Either is a choice about how
every Settings tab looks, so it needs the owner's call. A rule change in `styles.css` also has to satisfy the
appearance book's T1 (no new unscoped rule).

**Pointer:** `engineering-team/stories/setup-create-account/2-open-sign-up.md` § Deviations.
