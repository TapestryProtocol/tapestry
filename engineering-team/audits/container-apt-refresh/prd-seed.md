# PRD Seed: Weekly package freshness for Tapestry's container images

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/container-apt-refresh/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high for scope, which is the frame plus what shipped. Medium for the vision and the people, which were
never stated as such.
**Date:** 2026-11-21

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman
> for the product team*, not a ratified spec. Every section is tagged:
> - `[FROM FRAME]`: grounded in the kickoff acceptance frame;
> - `[INFERRED]`: read off the as-built system;
> - `[UNKNOWN — product input needed]`.
>
> The product team adopts this as the starting point for `/discover` on the next phase, and validates each section.

## 1. Product vision

- `[FROM FRAME]` **The aim.** A fix Ubuntu ships reaches each Tapestry container within a week of that container's next
  build.
  - Nobody has to remember to rebuild anything.
  - No deploy is unexpectedly slow.
  - Nothing pinned moves: Neo4j and its plugins, strfry, and Node's major version.
- `[INFERRED]` **Why now.** On 2026-11-20 a CVE check found the container's NGINX on two droplets below Ubuntu's fix,
  while every host was patched. Build caches had kept the containers' packages as old as their last cold build.
- `[UNKNOWN — product input needed]` **How far the promise reaches.**
  - It covers the Tapestry image as this repository builds it.
  - It's not known whether it should cover every image in the stack, every deployment, including the sandboxes and any
    self-hosted instance, or the base image's own lifetime.

## 2. Personas

- `[FROM FRAME]` **The operator of Tapestry's deployments,** David today.
  - Merges to `staging` and `main`.
  - Decides when the sandboxes take `staging`.
  - Runs any by-hand step over SSH.
  - Wants freshness without having to remember it, a deploy time he can predict, and a way to tell beforehand which
    deploy refreshes.
- `[INFERRED]` **An agent session running the deploy chain,** through the cycle skills and the safe-to-merge check.
  - It needs to know before a merge whether that merge will refresh.
  - It needs to read afterwards, from the deploy log, whether it did.
  - Several of the docs this book wrote are aimed at it.
- `[UNKNOWN — product input needed]` **Other operators.** For example, a teammate who runs an instance from this
  repository. It isn't known whether a weekly refresh at deploy time suits them, or whether they'd want it off.

## 3. Scope (as-built)

**In.**
- `[FROM FRAME]` The packages refresh at deploys only, at most once a week per target. The brains' image is included.
- `[FROM FRAME]` The deploy that refreshes may take a few minutes longer. A full rebuild isn't wanted.
- `[INFERRED]` What carries that out:
  - **A refresh step** after the cached steps, keyed by the ISO week.
  - **A marker** that says when the refresh ran and how many packages it changed.
  - **A guard** that fails the build if Neo4j or Node moves.
  - **Loud failure** when Ubuntu's archive can't be reached.
  - **Three signs** that tell a refreshing deploy beforehand.
  - **Three recipes** for refreshing by hand.
  - **The note** for the two sandboxes now.
- `[INFERRED]` Where it runs: staging and the brains now, and production from its next promotion.

**Out**, as the story decided:
- a scheduled refresh for a target that doesn't deploy;
- the sandboxes' own branches;
- the stack's other images;
- Node's patch level;
- moving off Ubuntu 22.04;
- pinning the base image, which David declined in OPEN.md row 134.

## 4. Domain model

`[INFERRED]` No concept-graph entities. This is a capability of how images are built. The things involved:
- **Build target.** Staging, production, tags, magic-carpet, and the brains' image. Each has its own build cache, and
  so its own age of cached packages.
- **Build.** A server deploy or a brain image build.
  - It refreshes when it's the target's first build of the week.
  - It also refreshes when it changes something the image builds before the refresh step.
  - Otherwise it reuses that week's refresh.
- **Refresh.** It has a week, a time and a count. Its cost grows with the age of the target's cached package step, and
  levels off.
- **Marker.** The refresh's record, inside the container. It's read by the operator, not served.
- **Pinned components.** Neo4j with APOC and GDS, strfry with its patches, and Node's 22 line. The refresh must never
  move them.

## 5. Design rules (as-built)

`[INFERRED]`, from the ADR, its amendment and the review:
- **Freshness rides on deploys.** Nothing runs on a schedule (intake answer 2).
- **Fail loudly, never stale silently.** An unreachable archive turns the deploy red, and the running container keeps
  serving.
- **Say beforehand.** An operator or agent can tell before merging whether a deploy will refresh, and the deploy log
  says afterwards whether it did.
- **The marker is read with `docker exec`, not served over HTTP.** A public endpoint would show anyone how stale a
  container might be (ADR, Out of scope).
- **A by-hand refresh doesn't outlast the next deploy.** It's documented as repeatable, not lasting (review round 1, and
  David's choice of option (a)).
- `[UNKNOWN — product input needed]` **No rule was recorded** for how fast a critical fix must reach production. That
  might call for something faster than the weekly cadence.

## 6. Carry-forward & open questions

Promoted from the build audit's §6:
- **The sandboxes** take the change through their branches, with their owners' yes. Until then, the note refreshes them
  by hand.
- **Node 22.x's patch level** still moves only on a cold build.
- **The stack's other images** (`nostr-search`'s Alpine base, Redis, Meilisearch) never refresh.
- **Ubuntu 22.04's standard support ends in April 2027.** A new base is a bigger change.
- **S2**, the on-server check on staging, waits for David's yes.
- **Why build caches go cold**, and the safe-to-merge buffer, are unchanged.

## 7. What product must validate

- [ ] Should the sandboxes stay fresh without depending on their owners merging `staging`? That would be a port, or a
  rule that sandboxes merge `staging` regularly.
- [ ] Is refreshing at deploys only still right for a target that rarely deploys? Intake said yes, and a sandbox can now
  go weeks stale.
- [ ] Should the stack's other images get the same weekly treatment?
- [ ] When should the base move off Ubuntu 22.04, given the April 2027 date?
- [ ] Should Node's patch level refresh too? That also changes what CI's Node 22 has to match.
- [ ] Is weekly fast enough for a critical fix, or is a faster path wanted for those?
- [ ] Should there be one place that shows every container's marker?
