# Sessions pick "related" suites by hand, and a safety screen that skips anything naming strfry/publish hid a broken gate suite

**Id:** 2026-11-01-related-suites-picked-by-hand
**Type:** meta
**Opened:** 2026-11-01 (appearance-setting #2, review 1)
**Status:** OPEN
**Done:** —

On the Mac Studio the full `npm test` can't be run (live suites reach Grawk's container and publish), so each phase
runs the "related" Node suites and B-class specs it picks itself. Two gaps showed up in appearance-setting #2:

- The safety screen (grep for `docker exec`, `TAPESTRY_PORT`, `strfry/publish`, `nak`, …) skips suites that only
  *mock* `/api/strfry/publish`. `test/setup-alert-polish.test.js` is one such suite, and it's in the gate. Its S1 broke
  on the change and went unrun through Test Design, Implementation and the first self-check.
- The related B-class specs were a hand-picked list of 9, which missed `tests/brainstorm/setup-alert-polish.spec.js`.
  Its P1 also broke.

Review 1 caught both.

Fix shape:
- Separate "talks to a live stack" from "mentions publish". A suite whose publish calls are all behind a stubbed
  `fetch` is safe, and could carry a marker the screen honours.
- Pick related suites mechanically: every suite and spec that reads a file the diff touches, or the stylesheet.

Until then, run the full gate in the sealed container before Review, as appearance-setting #1 did at ship time.

**Pointer:** `engineering-team/reviews/done/appearance-setting/2-light-look-frame-and-reading-pages.md` (Blocking 1, harness
friction).
