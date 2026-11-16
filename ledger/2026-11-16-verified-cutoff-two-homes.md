# The verified-influence cutoff lives in `graperank.conf`, but the API reads it from `brainstorm.conf`

**Id:** 2026-11-16-verified-cutoff-two-homes
**Type:** bug
**Opened:** 2026-11-16 (graph-operations-first-slice #11, ADR 0011 Context 5 and Consequences debt 1)
**Status:** DONE
**Done:** 2026-11-16. A duplicate of `engineering-team/stories/_intake.md`, 2026-06-06, item 2, "Verified-cutoff inconsistency", which already tracks it (story graph-operations-first-slice #11, review round 1, ask 7; the follow-up to PR #72).

**Closed as a duplicate.** The intake item has tracked this since 2026-06-06, so this row should not have been opened (OPEN.md: a row is for an item with no other home). The intake item also records a live `graperank.conf` of 0.01. So "Nothing changes while both stay at 0.05", below, understates today: on such an instance, the verified counts and the API's lists may already disagree. The intake item now says that the graph reads read the cutoff the same way as the API's readers.

**What was seen.**
- **The value's home.** `config/graperank.conf.template:76` sets `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF=0.05` in `/etc/graperank.conf`. The owner-side count scripts that write `verifiedFollowerCount` onto each `NostrUser` source that file, as the customer scripts source their own (`src/algos/customers/follows-mutes-reports/calculateVerifiedFollowerCounts.sh:30`).
- **The readers.** Every JavaScript reader goes through `getConfigFromFile`, which reads only `brainstorm.conf` (`src/utils/config.js:17–75`):
  - `src/api/grapevineInteractions/queries/followersWithMetrics.js:27` and `cypherQueries.js:10`;
  - `src/api/owner/ownerInfo.js:22`;
  - and, from story 11 on, `src/operations/reads.js`, the graph reads' point of view.

  `cypherQueries.js`'s own comment says the cutoff is "sourced from /etc/graperank.conf", but the code reads `brainstorm.conf`.
- **The effect.** On an instance whose `brainstorm.conf` doesn't also carry the value, every API reader uses the default, 0.05, whatever `graperank.conf` says. So an owner who changes the cutoff there changes the verified counts on the profile badges, but not the verified lists or the graph reads, and badge and list disagree (BIBLE §27, open question 6). Nothing changes while both stay at 0.05.

**Fix shape.** Give the API one reader for the GrapeRank cutoffs that reads `/etc/graperank.conf`, as the scripts do, with `brainstorm.conf` and then 0.05 as fallbacks. Point the four readers at it. Story 11 kept the existing reader on purpose, so that its graph reads agree with the verified-follower list today.

**Pointer:** ADR `graph-operations-first-slice/0011` (Context 5; Consequences, debt 1); `src/operations/reads.js` (`cutoff`).
