# Filing honest-test-gate #2 renumbered the epic's two planned stories, whose old numbers an ADR, a finished story and four open rows still cite

**Id:** 2026-11-16-story-numbers-ignore-planned-stories
**Type:** meta
**Opened:** 2026-11-16 (review of #94, its non-blocking 6 and harness friction 2)
**Status:** OPEN
**Done:** —

**What was seen.** Workflow 1's numbering rule takes the next number after the highest story filed in the epic's folder (`engineering-team/workflows/1-planning.md`, Output). The `honest-test-gate` epic listed two anticipated stories, not yet filed: 2, "The gate fits a session", and 3, "Skip, don't fail". The story #94 built took 2 by that rule, so they became 3 and 4. Their old numbers are cited elsewhere:
- OPEN.md rows 104, 106 and 192 ("remains honest-test-gate story 3"), and row 291 ("story 2");
- ADR `decisions/honest-test-gate/0001-registry-runner-and-run-record.md` (`:125`, `:191`, `:216`, `:392`, `:440`, `:442`);
- story 1 (`:87`, `:96`, `:98`).

Read today, "story 2" there means "The gate fits a session", now 3, and "story 3" means "Skip, don't fail", now 4. A search before the renumbering missed these citations, because none names the epic beside the number. The epic file now records the mapping.

**Fix shape.** In workflow 1, number past an epic's anticipated stories when they are cited anywhere, or leave a dated pointer wherever the old numbers are cited. For these citations: a dated pointer on rows 104, 106, 192 and 291 when they are next touched. The ADR and story 1 are history and keep their text.

**Pointer:** `engineering-team/workflows/1-planning.md`; `engineering-team/epics/honest-test-gate.md`; the citations above; `engineering-team/reviews/honest-test-gate/2-live-link-checks-leave-the-pr-gate.md`, non-blocking 6.
