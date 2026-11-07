'use strict';
/**
 * The 20 /api/normalize routes that openapi-coverage #1 documents (story
 * engineering-team/stories/openapi-coverage/1-coverage-test-and-normalize-docs.md, AC3). They were the
 * undocumented normalize routes on 2026-11-06. Shared by test/openapi-document.test.js (the entries' content)
 * and tests/brainstorm/openapi-docs.spec.js (the /docs page shows them).
 */
const NORMALIZE_ROUTES = [
  ['POST', '/api/normalize/reconcile-primary-property'],
  ['POST', '/api/normalize/create-child-goal'],
  ['POST', '/api/normalize/update-goal-intent'],
  ['POST', '/api/normalize/create-resource'],
  ['POST', '/api/normalize/verify-resource'],
  ['POST', '/api/normalize/create-work-record'],
  ['POST', '/api/normalize/note-goal-idea'],
  ['POST', '/api/normalize/make-proposal'],
  ['POST', '/api/normalize/approve-proposal'],
  ['POST', '/api/normalize/skip-proposal'],
  ['POST', '/api/normalize/record-priority-signal'],
  ['POST', '/api/normalize/restore-brain'],
  ['POST', '/api/normalize/record-restore-drill'],
  ['POST', '/api/normalize/adoption-disposition'],
  ['POST', '/api/normalize/trusted-dictionary-snapshot'],
  ['POST', '/api/normalize/add-relationship'],
  ['POST', '/api/normalize/delete-relationship'],
  ['GET', '/api/normalize/relationship-primitives'],
  ['POST', '/api/normalize/add-subset'],
  ['GET', '/api/normalize/node-primitives'],
];

module.exports = { NORMALIZE_ROUTES };
