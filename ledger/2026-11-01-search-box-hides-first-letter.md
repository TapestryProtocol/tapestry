# The results page's search box sometimes shows the query without its first letter ("oodcast" for "podcast")

**Id:** 2026-11-01-search-box-hides-first-letter
**Type:** bug
**Opened:** 2026-11-01 (appearance-setting book close; seen during stories 1–4's smoke tests)
**Status:** OPEN
**Done:** —

On `/?q=podcast`, the results page's search box (`.bs-search-box-results`, `ui/src/components/SearchInput.jsx`) twice
showed "oodcast": once on staging in Dark before story 4 shipped, and once on the local staging-data preview in Light.
Both screenshots were taken with the page just loaded. Later loads on staging showed "podcast" in full, so it's
intermittent. The text looks scrolled behind the search icon or the box's left padding, perhaps when the input takes
focus with the caret at the end. It isn't from the appearance work: it shows in both looks, and before story 4.

Fix shape: reproduce with the results page freshly loaded and the input focused; check the box's padding against the
icon's width, and `scrollLeft` on the input after hydration.

**Pointer:** `engineering-team/audits/appearance-setting/audit.md` §5 "Known open issues".
