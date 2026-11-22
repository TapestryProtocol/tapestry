'use strict';
/**
 * The gate's suite registry — honest-test-gate #1, ADR honest-test-gate/0001 §3.
 *
 * ONE ordered list. The order is the execution order (carried over from the hand-written
 * runner this replaced), and every suite is loaded before any runs, so a suite's
 * load-time reads see today's environment whatever its position. Adding a suite is one
 * line here; the engine (test/helpers/gateRunner.js) derives every summary line and
 * every total from this list, so nothing else needs to agree with it.
 *
 *   { file, skipNote? }  file is resolved against test/; skipNote is the reason printed
 *                        when the whole suite skipped (e.g. no live stack).
 *   { name, run }        a pseudo-entry (the config smoke check).
 *
 * Every test/*.test.js file must be in `suites` or in `excluded` with a reason —
 * test/stack-free-npm-test.test.js G5 fails otherwise, so a suite can never be written
 * and then silently never run.
 */

// The config smoke check that used to run ahead of the suites (its env is set in test/test.js).
async function configLoading() {
  const { loadConfig } = require('../lib/config');
  try {
    const config = loadConfig();
    console.log('Configuration loaded successfully:', Object.keys(config));
    return { pass: 1, fail: 0 };
  } catch (error) {
    console.error('Configuration loading failed:', error.message);
    return { pass: 0, fail: 1 };
  }
}

const suites = [
  { name: 'config-loading', run: configLoading },
  { file: 'profile-tags.test.js', skipNote: 'control panel not reachable' },
  { file: 'profile-tags-publish.test.js', skipNote: 'preconditions not met' },
  { file: 'tag-detail.test.js', skipNote: 'control panel not reachable' },
  { file: 'tag-detail-publish.test.js', skipNote: 'preconditions not met' },
  { file: 'tag-detail-write.test.js', skipNote: 'control panel not reachable' },
  { file: 'tag-detail-write-publish.test.js', skipNote: 'preconditions not met' },
  { file: 'tag-index.test.js', skipNote: 'control panel not reachable' },
  { file: 'tag-index-publish.test.js', skipNote: 'preconditions not met' },
  { file: 'authored-tagging.test.js', skipNote: 'control panel not reachable' },
  { file: 'authored-tagging-publish.test.js', skipNote: 'preconditions not met' },
  { file: 'profile-tag-polish.test.js', skipNote: 'control panel not reachable' },
  { file: 'profile-tag-polish-publish.test.js', skipNote: 'preconditions not met' },
  { file: 'search-result-parity.test.js' },
  { file: 'search-results-url.test.js' },
  { file: 'pin-a-tag.test.js', skipNote: 'control panel not reachable' },
  { file: 'pin-a-tag-publish.test.js', skipNote: 'preconditions not met' },
  { file: 'tl-publication-from-pins.test.js', skipNote: 'control panel not reachable' },
  { file: 'tl-publication-from-pins-publish.test.js', skipNote: 'preconditions not met' },
  { file: 'customize-pin-curation-publish.test.js', skipNote: 'preconditions not met' },
  { file: 'most-pinned-tag-index.test.js', skipNote: 'control panel not reachable' },
  { file: 'most-pinned-tag-index-publish.test.js', skipNote: 'preconditions not met' },
  { file: 'tag-detail-curated-view-and-pin-polish.test.js', skipNote: 'control panel not reachable' },
  { file: 'tag-detail-curated-view-and-pin-polish-publish.test.js', skipNote: 'preconditions not met' },
  { file: 'restore-historical-data-and-fix-tl-author-filter.test.js', skipNote: 'control panel not reachable' },
  { file: 'treasure-maps-router-preset.test.js' },
  { file: 'scheduled-search-and-house-scores-refresh.test.js' },
  { file: 'strfry-router-first-boot-config.test.js' },
  { file: 'per-query-neo4j-timeout-safety-net.test.js' },
  { file: 'nip05-checkmark-verification.test.js' },
  { file: 'publish-export-a-concept.test.js' },
  { file: 'community-reference-nostr-relay-stub.test.js' },
  { file: 'nip51-list-export-from-pins.test.js', skipNote: 'control panel not reachable' },
  { file: 'nip51-list-export-from-pins-publish.test.js', skipNote: 'preconditions not met' },
  { file: 'pin-detail-into-tag-pinned-tab.test.js' },
  { file: 'collapse-into-export-concept.test.js' },
  { file: 'login-failure-and-tag-collapse.test.js' },
  { file: 'header-conceptgraph-tag.test.js' },
  { file: 'create-concept-duplicate-check.test.js' },
  { file: 'community-reference-superset-link.test.js' },
  { file: 'graperank-shared-csv-race.test.js' },
  { file: 'community-class-thread-pull.test.js' },
  { file: 'task-queue-bullmq.test.js' },
  { file: 'task-queue-neo4j-resource-class.test.js' },
  { file: 'entrypoint-template-rendering.test.js' },
  { file: 'bullboard-admin-access.test.js' },
  { file: 'admin-tools-dashboard-panel.test.js' },
  { file: 'create-tapestry.test.js' },
  { file: 'reconciliation-incremental-mode.test.js' },
  { file: 'generalized-task-scheduler.test.js' },
  { file: 'reconciliation-rearchitecture.test.js' },
  { file: 'scheduled-tasks-with-arguments.test.js' },
  { file: 'manual-task-retrigger-after-finish.test.js' },
  { file: 'scheduled-task-timeout-propagation.test.js' },
  { file: 'kill-timeout-orphans-by-default.test.js' },
  { file: 'task-queue-semaphore-protection-audit.test.js' },
  { file: 'profile-follows-list.test.js' },
  { file: 'profile-website-link.test.js' },
  { file: 'profile-verified-followers-count.test.js' },
  { file: 'profile-followers-list.test.js' },
  { file: 'profile-verified-reporters-count.test.js' },
  { file: 'verified-reporters-membership-data.test.js' },
  { file: 'verified-reporters-list-page.test.js' },
  { file: 'profile-verified-counts-owner-pov.test.js' },
  { file: 'profile-verified-counts-explainer-and-alarm.test.js' },
  { file: 'search-api-result-type-settings.test.js' },
  { file: 'trusted-list-pin-publish-blockers.test.js' },
  { file: 'nostr-user-tag-hybrid-ea-writer.test.js' },
  { file: 'reputation-info-popup.test.js' },
  { file: 'live-feed-read-path.test.js' },
  { file: 'live-feed-feed-page.test.js' },
  { file: 'note-surfaces-read-path.test.js' },
  { file: 'note-surfaces-ui.test.js' },
  { file: 'event-page-read-path.test.js' },
  { file: 'event-page-ui.test.js' },
  { file: 'verified-reporters-report-columns.test.js' },
  { file: 'profile-identity-details-popover.test.js' },
  { file: 'profile-follows-hops.test.js' },
  { file: 'profile-hops-path.test.js' },
  { file: 'tag-read-union.test.js' },
  { file: 'b-tag-primitive.test.js' },
  { file: 'b-tag-seeds.test.js' },
  { file: 'dual-z-writer.test.js' },
  { file: 'open-ranking-stats.test.js' },
  { file: 'open-ranking-search.test.js' },
  { file: 'open-ranking-rank.test.js' },
  { file: 'open-ranking-followers-muters.test.js' },
  { file: 'verified-muters-read-api.test.js' },
  { file: 'verified-muters-profile-surface.test.js' },
  { file: 'event-tagging-core.test.js' },
  { file: 'event-tagging-spec.test.js' },
  { file: 'global-publish-gate.test.js' },
  { file: 'event-tagging-firmware-seed.test.js' },
  { file: 'event-tagging-read-api.test.js' },
  { file: 'event-tagging-write-path.test.js' },
  { file: 'event-tagging-read-viewer-stance.test.js' },
  { file: 'event-tag-note-affordance-ui.test.js' },
  { file: 'tag-actions-menu-ui.test.js' },
  { file: 'tagging-raw-event-inspector-ui.test.js' },
  { file: 'note-tagging-raw-events-inspector-ui.test.js' },
  { file: 'note-tagging-raw-events-inspector-http.test.js', skipNote: 'preconditions not met' },
  { file: 'event-tagging-for-tag.test.js' },
  { file: 'unified-tag-index.test.js' },
  { file: 'event-tagging-notes-by-author.test.js' },
  { file: 'unified-tags-directory.test.js' },
  { file: 'profile-authored-notes-ui.test.js' },
  { file: 'notes-replies-toggle.test.js' },
  { file: 'feed-pagination.test.js' },
  { file: 'profile-content-card.test.js' },
  { file: 'tag-applicability.test.js' },
  { file: 'tag-applicability-picker.test.js' },
  { file: 'note-trusted-list.test.js' },
  { file: 'profile-tag-consume-by-a-coordinate.test.js' },
  { file: 'pov-selectable-tag-surfaces.test.js' },
  { file: 'pov-resolution-status.test.js' },
  { file: 'pov-rank-threshold-key.test.js' },
  { file: 'pov-notice-text.test.js' },
  { file: 'pov-state-unification.test.js' },
  { file: 'applicability-republish.test.js' },
  { file: 'harness-lint.test.js' },
  { file: 'protocols-index.test.js' },
  { file: 'harness-stats.test.js' },
  { file: 'session-start.test.js' },
  { file: 'ledger-row-ids.test.js' },
  { file: 'rollup-scanners.test.js' },
  { file: 'stack-free-npm-test.test.js' },
  { file: 'ci-test-job.test.js' },
  { file: 'workflow-hardening.test.js' },
  { file: 'sync-panel-tag-filters.test.js' },
  { file: 'router-stream-tag-filters.test.js' },
  { file: 'deploy-safety-status.test.js', skipNote: 'preconditions not met' },
  { file: 'deploy-safety-sees-installs.test.js' },
  { file: 'safe-to-merge-check.test.js' },
  { file: 'next-task-countdown.test.js' },
  { file: 'close-unauth-write-surface.test.js' },
  { file: 'neo4j-query-public-reads.test.js' },
  { file: 'default-deny-mutations.test.js' },
  { file: 'login-signature-verification.test.js' },
  { file: 'publish-event-signature-verification.test.js' },
  { file: 'users-page-neo4j-endpoint.test.js' },
  { file: 'strfry-wipe-owner-gate.test.js' },
  { file: 'strfry-router-owner-gate.test.js' },
  { file: 'strfry-router-value-hardening.test.js' },
  { file: 'strfry-router-saved-state.test.js' },
  { file: 'router-config-reload-in-place.test.js' },
  { file: 'router-stream-limit-on-connect.test.js' },
  { file: 'negentropy-sync-presets.test.js' },
  { file: 'relationship-primitives.test.js', skipNote: 'preconditions not met' },
  { file: 'relationship-primitives-probe.test.js', skipNote: 'preconditions not met' },
  { file: 'event-less-create-set.test.js', skipNote: 'preconditions not met' },
  { file: 'strfry-write-assertion-bracket.test.js', skipNote: 'preconditions not met' },
  { file: 'move-nodes-between-sets-ui.test.js', skipNote: 'preconditions not met' },
  { file: 'capture-a-goal-and-see-it.test.js', skipNote: 'preconditions not met' },
  { file: 'firmware-concept-elements-sets.test.js', skipNote: 'preconditions not met' },
  { file: 'tapestry-per-concept-detail-views.test.js', skipNote: 'preconditions not met' },
  { file: 'structures-the-brain-can-trust.test.js', skipNote: 'preconditions not met' },
  { file: 'break-a-goal-into-pieces.test.js', skipNote: 'preconditions not met' },
  { file: 'attach-the-world.test.js', skipNote: 'preconditions not met' },
  { file: 'sessions-read-the-brain.test.js', skipNote: 'preconditions not met' },
  { file: 'the-proposal-loop.test.js', skipNote: 'preconditions not met' },
  { file: 'teach-it-what-matters.test.js', skipNote: 'preconditions not met' },
  { file: 'the-brain-survives.test.js', skipNote: 'preconditions not met' },
  { file: 'operational-direction.test.js', skipNote: 'preconditions not met' },
  { file: 'store-the-four-when-a-goal-is-captured-or-updated.test.js', skipNote: 'preconditions not met' },
  { file: 'return-the-four-on-every-read-surface.test.js', skipNote: 'preconditions not met' },
  { file: 'show-the-four-on-the-goal-screens-that-already-exist.test.js', skipNote: 'preconditions not met' },
  { file: 'in-app-badged-ta-avatar.test.js' },
  { file: 'recognizable-published-ta-profile.test.js' },
  { file: 'stamped-composite-avatar.test.js' },
  { file: 'tapestry-key-put-await.test.js' },
  { file: 'add-a-concept-to-a-tapestry.test.js' },
  { file: 'take-a-concept-back-out.test.js' },
  { file: 'brain-first-tapestry-authoring.test.js' },
  { file: 'b-coverage-audit-and-disposition.test.js' },
  { file: 'adoption-candidates-queue.test.js' },
  { file: 'inverse-queue-publish-candidates.test.js' },
  { file: 'publish-time-default-stamping.test.js' },
  { file: 'trusted-dictionary.test.js' },
  { file: 'dictionary-concepts.test.js' },
  { file: 'dictionary-entry.test.js' },
  { file: 'dictionary-managed-by.test.js' },
  { file: 'dictionary-new-concept.test.js' },
  { file: 'dictionary-gum2.test.js' },
  { file: 'dictionary-wired-create.test.js' },
  { file: 'dictionary-edit-concept.test.js' },
  { file: 'dictionary-resync-concept.test.js' },
  { file: 'dictionary-github-account.test.js' },
  { file: 'dictionary-v4v-song.test.js' },
  { file: 'adoption-twins.test.js' },
  { file: 'adoption-raw-event-view.test.js' },
  { file: 'state-on-concept-page.test.js' },
  { file: 'shared-by-me.test.js' },
  { file: 'retire-offering-vocabulary.test.js' },
  { file: 'site-trust-signals.test.js' },
  { file: 'llms-txt.test.js' },
  { file: 'information-for-agents.test.js' },
  { file: 'live-link-checks.test.js' },
  { file: 'tl-membership-method-selector.test.js' },
  { file: 'tl-weighted-sum-method.test.js' },
  { file: 'tl-certainty-method.test.js' },
  { file: 'tl-treasure-map-panel.test.js' },
  { file: 'tl-treasure-map-optin-publish.test.js' },
  { file: 'neo4j-sizing-override.test.js' },
  { file: 'brains-launcher-repo.test.js' },
  { file: 'brains-launcher-service.test.js' },
  { file: 'score-auto-sync.test.js' },
  { file: 'relay-scan-bounds.test.js' },
  { file: 'profile-lookup-bounds.test.js' },
  { file: 'honest-broadcast-reporting.test.js' },
  { file: 'honest-publish-reporting.test.js' },
  { file: 'honest-publish-reporting-ci-guard.test.js' },
  { file: 'not-yet-shared-filter.test.js', skipNote: 'preconditions not met' },
  { file: 'share-from-shared-by-me.test.js' },
  { file: 'treasure-map-relay-presence.test.js' },
  { file: 'treasure-map-relay-sync.test.js' },
  { file: 'treasure-map-panel-summary.test.js' },
  { file: 'add-node-as-element-restore.test.js' },
  { file: 'concept-count-canonical.test.js' },
  { file: 'summaries-element-count.test.js' },
  { file: 'dlist-curation-tl-panel.test.js' },
  { file: 'dlist-curation-header-endpoint.test.js' },
  { file: 'dlist-curation-panel.test.js' },
  { file: 'dlist-curation-map-entries.test.js' },
  { file: 'dlist-curation-merge-preserve.test.js' },
  { file: 'my-curated-dlists-page.test.js' },
  { file: 'my-curated-dlists-headers.test.js' },
  { file: 'my-curated-dlists-items.test.js' },
  { file: 'curated-dlist-update-pointer-switch.test.js' },
  { file: 'curated-dlist-update-read-only-curation.test.js' },
  { file: 'curated-dlist-update-curation-method.test.js' },
  { file: 'curated-dlist-update-update-preview.test.js' },
  { file: 'curated-dlist-update-publish.test.js' },
  { file: 'assistant-setup-state.test.js' },
  { file: 'assistant-publish-relays.test.js' },
  { file: 'one-default-assistant-profile.test.js' },
  { file: 'my-assistant-page.test.js' },
  { file: 'one-writer-assistant-profile.test.js' },
  { file: 'gate-result-record.test.js' },
  { file: 'suite-env-changes.test.js' },
  { file: 'harden-user-data-error-path.test.js' },
  { file: 'harden-compute-endpoint.test.js' },
  { file: 'shared-concepts-row-detail.test.js' },
  { file: 'nip05-ssrf-guard.test.js' },
  { file: 'author-scoped-inspection-roster.test.js' },
  { file: 'author-scoped-inspection-views.test.js' },
  { file: 'setup-status.test.js' },
  { file: 'setup-alert.test.js' },
  { file: 'setup-alert-polish.test.js' },
  { file: 'setup-create-account.test.js' },
  { file: 'setup-open-sign-up.test.js' },
  { file: 'assistant-management-page.test.js' },
  { file: 'assistant-alert.test.js' },
  { file: 'assistant-attention.test.js' },
  { file: 'assistant-identification-tags-page.test.js' },
  { file: 'assistant-taggings-publish.test.js' },
  { file: 'negentropy-sync-input.test.js' },
  { file: 'negentropy-sync-access.test.js' },
  { file: 'auth-path-case.test.js' },
  { file: 'task-routes-owner-admin.test.js' },
  { file: 'auth-head-requests.test.js' },
  // security-auth-exposure #8 — the admin-action sweep: one total route table, default-deny (ADR 0005). The structural
  // half (route-walk coverage, AC-6, resolver agreement) and the behavioural half (AC-1/2/3/4/5/7 + the two owner-only
  // parameter rules) through the real middleware and the conf seam. The named half pins class-A members and the two
  // closed reads by name, so it ships only in the same commit as the fix (disclosure).
  { file: 'admin-action-sweep.test.js' },
  { file: 'admin-action-sweep-access.test.js' },
  { file: 'admin-action-sweep-named.test.js' },
  // security-auth-exposure #9 — the config reader logs key names, never values (ngit c549202b).
  { file: 'config-secret-logging.test.js' },
  // security-auth-exposure #10 — sourcing the config file never puts its contents in a log.
  { file: 'config-source-stderr.test.js' },
  // security-auth-exposure #11 — a config file bash can't parse never reaches a log (ADR 0006).
  { file: 'config-parse-leak.test.js' },
  { file: 'shell-input-hardening.test.js' },
  { file: 'assistant-profile-check.test.js' },
  { file: 'assistant-trusted-content.test.js' },
  { file: 'assistant-shared-categories.test.js' },
  { file: 'assistant-coming-soon.test.js' },
  { file: 'assistant-profile-checklist-page.test.js' },
  { file: 'assistant-stamped-avatar-for-everyone.test.js' },
  { file: 'assistant-outbox-check.test.js' },
  { file: 'assistant-outbox-relays-page.test.js' },
  { file: 'assistant-relay-list-publish.test.js' },
  { file: 'assistant-duty-cards.test.js' },
  { file: 'assistant-duty-menu-check.test.js' },
  { file: 'assistant-duty-menu-page.test.js' },
  { file: 'assistant-duty-menu-publish.test.js' },
  // assistant-self-map #1: the self-Map check and the Your Assistant's Treasure Map page (ADR assistant-self-map/0001).
  { file: 'assistant-self-map-check.test.js' },
  { file: 'assistant-self-map-page.test.js' },
  // assistant-self-map #2: turning the self-Map on and off — the merge, the choice, the press (ADR assistant-self-map/0002).
  { file: 'assistant-self-map-publish.test.js' },
  // assistant-duties-settings #1: the Assistant Duties tab and the offer it sets (ADR assistant-duties-settings/0001).
  { file: 'assistant-duties-settings.test.js' },
  { file: 'my-assistants-page.test.js' },
  { file: 'my-assistants-actions.test.js' },
  { file: 'my-assistants-map.test.js' },
  { file: 'my-assistants-nip05.test.js' },
  { file: 'manage-treasure-map-page.test.js' },
  { file: 'manage-treasure-map-cards.test.js' },
  { file: 'treasure-map-card-rule-edges.test.js' },
  { file: 'treasure-map-star-scopes-ignored.test.js' },
  { file: 'treasure-map-edit-mode.test.js' },
  { file: 'treasure-map-switches.test.js' },
  { file: 'treasure-map-save.test.js' },
  { file: 'treasure-map-needs-attention.test.js' },
  { file: 'treasure-map-card-details.test.js' },
  { file: 'list-headers-author-options.test.js' },
  { file: 'list-headers-disposition-column.test.js' },
  { file: 'list-headers-my-assistant-disposition.test.js', skipNote: 'control panel not reachable (live refusals)' },
  { file: 'list-headers-me-disposition.test.js', skipNote: 'control panel not reachable (live refusals)' },
  { file: 'tagging-edge-contract.test.js' },
  { file: 'tagging-edges-sweep.test.js' },
  { file: 'strfry-scan-strict.test.js' },
  { file: 'tagging-edges-runner.test.js' },
  { file: 'tagging-edges-state-routes.test.js' },
  { file: 'tagging-edges-wiring.test.js' },
  { file: 'tagging-edges-realtime-plan.test.js' },
  { file: 'tagging-edges-realtime-engine.test.js' },
  { file: 'tagging-edges-realtime-routes.test.js' },
  { file: 'tagging-edges-switch-record.test.js' },
  { file: 'tagging-edges-realtime-wrapper.test.js' },
  { file: 'tagging-edges-realtime-lineage.test.js' },
  { file: 'tagging-edges-realtime-resilience.test.js' },
  { file: 'tagging-edges-realtime-property.test.js', skipNote: 'the full fixed campaign is opt-in: set TAGGING_EDGES_PROPERTY=1' },
  { file: 'tagging-edges-realtime-subscription.test.js' },
  { file: 'tagging-edges-live.test.js', skipNote: 'no local Neo4j in the environment (NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD)' },
  { file: 'strfry-count-strict.test.js' },
  { file: 'tagging-edges-drift-route.test.js' },
  // tagging-edges #6: running and stopping the pass — the controller, the worker's job gate, the routes (ADR tagging-edges/0006).
  { file: 'tagging-edges-pass-control.test.js' },
  { file: 'task-queue-job-gate.test.js' },
  { file: 'tagging-edges-pass-routes.test.js' },
  { file: 'tagging-edges-confirm.test.js' },
  { file: 'tagging-edges-confirmation-lib.test.js' },
  { file: 'tagging-edges-overdue.test.js' },
  { file: 'tagging-edges-held-fixture.test.js' },
  { file: 'tagging-pipeline-view.test.js' },
  { file: 'tagging-pipeline-codes.test.js' },
  { file: 'tagging-pipeline-fetch.test.js' },
  { file: 'tagging-pipeline-panel-source.test.js' },
  { file: 'about-this-instance.test.js' },
  { file: 'assistant-scores-route.test.js' },
  { file: 'assistant-scores-page.test.js' },
  { file: 'task-queue-jobid-valid.test.js' },
  // appearance-setting #1: the appearance library, the pre-render script, the design shell's tokens (ADR appearance-setting/0001).
  { file: 'appearance-setting.test.js' },
  // appearance-setting #2: the reading paths, the light scope, Dark unchanged (ADR appearance-setting/0002).
  { file: 'appearance-setting-light.test.js' },
  // appearance-setting #3: the working paths, the whole profile family converted, the /about chip (ADR appearance-setting/0003).
  { file: 'appearance-setting-working.test.js' },
  // appearance-setting #4: the search home's exact path, its rules converted, the badges and stale marker (ADR appearance-setting/0004).
  { file: 'appearance-setting-home.test.js' },
  // openapi-coverage #1: the API document against the routes the server registers, with a shrink-only gap list
  // (test/fixtures/openapi-known-gaps.json), and what the document and BIBLE §11 say about it (ngit 7a13648f).
  { file: 'openapi-coverage.test.js' },
  { file: 'openapi-document.test.js' },
  // graph-operations-foundation #1: the operations module — one declaration per operation, and its route, route-table
  // entry, /docs entry, command and list entry made from it (ADR graph-operations-foundation/0001). It also runs every
  // suite under test/operations/, so an operation's own suite needs no line here (ADR Decision 12).
  { file: 'operations.test.js' },
  // graph-operations-foundation #5: the concept of neo4j properties in firmware, its two sets and its manifest entry
  // (ADR graph-operations-foundation/0005 Decisions 1 and 2). The story's operation suites live under test/operations/.
  { file: 'neo4j-property-firmware.test.js' },

  // graph-operations-foundation #6: the external CLI in clients/cli/, made from the instance's list of operations, and
  // the agent's skill beside it (ADR graph-operations-foundation/0006). Its instances are loopback children of its own.
  { file: 'external-cli.test.js' },
  // graph-operations-foundation #8: a firmware install's Pass 3 rebuilds only the nodes with an address, and no rebuild
  // reads the whole graph. Stack-free in every run; its live checks run only against a scratch container (tapestry-scratch…).
  { file: 'pass-3-finishes-in-minutes.test.js' },
  // graph-operations-foundation #10: a schema save lands on the header its caller means, never on another author's
  // same-named one. Stack-free in every run; its live checks run only against a scratch container (tapestry-scratch…).
  { file: 'schema-save-finds-the-right-header.test.js' },
  // graph-operations-first-slice #41: the graph rule concept, made from the rulebook and the rules' code by
  // src/firmware/graph-rules.js, and kept in line by every install (ADR graph-operations-first-slice/0041). Stack-free in
  // every run; graph-rule-firmware's live checks run only against a scratch container (tapestry-scratch…).
  { file: 'graph-rules-builder.test.js' },
  { file: 'graph-rule-firmware.test.js' },
  { file: 'firmware-element-sync.test.js' },
  // graph-operations-first-slice #47: firmware's nodes, and each new concept's JSON schema, hold the keys of the concepts
  // they belong to (ADR graph-operations-first-slice/0047 Decisions 8 to 10). Stack-free in every run: firmware's files,
  // the old create-concept route in a sandbox, Pass 1 in a child, and graph create-concept over a fake graph. The rule
  // word-types-hold-concept-keys and its rules check suites live under test/operations/rules/.
  { file: 'firmware-nodes-hold-their-concepts-keys.test.js' },
  // graph-operations-first-slice #44: the Concepts page and the Dashboard's Concepts tile show a concept with no event,
  // as graph create-concept makes one, and its row offers no Disposition… until it has one. Stack-free in every run;
  // its live checks run only against a scratch container (tapestry-scratch…).
  { file: 'concepts-list-shows-concepts-with-no-event.test.js' },
  // graph-operations-first-slice #46: an element of `word` fits the `word` schema an install leaves, since install no
  // longer writes the wordType pair that compares `word.wordTypes` with itself (Loom P-156). Stack-free in every run:
  // the install's enumeration step and Pass 2 run in a child over a fake graph (test/helpers/saveSchemaChild.js).
  { file: 'word-elements-fit-the-installed-word-schema.test.js' },
  // container-apt-refresh #1: every build of the tapestry image brings its Ubuntu packages up to date once a week
  // (ADR container-apt-refresh/0001). Stack-free in every run: it reads the Dockerfile, compose file, workflows and
  // docs, and runs each deploy script under bash with docker, git and sed stubbed. Its live checks (L1–L4) run the
  // refresh step in throwaway containers only with TAPESTRY_LIVE_DOCKER_CHECKS=1.
  { file: 'container-apt-refresh.test.js' },
  // community-reference #39: a firmware install leaves each header's tags once (ADR community-reference/0035). Stack-free
  // in every run: the prune builder over test/helpers/cypherEngine.js, and install's community references and their edge
  // wiring in a child over the same engine (test/helpers/communityStepChild.js).
  { file: 'community-references-prune-builder.test.js' },
  { file: 'firmware-install-leaves-tags-once.test.js' },
];

// Suite files that had never been registered in the runner as of 2026-09-12. Listed so
// they are visible rather than silent; their disposition (register or retire) belongs
// to the event-tagging reconciliation (OPEN.md row 38).
const NOT_RUN = 'not run as of 2026-09-12; disposition pending the event-tagging reconciliation (OPEN.md row 38)';
const excluded = [
  { file: 'generalized-tag-pinning.test.js', reason: NOT_RUN },
  { file: 'pinned-notes-display.test.js', reason: NOT_RUN },
  { file: 'signer-guard-rollout.test.js', reason: NOT_RUN },
  { file: 'tag-a-note-modal.test.js', reason: NOT_RUN },
];

module.exports = { suites, excluded };
