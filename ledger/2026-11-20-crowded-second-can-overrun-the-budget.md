# A crowded second, split into parts, is finished whole before import nostr checks its clock, so one call can run past 40 s and nginx's 60 s

**Id:** 2026-11-20-crowded-second-can-overrun-the-budget
**Type:** cleanup
**Opened:** 2026-11-20 (story graph-operations-first-slice #32, `import nostr`, review round 2, a new non-blocking finding)
**Status:** OPEN
**Done:** —

**What was seen.** By filter, import nostr finishes every second it starts (ADR graph-operations-first-slice/0032 Decision 5: "It always finishes the second it is in").
- **The check comes after the work:** `finish` (`src/operations/catalog/import/nostr.js:521-528`) records a second's events before it checks the time.
- **How long that can take:** a crowded second that the split reads in parts holds up to 500 events a part. At the live check's rate for real letters, about 15 a second through nginx (story 32 § Evidence), one full part takes about 33 s.
- **The overrun:** a call that reaches such a second late, or meets one with several parts, can run past the 40 s budget and past nginx's 60 s for the route.
- **What follows:** nginx answers 504 while the control panel goes on recording. The import is safe to repeat, so a second call answers what was recorded `unchanged`.

**Why it isn't simply stopped mid-second.** Finishing the second is what makes `next.until` move.
- `until` names a second, and the events in a second come back in the same order each time.
- So a call stopped inside a crowded second and resumed at it would read the same part again, and might never get past it.

**What closes it.** One of:
- a cursor inside a second that a later call can resume at (for example, each part's filter carried in `next`);
- the import as a job, as lifecycle's backup is, for a call that meets a crowded second;
- a longer nginx limit for `/api/tapestry/import/`, as `/api/tapestry/lifecycle/` has 900 s (`docker/nginx.conf`).

Memo #129's bulk publisher, 6,717 events in one second on search.brainstorm.world, is the case to measure against.

**Pointer:** `src/operations/catalog/import/nostr.js` (`finish`); ADR graph-operations-first-slice/0032, Decisions 5 and 12; `engineering-team/reviews/graph-operations-first-slice/32-import-nostr.md`, round 2.
