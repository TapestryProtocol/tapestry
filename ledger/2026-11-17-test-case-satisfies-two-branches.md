# A test case can satisfy two branches of an "or" at once, and so test neither, while the coverage map credits both

**Id:** 2026-11-17-test-case-satisfies-two-branches
**Type:** meta
**Opened:** 2026-11-17 (story graph-operations-first-slice #27, review round 1, harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** Story 27's AC3 says create-set's repeat is the instance's own set under the parent "with the name … or the address the name and parent give". Its tests found every such set by name, but each one also sat at the address its name gives, so it was found by address too. So R7's name match (`src/operations/catalog/graph/_sets.js`) could be dropped, or made case-sensitive, with every suite still green. Review round 1's probe showed what that misses: a second set of one name under one parent. The coverage map said CS12 covered the name match.

**Why the harness let it through.** The Tester checks that new tests "fail for the right reason" (`engineering-team/roles/tester.md`, `engineering-team/workflows/3-test-design.md`). Before the code exists, every test fails at the missing module, so that check can't show whether a case isolates the branch the map credits it with. Review 28 likewise found its uncaught breaks only by breaking the real code at Review. Story 27's own fix came in round 2: a seeded set that only its name finds, and a break table in its test plan.

**Fix shape** (for a harness story; any of these):
- **Test Design:** when a criterion names alternatives ("the name … or the address"), each alternative gets a case that only it satisfies, and the coverage map names that case.
- **Implementation:** before Review, the Implementer breaks each branch the map credits once, in a copy of the code, and records what catches it. Story 27's test plan has the table's shape.
- **Review:** the reviewer's role already breaks the real code (reviews 27 and 28). Making it a checklist line would catch the rest.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/27-create-set.md` (round 1: Blocking 1 and Harness friction 1); `engineering-team/stories/graph-operations-first-slice/27-create-set.test-plan.md` ("The Tester correction for review round 1").
