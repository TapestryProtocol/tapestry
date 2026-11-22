# Book of Work: A firmware install leaves each header's tags once

**Slug:** header-tags-once
**Status:** Open
**Opened:** 2026-11-21
**Closed:** —
**Strictness:** Standard (project default; no Light profile).

## Intent anchor

**Acceptance frame (no PRD).** The owner's ask (2026-11-21) was to find out why six concept headers on david.tapestry.ninja hold every tag of their letter twice, whether other instances do too, and how to fix it. After the diagnosis he said "Yes, plan it". His three answers at planning are folded in:
- the two guards become their own story in this book;
- done covers staging, production, david.tapestry.ninja and tags;
- the lost-`b` fault is queued separately.

### Acceptance frame

- [ ] **Each header and community copy holds its tags once.** After any number of firmware installs, two kinds of node hold each tag of their current letter once:
  - a concept header with a community reference;
  - each community header or superset that an install brings in.

  (`community-reference` #39.)
- [ ] **No instance points at itself.** An instance that curates a concept's community reference gets no `b` naming its own header, and no relationship from that header to itself. (#39.)
- [ ] **A repeated tag is never listed twice or signed.** The concept summaries list each header once, even when it holds a repeated tag, and no owner rewrite of a letter signs a repeated tag. (#40.)
- [ ] **Staging, production, david.tapestry.ninja and tags are clean.** Each runs the fix and has one firmware reinstall, each on the owner's yes. The owner runs david.tapestry.ninja's reinstall himself, since that route is owner-only. Afterwards each one's public summaries show one row per header, and none of the six headers or the community copies holds a repeated tag. The counts are recorded here.
- [ ] **The ledger says so.** `ledger/2026-11-20-todays-importers-keep-their-faults.md` records that firmware's community references no longer leave old tags.

## Epics in this book

- `community-reference`:
  - #39: a firmware install leaves each header's tags once;
  - #40: a repeated tag is never listed twice or signed, to be planned after #39.

## Rollout counts

- **Staging (2026-11-21, `425006cf`).** Its reinstall ran from 22:07:06 to 22:11:46 UTC, after a merge's deploy had cut off two attempts.
  - Its public summaries give 46 rows for 46 headers (50 before).
  - None of the 56 nodes the sweep reads holds a repeated tag: its 46 headers and 10 community copies.
  - The six headers hold 7 tags each, or 9 for `tagging-with-specific-tag`, with one `b` each. The copies of production's `nostr-relay` header and superset hold 7 each (61 and 63 before).
  - Three copies still reference themselves, following their letters: production's `nostr-relay` header, and the Mac Studio's `nostr-event-tag` and `tagging-with-specific-tag` headers.
  - Story 39's Evidence has the details.
- **Production (2026-11-21, `196a475f`).** Its reinstall ran from 23:37:29 to 23:41:29 UTC.
  - Its public summaries give 45 rows for 45 headers (51 before).
  - None of the 56 nodes the sweep reads holds a repeated tag (7 did before).
  - Five headers hold 7 tags each, or 9 for `tagging-with-specific-tag`, with one `b` each.
  - `nostr-relay`, whose reference production curates, holds 6 tags and no `b`. Neither it nor its superset (7 tags, 14 before) has a relationship to itself.
  - Two copies still reference themselves, following their letters: the Mac Studio's `nostr-event-tag` and `tagging-with-specific-tag` headers.
- **Tags (2026-11-22, `73704d7f`).** Its reinstall ran from 03:29:41 UTC to about 04:09, after the `feat/tags` port (TapestryProtocol/tapestry#203).
  - Its public summaries give 43 rows for 43 headers (49 before).
  - None of the 53 nodes the sweep reads holds a repeated tag (6 did before).
  - The six headers hold 7 tags each, or 9 for `tagging-with-specific-tag`, with one `b` each. Its copy of production's `nostr-relay` header no longer references itself.
  - Two copies still reference themselves, following their letters: the Mac Studio's `nostr-event-tag` and `tagging-with-specific-tag` headers.

## Known constraints acknowledged at kickoff

- **The local container is off-limits.** It is the owner's private agent-memory instance: not checked, not touched, and no full `npm test` on this Mac.
- **avi.tapestry.ninja is Avi's.** It holds the same duplicates, and reinstalling it is his call.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/header-tags-once/audit.md`
- Product feedback: `engineering-team/audits/header-tags-once/prd-seed.md`
