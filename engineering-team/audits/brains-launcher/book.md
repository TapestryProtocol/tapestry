# Book of Work: A team member launches their own brain

**Slug:** brains-launcher
**Status:** Open
**Opened:** 2026-11-04

## Intent anchor

**Acceptance frame (no PRD).** An internal launcher at `tapestry.ninja` gives an allowlisted team member their own
Tapestry instance at `<slug>.tapestry.ninja`, owned by their nostr pubkey and starting blank. The design spec came out
of the owner's call with David on 2026-11-04, and the owner agreed the changes to it the same day. It runs on the
stops the spec names (the human handovers) rather than a stop per phase, at the owner's word.

### Acceptance frame

- [x] The owner launches `avi` from the page and it is `running` in 8 to 10 minutes. The spec said under three; the
  owner accepted this on 2026-11-04 once the firmware install was timed on the droplet. Timed at 6m52s.
- [x] The owner signs in with a NIP-07 extension and is the owner; the lists hold firmware's own headers and items, and
      nothing from outside (438 events, 0 scores); router presets are all off.
- [x] The owner adds their agent's npub on the admins page, and the agent can sign in as admin. Done with a throwaway key.
- [x] David and Vinney launch theirs, and one roll takes all three forward. Both are owners, at the owner's word. The roll
      took about a minute a brain, with node, edge and event counts identical.
- [x] One brain is destroyed and restored within the grace week with its data intact. Done on a throwaway brain, 69s.
- [x] `docker stats` totals with three brains idle sit under the budget the cap was set from: 5.2 of 7.8 GiB used.
- [x] `deploy/launcher/test/isolation.sh` is green, with three brains.

## Epics

- `brains-launcher` (`engineering-team/epics/brains-launcher.md`)
