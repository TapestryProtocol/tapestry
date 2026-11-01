# At 320px, signed out, the profile-family top bar is wider than the screen, and the Appearance button adds 36px

**Id:** 2026-10-31-profile-bar-overflows-at-320px
**Type:** bug
**Opened:** 2026-10-31 (appearance-setting #1, review rounds 2–3)
**Status:** OPEN
**Done:** —

At 320px, signed out, `/`, `/setup`, `/assistant` and `/user/<pubkey>` scroll sideways. Their top bar (`.bsp-top-bar`:
logo with wordmark, About, Sign in) was already 332px wide before appearance-setting #1, and the phone Appearance button
it added beside Sign in brings it to 368px. At 375px and above, nothing scrolls (checked at 360, 375 and 414 px on 12
pages), and no acceptance criterion or test names a width below 375px, so the Reviewer didn't hold the story's
verdict on it.

Fix shape: make the profile-family bar fit at 320px, with or without the button. For example, drop the wordmark beside
the logo at the narrowest widths, as `/about` already does. Then add 320px to that story's E11 widths.

**Pointer:** `engineering-team/reviews/appearance-setting/1-appearance-switch-and-design-shell-dark.md` (round 2,
non-blocking 2; round 3, non-blocking 1).
