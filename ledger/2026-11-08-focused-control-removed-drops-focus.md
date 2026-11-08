# A focused panel control that a later read removes outright drops focus to the page

**Id:** 2026-11-08-focused-control-removed-drops-focus
**Type:** bug (low; keyboard and screen-reader use of the tagging pipeline panel)
**Opened:** 2026-11-08 (tagging-edges #7, review round 3, § For the owner)
**Status:** OPEN
**Done:** —

Story 7 (ADR `tagging-edges/0007` D15) returns focus from the panel's three prompts, and from "Turn off" when a read
turns it into "Turn on". It does not cover a focused control that a later read removes, with no prompt open and no
control put in its place. Focus then falls to the page, and a keyboard or screen-reader person has to find their place
again. Review round 3 found two cases with the panel lane's probes and the Tester's:
- "Confirm held removals", once a read shows another tab's confirmation pending (Confirm is not shown while one is);
- "Stop", once a read shows nothing busy.

AC-6 of story 7 is "Prompts return focus", so neither case held that story's verdict. Ledger
`2026-10-28-panel-prompts-return-no-focus` closed for the prompts only.

Fix shape, for the owner to choose (review round 3 priced the first at about one short cycle):
- **a short follow-up story that extends D15:** a dated note on ADR 0007, two browser cases, and a change to the
  shared focus helper (`useReturnFocus` in `ui/src/pages/settings/taggingPipeline/parts.jsx`), so focus moves to the
  section's heading when the focused control goes;
- **or leave it** as a known gap, and close this row saying so.

**Pointer:** `engineering-team/reviews/tagging-edges/7-confirm-held-removals.md` § "Re-review, round 3", "For the
owner", first bullet
