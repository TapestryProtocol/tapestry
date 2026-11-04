# Story 1: Launch a brain

**Status:** In progress
**Epic:** brains-launcher

## As a

Team member on the launcher's allowlist.

## I want

To press one button and get my own Tapestry instance at `<slug>.tapestry.ninja`, owned by my nostr key, knowing only me.

## So that

I can add my agent as an admin and start putting my own knowledge in, without setting up a droplet by hand.

## Acceptance criteria

1. **Launch.** A signed request from an allowlisted key creates a brain owned by the signer. Status goes
   `creating` to `running`, in under three minutes on a warm box.
2. **Blank.** A new brain has firmware installed, no list items, every router preset off, and the search services
   stopped. Its relay router has no streams, including during first boot.
3. **Isolation.** No brain publishes a port. Each has its own network, volumes, Redis and Neo4j. Only Caddy joins a
   brain's network, and only the launcher mounts the Docker socket.
4. **Refusals.** Bad or stale signatures get 401. A key off the allowlist gets 403. Bad slugs, reserved slugs, and
   hitting a cap each get their own message. A key that isn't the owner can't read, destroy or restore a brain.
5. **Destroy and restore.** Destroy removes containers and keeps volumes for 7 days. Restore brings the brain back with
   its data. After the grace period, the reaper removes the volumes and frees the slug. The owner can start fresh
   under the same slug by choosing to delete the kept volumes early.
6. **A failed brain keeps its data.** A brain that has ever run keeps its volumes and its grace period if it later
   fails. Only a brain that never reached `running` is deleted with no grace.
7. **Roll.** One command pulls the new image and updates each running brain in turn. If a brain does not come back,
   the roll stops there, marks it `failed`, and leaves the rest alone.
8. **Reboot.** After a droplet reboot, every running brain is reachable within five minutes with no hands.
9. **Existing droplets unchanged.** With none of the new variables set and no container memory limit, the entrypoint
   sizes Neo4j exactly as before, and firmware is not installed on boot.
10. **Honest about reach.** The launcher page and the runbook say plainly that what is in a brain can be read by anyone
    with its URL.

## Out of scope

The MCP or CLI question for agents, the social switch, a second backend, backups and monitoring, a page for stopped
brains, per-brain version pinning, editing the allowlist from the page, and making a brain's contents private.
