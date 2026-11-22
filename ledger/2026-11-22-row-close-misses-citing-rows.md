# Closing a numbered OPEN.md row has no step that finds the rows citing it, so a row can close while another still waits on it

**Id:** 2026-11-22-row-close-misses-citing-rows
**Type:** meta
**Opened:** 2026-11-22 (doc-lane review `test-suite-hermeticity/operations-required-check-status`, harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** A doc-lane change closed OPEN.md row 14 as "every part of the row is fixed", and its review caught that two parts were still open (finding B1). One of them was row 24's. Row 24 is open, and its item (c) leaves the §9.9 fix to row 14: it "folds into the §1/§9 drift reconciliation in **#14**". The closing session searched for "row 14" and missed it, because row 24 cites the row as "#14". Row 14 stayed open.

OPEN.md § "How to use this ledger" says how to cite a row ("OPEN.md row 230"), how to look a number up, and how to close a row. It doesn't ask whoever closes a row to find the rows that cite it, or what those rows leave to it. Older rows cite each other as "#N", a form that pull request and issue numbers share, so a search for "row N" alone misses them.

**Fix shape.** One sentence in that section's "Close a row" bullet: before closing, find the rows that cite it (`git grep -n -E 'row N\b|#N\b' -- OPEN.md ledger/`) and settle what they leave to it. A lint check could only warn, since "#N" also matches pull requests and issues.

**Pointer:** OPEN.md § "How to use this ledger"; OPEN.md row 24, item (c); `engineering-team/reviews/test-suite-hermeticity/operations-required-check-status.md` (B1, and harness friction 1).
