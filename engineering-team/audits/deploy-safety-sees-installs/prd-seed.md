# PRD Seed: Deploys that don't cut off a running job

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/deploy-safety-sees-installs/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high for what shipped, medium for the next phase's shape
**Date:** 2026-11-22

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman for the product team*, not a ratified spec. Every section is tagged — `[FROM FRAME]` (grounded in the kickoff acceptance frame), `[INFERRED]` (read off the as-built system), or `[UNKNOWN — product input needed]`. The product team adopts this as the starting point for `/discover` on the next phase and validates each section. **Be honest about confidence:** a no-anchor reconstruction is a hypothesis, not ground truth — don't dress it up.

## 1. Product vision

`[FROM FRAME]` A merge should not redeploy an instance in the middle of a job. Every merge into `staging` or `main` redeploys its instance and recreates the `tapestry` container. Without a check that can see a firmware install, an owner-approved install was cut off twice on 2026-11-21, and the only protection was the owner holding merges by hand.

`[INFERRED]` The broader aim, across this book and the `deploy-safety-gate` book before it, is a deploy gate the people and agents who merge can trust. It should see every job a deploy would cut off, and every merge should consult it.

## 2. Personas

`[INFERRED]`, from the story's "As someone who…" lines:
- **The merger.** A person, or an agent session, merging into `staging` or `main`. Often one of several sessions working at once, and not always the one running the job.
- **The installer.** Whoever starts a firmware install on a deployed instance, usually an agent session on the owner's yes, over SSH.
- **The owner,** who approves each install and each promotion. Until now, the owner was the gate's backstop by holding merges by hand.

## 3. Scope (as-built)

`[FROM FRAME]` What shipped:
- **While either firmware install runs,** the instance's deploy-safety answer is unsafe, with a reason that names the install, and the safe-to-merge check waits for it.
- **The answer lets go however the install ends,** a restart included.
- **The written procedure** tells whoever starts an install to check for a running or queued deploy first.
- **All of it is live on staging and production,** seen working on each.

`[INFERRED]` What isn't covered:
- **Merges that skip the check:** the gate is procedural.
- **An install that starts just after a merger's check.**
- **The sandboxes**, `feat/tags` and `feature-magic-carpet`.
- **Lifecycle backup, restore and migrate.**

## 4. Domain model

`[INFERRED]`, from ADRs deploy-safety-gate/0001 and 0004. The entities are operational, not graph concepts:
- **A deploy-safety answer,** for one instance at one moment: a verdict, reasons, and per-source detail. The sources are:
  - task-queue jobs;
  - legacy runs;
  - firmware installs;
  - the next scheduled fire, with a 10-minute buffer.
- **A running install:** which install (`firmware-install` or `seed-firmware`) and when it started. It says nothing about who started it.
- **A safe-to-merge check:** a bounded, journaled wait on the answer, 45 attempts 60 seconds apart, before a merge.

## 5. Design rules (as-built)

`[INFERRED]` Rules the ADRs set:
- **Live state only.** No record that can outlive its job and read as running afterwards.
- **The instance owns the verdict.** Consumers act on it as delivered.
- **Fail closed** on an answer that can't be read.
- **Additive changes** to a consumed payload.

`[UNKNOWN — product input needed]` Whether the gate should stay procedural. The `deploy-safety-gate` book ruled CI enforcement out in July 2026, and the owner kept a deploy-side wait out of this book.

## 6. Carry-forward & open questions

Promoted from the build audit's §6. The candidates for the next phase:
- **Make the gate structural.** The deploy workflow asks the answer itself before it recreates the container (OPEN.md row 340, shape (b)). That would close the gap after a merger's check, and protect against merges that skip it, as #206's did.
- **Make installs robust to a just-finished deploy:**
  - the procedure waits for Neo4j readiness;
  - today's install checks the graph answers;
  - a failed read is reported as a failure.

  (Ledger row `2026-11-22-install-after-a-deploy-loses-neo4j`.)
- **Cover more of what a deploy cuts off:** lifecycle backup, restore and migrate (intake 2026-11-21), and a scheduled task that starts during a long install.
- **Port the change to the sandboxes,** `feat/tags` and `feature-magic-carpet`.

## 7. What product must validate

- [ ] Whether the deploy gate should become structural (enforced by the deploy) rather than procedural (consulted by whoever merges). That reverses an earlier decision.
- [ ] Which other jobs a deploy must not cut off, and how bad each cut-off is: a restore, a migration, a long scoring batch.
- [ ] Whether a scheduled task starting during an install matters enough to prevent.
- [ ] Whether the sandboxes should carry the gate at all, or keep holding merges by hand.
