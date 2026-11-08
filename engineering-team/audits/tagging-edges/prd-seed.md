# PRD Seed: Tagging edges — who tagged whom, in the graph

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/tagging-edges/audit.md`
**Anchor:** the acceptance frame in `book.md` (the owner's ask of 2026-09-25, confirmed at kickoff 2026-09-26, with
dated amendments of 2026-09-30, 10-01, 10-02 and 10-30)
**Confidence:** high for scope and the domain model, both of which the frame states and the build confirms. Medium for
personas and design rules: the stories name them, but no product phase ever ran.
**Date:** 2026-11-08

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a
> strawman for the product team, not a ratified spec. Every section is tagged `[FROM FRAME]`, `[INFERRED]` or
> `[UNKNOWN — product input needed]`.

## 1. Product vision

`[FROM FRAME]` A Tapestry instance's graph should hold, for every tagging on its relay, a relationship from the person
who tagged to the person tagged. That covers, for example, "Alice tags Bob as a Podcaster". It sits beside the
follows, mutes and reports the graph already holds, and is kept current the same way: in real time, with a pass that
fills any gaps.

`[INFERRED]` Taggings are opinions about people, so once they are in the graph they become inputs a point of view can
score. They can join follows and mutes in trust computations, filters and "who says what about whom" views, each read
per POV at query time. The relationship deliberately carries no trust and no count.

`[UNKNOWN — product input needed]` What the first product use of `TAGS` should be. Nothing in the book reads the
relationships yet, beyond counting them on the panel. Ranking, filtering, a "tagged by people you trust" view and
scoring inputs are all open.

## 2. Personas

- `[FROM FRAME]` **The instance owner.** They run a Tapestry instance and are responsible for its graph. They decide
  whether the real-time path runs, and they alone confirm a pass's held removals. They want to see the pipeline is
  healthy without opening a shell.
- `[INFERRED]` **An admin of the instance**, named by the owner. They watch the pipeline, switch the real-time path,
  and run or stop a pass. They cannot confirm removals. The owner's amendment of 2026-09-30 added them.
- `[INFERRED]` **Anyone reading the public status**, signed out or another instance's tool. They can see whether the
  pipeline is current and overdue, but never who acted.
- `[UNKNOWN — product input needed]` **The people being tagged, and the people tagging.** Nothing in the book shows
  them their own `TAGS` relationships, or asks what they expect.

## 3. Scope (as-built)

`[FROM FRAME]`, delivered:
- **One relationship per tagging,** documented in BIBLE §6.
- **A gap-filling pass, run daily.** It never mass-deletes: removals over the limit are held for the owner.
- **A real-time path** that reflects a change within a minute, once the owner turns it on.
- **A control-panel page** for the owner and admins: status, held removals, the schedule, the path, drift, Run, Stop,
  the switch, and Confirm (owner only).

`[INFERRED]` Added along the way, all ratified by the owner:
- an overdue warning when the daily pass has not run;
- a record of who switched, ran, stopped or confirmed, and when;
- prompts that return focus;
- an evidence fixture for testing held lists on staging.

`[FROM FRAME]` Out of scope, or left open:
- revokes from other instances;
- tags.brainstorm.world and other instances (they have no pass and no path);
- alerts outside the panel;
- force-stopping a pass;
- partial or withdrawable confirmations;
- admins confirming.

## 4. Domain model

`[FROM FRAME]` / `[INFERRED]`:
- **Tagging:** a kind-39999 `nostr-user-tag` element on the relay. It has an author, a tagged person, a tag, a stance,
  and a version (the newest stands).
- **TAGS relationship:** from the author's person to the tagged person, one per tagging address. It carries the stance
  (disputes kept), which tag (address, event, slug, and the canonical and local `z`), and when.
- **Pass:** a run that compares the relay with the graph.
  - Its outcomes: done, held, stopped, failed or refused.
  - Its report: counts and anything held.
  - Who started it: the schedule, the owner, an admin, a confirmation or a local call.
- **Held list:** removals a pass was not allowed to make. It belongs to the latest pass only.
- **Confirmation:** the owner's one-time permission for a held list. It expires after 24 hours unused, and is used
  once.
- **Real-time path:** on or off, with its state (starting, live, catching up, stale), its counts, and a record of who
  switched it.
- **Schedule entry:** the daily pass, which the overdue rule judges.

## 5. Design rules (as-built)

`[INFERRED]` From the shipped panel and its reviews:
- **Every code the server can answer has a plain sentence.** An unknown one reads "not recognised", never nothing.
- **A failed read shows as failed**, never as zero or as "on time".
- **Every action that changes something** is behind a prompt that says what happens, and whether it can be undone.
- **The public view never names who acted.** The signed-in owner and admins see who did, with a shortened key.
- **The server decides who may act.** The panel only hides or disables controls.

`[UNKNOWN — product input needed]` No visual design rule was recorded:
- the panel's copy and colours differ from its neighbours';
- its button contrast is low in both looks (issue `fdd1d1a5`);
- it has no link of its own.

## 6. Carry-forward & open questions

Promoted from the audit's §6:
- **Make use of the relationships** (§1's unknown): the first reader of `TAGS`.
- **Reach every instance:** tags.brainstorm.world has no pipeline. Should revokes travel between instances?
- **Notice a stopped backstop outside the panel.** Production's daily pass stopped for eight days in October, and
  nothing said so. Its cause is still open.
- **Accessibility:** focus when a read removes the focused control.
- **Three owner notes from story 7's test plan,** still unanswered.
- **About fifteen code and test follow-ups** from the reviews (audit §6 #9–#14). They are engineering's to schedule,
  and none changes what a user can do.

## 7. What product must validate

- [ ] The first product use of `TAGS`, and for which POV (§1).
- [ ] Whether the people tagged or tagging should see their relationships anywhere (§2).
- [ ] Whether tags.brainstorm.world, and instances like it, should run the pipeline (§3).
- [ ] Whether a stopped backstop deserves an alert beyond the panel's warning (§6).
- [ ] The panel's place in Settings: a link of its own, and copy and colours that match its neighbours' (§5).
- [ ] The answers to story 7's three test-plan notes (audit §6 #8).
