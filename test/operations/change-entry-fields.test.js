'use strict';
/**
 * The change entry's new fields — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-foundation/5-field-mapping.md (AC2, AC4, AC5: each answers and
 *          records its change entry)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0005-field-mapping.md (Decision 12, extending ADR 0004
 *          Decisions 2 and 5 without changing what's there)
 *
 * Stack-free: src/operations/changes.js is required as it is, and opens nothing.
 *
 *   CE1 CHANGE gains concept, field and property (strings) and nodes (a list of tapestryKeys), all optional, and keeps
 *       every field it had, with `change` still the only one required
 *   CE2 keysOf adds concept and every key in nodes to node, from and to, each key once
 *   CE3 keysOf still answers what it did for ADR 0004's changes
 */

const path = require('path');
const S = require('../helpers/graphOpsSuite');

const { ROOT, assert, show } = S;
const { test, run } = S.makeSuite('operations: the change entry\'s new fields');

const changes = () => require(path.join(ROOT, 'src/operations/changes.js'));
const K = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('CE1: CHANGE gains concept, field and property (strings) and nodes (a list of keys), optional, keeping all it had', () => {
  const { CHANGE } = changes();
  const p = CHANGE.properties || {};
  for (const f of ['concept', 'field', 'property']) {
    assert(p[f] && p[f].type === 'string', `CHANGE has no \`${f}\` string field yet (ADR graph-operations-foundation/0005 Decision 12); its fields: ${show(Object.keys(p))}`);
  }
  assert(p.nodes && p.nodes.type === 'array' && p.nodes.items && p.nodes.items.type === 'string', `CHANGE has no \`nodes\` list of tapestryKeys yet (ADR 0005 Decision 12); got ${show(p.nodes)}`);
  for (const f of ['change', 'type', 'from', 'to', 'node', 'count']) assert(p[f], `CHANGE keeps ${f} (ADR 0004 Decision 5)`);
  assert(show(CHANGE.required) === show(['change']), `only change is required, as before; got ${show(CHANGE.required)}`);
});

test('CE2: keysOf adds concept and every key in nodes to node, from and to, each key once', () => {
  const { keysOf } = changes();
  const got = keysOf([
    { change: 'field-marked', node: K(1), concept: K(2), field: 'breed', property: 'dog_breed' },
    { change: 'copies-set', property: 'dog_breed', nodes: [K(3), K(4), K(3)], count: 2 },
    { change: 'copies-removed', property: 'dog_retired', nodes: [K(4), K(5)], count: 2 },
  ]);
  const want = [K(1), K(2), K(3), K(4), K(5)];
  assert(show([...got].sort()) === show(want), `the property node, the concept and every node whose copy changed, each once (so graph history finds a mark's entries by each); got ${show(got)}`);
  assert(new Set(got).size === got.length, `no key twice; got ${show(got)}`);
});

test('CE3: keysOf still answers what it did for ADR 0004\'s changes', () => {
  const { keysOf } = changes();
  assert(show(keysOf([{ change: 'relationship-added', type: 'CITES', from: K(1), to: K(2) }])) === show([K(1), K(2)]), 'from and to, in that order');
  assert(show(keysOf([{ change: 'relationship-removed', type: 'CITES', from: K(1), to: K(1), count: 2 }])) === show([K(1)]), 'a key named twice, once');
  assert(show(keysOf([{ change: 'x', field: 'breed', property: 'dog_breed' }])) === '[]', 'a field or a property name is no key');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
