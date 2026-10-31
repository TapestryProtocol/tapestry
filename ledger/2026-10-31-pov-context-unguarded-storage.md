# With browser storage blocked, every signed-in page throws, because PovContext reads localStorage unguarded

**Id:** 2026-10-31-pov-context-unguarded-storage
**Type:** bug
**Opened:** 2026-10-31 (appearance-setting #1, Test Design and Review)
**Status:** OPEN
**Done:** —

`ui/src/context/PovContext.jsx:40` calls `localStorage.getItem(POV_STORAGE_PREFIX + user.pubkey)` in an effect with no
`try`, and `:63` calls `localStorage.setItem` the same way. In a browser that refuses storage (a private window with
site data blocked, some embedded views) the property access itself throws a `SecurityError`, so once someone is
signed in the effect throws and the page errors. Signed out the effect returns early, so signed-out pages are fine.

Found while testing appearance-setting #1's AC-7 ("works when the browser won't store anything"). The appearance code
never throws; its browser test E10 runs signed out for this reason. The Reviewer judged it acceptable for that story
because it predates it.

Fix shape: wrap both accesses as the neighbouring `TrustContext.jsx:15-37` does (`try { … } catch {}`), falling back
to the server preference that the effect already fetches. Then extend
`tests/brainstorm/appearance-setting.spec.js` E10, or a POV spec, to a signed-in session.

**Pointer:** `engineering-team/reviews/appearance-setting/1-appearance-switch-and-design-shell-dark.md` (non-blocking 6);
the story's test plan, § Test infrastructure, "Known gap".
