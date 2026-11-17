'use strict';
/**
 * The graphs the search suites seed for test/helpers/graphFake.js (story graph-operations-first-slice #8, ADR
 * graph-operations-first-slice/0008). TA, the owner and the admin are test/helpers/graphOpsSuite.js's unless given.
 * Every node is the assistant's unless its line says otherwise. The suites name nodes by the names below (seed.keys[name]).
 *
 * The full-text index: `fulltextIndexes` holds graph_search_text, ONLINE, on TapestryNode over name, tapestryValue and
 * value, as ADR 0008 Decision 1 makes it. `index: 'populating'` makes it POPULATING at 45%, and `index: 'missing'`
 * leaves it out.
 *
 * Every element is a ListItem with an address, a json tag holding its word wrapper (a word section, then its concept's
 * section), a name tag, a d tag holding its slug and a z tag naming its concept. Its texts, as Decision 3 reads them,
 * are its name and its section's fields. The word section's slug, name, title and wordTypes are not texts.
 *
 * Two concepts:
 *   ruleHeader 'rule' (a description tag, 'One sentence a specification commits to.', and the same in its JSON, plural
 *     'rules') -IS_THE_CONCEPT_FOR-> ruleSuperset 'rules' ('Every rule there is.') -IS_A_SUPERSET_OF-> mustSet
 *     'obligations' ('The rules that bind.'); mustSet -HAS_ELEMENT-> ruleMust; every other rule under ruleSuperset.
 *   docHeader 'document' (no description tag; 'A file in a repository.' in its JSON, plural 'documents')
 *     -IS_THE_CONCEPT_FOR-> docSuperset 'documents' ('Every document there is.') -HAS_ELEMENT-> docLong, ruleDoc.
 *   ruleDoc is an element of both: ruleSuperset -HAS_ELEMENT-> ruleDoc too.
 *
 * The rules, by statement (each strength MUST unless given):
 *   ruleTa        'Resolve each TA pubkey at runtime, and never hardcode it.'      name 'Pubkey at runtime'
 *   ruleDog       'Every dog carries a name.'                                      name 'Hound naming'
 *   ruleKey       'The statement of a law is one sentence.'                        name 'Keyword fields' (SHOULD)
 *   ruleRelay     'A relay keeps the events it is sent.'                           name 'Kept events'
 *   ruleRelays    'Relays answer filters.'                                         name 'Filters answered'
 *   ruleDecided   'A decided record stays in force until a later one replaces it.' name 'Standing records'
 *   ruleStill     'Still waters run deep.'                                         name 'Quiet hours'
 *   ruleAllThree  'It is decided and still in force.'                              name 'Settled matters'
 *   tierBoth      'alphaword betaword.'                                            name 'Pair one'
 *   tierAlpha4    'alphaword alphaword alphaword alphaword.'                       name 'Pair two'
 *   tierAlpha1    'alphaword.'                                                     name 'Pair three'
 *   tieC          'gammaword gammaword deltaword.'                                 name 'Twin' (fixed key …100)
 *   tieA, tieB    'gammaword deltaword.'                                           name 'Twin' (fixed keys …101, …102)
 *   ruleBind      'Keys tie a label to its node, and nothing else bind them.'      name 'Label keys'
 *   ruleMust      'iotaword lambdaword.'                                           name 'Bound duty' (under mustSet)
 *   ruleDoc       'iotaword.'                                                      name 'Shared item' (rule and document)
 *   povTa, povOwner, povAnon, povHi, povLo, povNoScore, povNoUser: 'epsilonword.', name 'Viewpoint', authored by the
 *     assistant, the owner, no one, a peer scored 0.2, one scored 0.01, a NostrUser with no influence, and a pubkey
 *     with no NostrUser.
 *
 * And:
 *   docLong      a document: title 'Field guide', a description of 420 characters with 'kappaword' at about 200,
 *                headings 'Overview', 'Map location hints' and 'Kappaword list'.
 *   zetaNode     a rule whose d tag holds 'zetaword' and none of whose texts do.
 *   offNode      a rule named 'Thetaword offloaded', its json tag an LMDB reference ('lmdb:<its key>').
 *   cardSet      a node labelled Set with no address, named 'every card'.
 *   change       a change entry (GraphChange) named 'epsilonword change'.
 *
 * The scores: hi 0.2, lo 0.01, noscore (no influence), the owner 1. With `unscored` no NostrUser has an influence.
 *
 * seedSearch(opts) → { state, keys, uuids, eids, pubkeys, file(dir) }.
 * seedSearchBound({ n }) → the same shape: n nodes named 'omegaword <i>', each under boundSuperset, and nothing else
 *   holding omegaword, for the bound (5,000 nodes read).
 */

const path = require('path');
const crypto = require('crypto');
const { emptyState, writeState } = require('./graphFake');
const S = require('./graphOpsSuite');

const PEERS = Object.freeze({
  hi: '11'.repeat(32),
  lo: '22'.repeat(32),
  noscore: '33'.repeat(32),
  nouser: '44'.repeat(32),
  stranger: 'ef'.repeat(32),
});

/** A tapestryKey whose place in tapestryKey order is fixed by n. */
const fixedKey = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const FIXED_KEYS = Object.freeze({ tieC: fixedKey(100), tieA: fixedKey(101), tieB: fixedKey(102) });

const INDEX = Object.freeze({
  name: 'graph_search_text',
  type: 'FULLTEXT',
  entityType: 'NODE',
  labelsOrTypes: ['TapestryNode'],
  properties: ['name', 'tapestryValue', 'value'],
  options: { indexProvider: 'fulltext-1.0', indexConfig: { 'fulltext.analyzer': 'standard-no-stop-words', 'fulltext.eventually_consistent': false } },
});

function indexesFor(index) {
  if (index === 'missing') return [];
  if (index === 'populating') return [{ ...INDEX, state: 'POPULATING', populationPercent: 45 }];
  return [{ ...INDEX, state: 'ONLINE', populationPercent: 100 }];
}

function builder(ta, index) {
  const s = emptyState({ fulltextIndexes: indexesFor(index) });
  const keys = {};
  const uuids = {};
  const eids = {};
  const add = (name, labels, props) => {
    const p = { ...props };
    if (p.tapestryKey === undefined) p.tapestryKey = FIXED_KEYS[name] || crypto.randomUUID();
    const n = { eid: s.nextEid++, labels, props: p };
    s.nodes.push(n);
    if (name) {
      keys[name] = p.tapestryKey;
      if (p.uuid) uuids[name] = p.uuid;
      eids[name] = n.eid;
    }
    return n;
  };
  const link = (from, type, to) => { const r = { eid: s.nextEid++, type, from: from.eid, to: to.eid, props: {} }; s.rels.push(r); return r; };
  const tag = (node, type, value) => link(node, 'HAS_TAG', add(null, ['NostrEventTag', 'TapestryNode'], { type, value }));
  /** An element: a ListItem with an address and its word wrapper, under `parents` (each HAS_ELEMENT it). */
  const element = (name, { title, section, fields, parents, pubkey = ta, concept, json }) => {
    const props = { kind: 39999, uuid: `39999:${pubkey === null ? ta : pubkey}:${name}`, name: title };
    if (pubkey !== null) props.pubkey = pubkey;
    const n = add(name, ['NostrEvent', 'ListItem', 'TapestryNode'], props);
    const slug = `${section}-${name.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    const wrapper = { word: { slug, name: title, title, wordTypes: ['word', section] }, [section]: fields };
    tag(n, 'json', json === undefined ? JSON.stringify(wrapper) : json);
    tag(n, 'name', title);
    tag(n, 'd', slug);
    if (concept) tag(n, 'z', concept);
    for (const p of parents) link(p, 'HAS_ELEMENT', n);
    return n;
  };
  return { s, keys, uuids, eids, add, link, tag, element };
}

function finish(s, keys, uuids, eids, pubkeys) {
  return {
    state: s,
    keys,
    uuids,
    eids,
    pubkeys,
    file(dir) {
      const f = path.join(dir, `search-graph-${crypto.randomUUID()}.json`);
      writeState(f, s);
      return f;
    },
  };
}

function seedSearch({ owner = S.OWNER, ta = S.TA, unscored = false, index = 'online' } = {}) {
  const { s, keys, uuids, eids, add, link, tag, element } = builder(ta, index);
  const person = (pubkey, influence) => add(null, ['NostrUser', 'TapestryNode'], unscored || influence === undefined ? { pubkey } : { pubkey, influence });

  // ── the concepts ──
  const headerJson = (plural, description, singular) => JSON.stringify({
    word: { slug: `concept-header-for-the-concept-of-${plural}`, name: `concept header for the concept of ${plural}`, title: `Concept Header for the Concept of ${plural}`, wordTypes: ['word', 'conceptHeader'] },
    conceptHeader: { description, oNames: { singular, plural } },
  });
  const ruleHeader = add('ruleHeader', ['NostrEvent', 'ListHeader', 'ConceptHeader', 'TapestryNode'], { kind: 39998, uuid: `39998:${ta}:rule`, name: 'rule', pubkey: ta });
  tag(ruleHeader, 'json', headerJson('rules', 'One sentence a specification commits to.', 'rule'));
  tag(ruleHeader, 'description', 'One sentence a specification commits to.');
  const docHeader = add('docHeader', ['NostrEvent', 'ListHeader', 'ConceptHeader', 'TapestryNode'], { kind: 39998, uuid: `39998:${ta}:document`, name: 'document', pubkey: ta });
  tag(docHeader, 'json', headerJson('documents', 'A file in a repository.', 'document'));
  const setJson = (section, name, description) => JSON.stringify({ word: { slug: name, name, title: name, wordTypes: ['word', section] }, [section]: { name, description } });
  const ruleSuperset = add('ruleSuperset', ['NostrEvent', 'ListItem', 'Superset', 'TapestryNode'], { kind: 39999, uuid: `39999:${ta}:rules`, name: 'rules', pubkey: ta });
  tag(ruleSuperset, 'json', setJson('superset', 'rules', 'Every rule there is.'));
  const docSuperset = add('docSuperset', ['NostrEvent', 'ListItem', 'Superset', 'TapestryNode'], { kind: 39999, uuid: `39999:${ta}:documents`, name: 'documents', pubkey: ta });
  tag(docSuperset, 'json', setJson('superset', 'documents', 'Every document there is.'));
  const mustSet = add('mustSet', ['NostrEvent', 'ListItem', 'Set', 'TapestryNode'], { kind: 39999, uuid: `39999:${ta}:obligations`, name: 'obligations', pubkey: ta });
  tag(mustSet, 'json', setJson('set', 'obligations', 'The rules that bind.'));
  link(ruleHeader, 'IS_THE_CONCEPT_FOR', ruleSuperset);
  link(docHeader, 'IS_THE_CONCEPT_FOR', docSuperset);
  link(ruleSuperset, 'IS_A_SUPERSET_OF', mustSet);

  // ── the rules ──
  const ruleZ = `39998:${ta}:rule`;
  const rule = (name, title, statement, { strength = 'MUST', pubkey, parents = [ruleSuperset], json } = {}) => element(name, { title, section: 'rule', fields: { statement, strength }, parents, pubkey, concept: ruleZ, json });
  rule('ruleTa', 'Pubkey at runtime', 'Resolve each TA pubkey at runtime, and never hardcode it.');
  rule('ruleDog', 'Hound naming', 'Every dog carries a name.');
  rule('ruleKey', 'Keyword fields', 'The statement of a law is one sentence.', { strength: 'SHOULD' });
  rule('ruleRelay', 'Kept events', 'A relay keeps the events it is sent.');
  rule('ruleRelays', 'Filters answered', 'Relays answer filters.');
  rule('ruleDecided', 'Standing records', 'A decided record stays in force until a later one replaces it.');
  rule('ruleStill', 'Quiet hours', 'Still waters run deep.');
  rule('ruleAllThree', 'Settled matters', 'It is decided and still in force.');
  rule('tierBoth', 'Pair one', 'alphaword betaword.');
  rule('tierAlpha4', 'Pair two', 'alphaword alphaword alphaword alphaword.');
  rule('tierAlpha1', 'Pair three', 'alphaword.');
  rule('tieC', 'Twin', 'gammaword gammaword deltaword.');
  rule('tieA', 'Twin', 'gammaword deltaword.');
  rule('tieB', 'Twin', 'gammaword deltaword.');
  rule('ruleBind', 'Label keys', 'Keys tie a label to its node, and nothing else bind them.');
  rule('ruleMust', 'Bound duty', 'iotaword lambdaword.', { parents: [mustSet] });
  rule('ruleDoc', 'Shared item', 'iotaword.', { parents: [ruleSuperset, docSuperset] });

  // ── the point of view ──
  const pubkeys = { ta, owner, ...PEERS };
  person(owner, 1);
  person(PEERS.hi, 0.2);
  person(PEERS.lo, 0.01);
  person(PEERS.noscore);
  for (const [name, pubkey] of [['povTa', ta], ['povOwner', owner], ['povAnon', null], ['povHi', PEERS.hi], ['povLo', PEERS.lo], ['povNoScore', PEERS.noscore], ['povNoUser', PEERS.nouser]]) {
    rule(name, 'Viewpoint', 'epsilonword.', { pubkey });
  }

  // ── the rest ──
  const long = `${'A guide to the field, written plainly and at length so that its description runs well past the passage. '.repeat(2)}Here the kappaword stands in the middle of it. ${'After it the text goes on, and on, until the description is long. '.repeat(3)}`.trim();
  element('docLong', { title: 'Field guide', section: 'document', fields: { title: 'Field guide', description: long, headings: ['Overview', 'Map location hints', 'Kappaword list'] }, parents: [docSuperset], concept: `39998:${ta}:document` });
  const zeta = element('zetaNode', { title: 'Plain', section: 'rule', fields: { statement: 'Nothing to see.', strength: 'MAY' }, parents: [ruleSuperset], concept: ruleZ });
  tag(zeta, 'd', 'zetaword');
  const offKey = crypto.randomUUID();
  const off = add('offNode', ['NostrEvent', 'ListItem', 'TapestryNode'], { tapestryKey: offKey, kind: 39999, uuid: `39999:${ta}:offNode`, name: 'Thetaword offloaded', pubkey: ta });
  tag(off, 'json', `lmdb:${offKey}`);
  tag(off, 'name', 'Thetaword offloaded');
  link(ruleSuperset, 'HAS_ELEMENT', off);
  add('cardSet', ['Set', 'TapestryNode'], { name: 'every card', pubkey: ta });
  add('change', ['GraphChange', 'TapestryNode'], { name: 'epsilonword change', at: '2026-11-17T00:00:00.000Z', byRole: 'owner', byPubkey: owner, operation: 'graph search' });

  return finish(s, keys, uuids, eids, pubkeys);
}

function seedSearchBound({ n = 5001, ta = S.TA } = {}) {
  const { s, keys, uuids, eids, add, link } = builder(ta, 'online');
  const header = add('boundHeader', ['NostrEvent', 'ListHeader', 'ConceptHeader', 'TapestryNode'], { kind: 39998, uuid: `39998:${ta}:bound`, name: 'bound', pubkey: ta });
  const superset = add('boundSuperset', ['NostrEvent', 'ListItem', 'Superset', 'TapestryNode'], { kind: 39999, uuid: `39999:${ta}:bounds`, name: 'bounds', pubkey: ta });
  link(header, 'IS_THE_CONCEPT_FOR', superset);
  for (let i = 0; i < n; i++) {
    const node = add(null, ['NostrEvent', 'ListItem', 'TapestryNode'], { kind: 39999, uuid: `39999:${ta}:bound-${i}`, name: `omegaword ${i}`, pubkey: ta });
    link(superset, 'HAS_ELEMENT', node);
  }
  return finish(s, keys, uuids, eids, { ta });
}

module.exports = { seedSearch, seedSearchBound, PEERS, FIXED_KEYS, INDEX };
