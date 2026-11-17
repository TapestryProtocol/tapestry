'use strict';
/**
 * The graph the delete-node suites seed for test/helpers/graphFake.js (story graph-operations-first-slice #26, ADR
 * graph-operations-first-slice/0026). It starts from update-node's seed, test/helpers/updateNodeGraph.js, which says
 * what that graph holds (beagle with rover, lucky, snowy and the rest; patch, ace, drifter and ghosty; firmware's rover,
 * the loose property, the graph rule, walkers, the shared set and wordOnly; walkerMax, gizmo, stamped and phantom;
 * loner and G), and adds, by the name the suites use. "Made here" is a node with no letter, as create-element makes
 * one; "lettered", one the import made of an event, with its id and its created_at.
 *
 *   person nodes (Decision 4)
 *     taUser, ownerUser, otherUser  the NostrUser nodes of the assistant (AUTHORS rover and rich), the owner (AUTHORS
 *                     patch) and OTHER (AUTHORS snowy)
 *     personElement   a NostrUser node under beagle's superset by HAS_ELEMENT: an element, and still a person node
 *   placeholders (Decision 4): NostrEvent nodes with no created_at, as the import makes them
 *     ePlaceholder    for an e tag naming an event the graph doesn't hold: { id, uuid: the id }
 *     aPlaceholder    for an a tag: { uuid: 39999:<OTHER>:far-away, kind, pubkey: OTHER }
 *     aOwnPlaceholder the same at one of the assistant's addresses, so its key is one of the instance's own
 *     bPlaceholder    for a b tag: { uuid } alone
 *     elementPlaceholder  one at an assistant's address under beagle's superset: an element, and still a placeholder
 *   what a delete takes (Decisions 9–12)
 *     rich            the assistant's lettered element of beagle, Rich: AUTHORS from taUser; tags d, name, z, json, an a
 *                     tag (REFERENCES aPlaceholder) and an e tag (REFERENCES ePlaceholder); CITES { note, weight } to
 *                     lucky; DEPENDS_ON from gizmo; RELATED_TO to itself; REFERENCES from citer's e tag; a marked
 *                     field's copy, beagle_color; and the derive step's stamp. keys.richTags names its tags by type
 *     citer           made here, an element of beagle, whose e tag (keys.citerETag) REFERENCES rich
 *     stored          made here, an element of beagle, stamped, its json tag lmdb:<its tapestryKey>: a suite stores
 *                     STORED_JSON under that key (storeEntries)
 *     shareTag        made here, an element of beagle, with a note tag (keys.sharedTag) that sharer has too
 *     sharer          made here, an element of beagle
 *   what else a delete refuses (Decision 5)
 *     holder          made here, an element of beagle, with HAS_ELEMENT to heldBelow (made here, beagle)
 *     holder7         made here, an element of beagle, with HAS_ELEMENT to below0 … below6 (keys.below)
 *     selfHeld        made here, an element of beagle, with HAS_ELEMENT to itself: a link to itself is no node below it
 *   repeats (Decision 3)
 *     goneKey         no node: a node-deleted change, recorded by graph merge-nodes as ADMIN at GONE_AT, records its
 *                     deletion (keys.goneEntry is that entry)
 *     neighborKey     no node: that entry names it only among the nodes at the other end
 *
 * seedCrowded() makes the same base and adds the cap's nodes instead (Decision 8), each made here under beagle's
 * superset with no tags of its own unless said, and crowdSource at the other end of their RELATED_TO links:
 *     crowded         10,001 relationships: HAS_ELEMENT and 10,000 RELATED_TO in
 *     crowdedByTags   9,999 of its own (HAS_ELEMENT, 9,997 RELATED_TO in, and HAS_TAG to its one tag), and two more
 *                     through that tag, which REFERENCES capTarget1 and capTarget2: 10,001 in all
 *     full            10,000: HAS_ELEMENT and 9,999 RELATED_TO in
 */

const crypto = require('crypto');
const path = require('path');
const { spawnSync } = require('child_process');
const U = require('./updateNodeGraph');
const C = require('./conceptGraph');
const S = require('./graphOpsSuite');
const { names } = require('./todaysCreateConcept');

const { TA, OTHER, OWNER, ADMIN } = U;
const ROOT = path.resolve(__dirname, '..', '..');
const dtag = require(path.join(ROOT, 'src/lib/dtag.js'));

const hex = (x) => crypto.createHash('sha256').update(String(x)).digest('hex');
const GONE_AT = '2026-11-10T09:00:00.000Z';
const PERSON = '9a'.repeat(32);
const E_ID = hex('an event the graph does not hold');
const STORED_JSON = Object.freeze({
  word: { slug: 'beagle--stored', name: 'beagle: Stored', title: 'Beagle: Stored', wordTypes: ['word', 'beagle'] },
  beagle: { name: 'Stored', slug: 'stored', description: 'its JSON is in the store' },
});

/** The builders over a seed's state: add, link, tag and a made-here or lettered element of beagle. */
function buildersOver(seed) {
  const s = seed.state;
  const keys = seed.keys;
  const uuids = seed.uuids;
  const add = (labels, props) => { const n = { eid: s.nextEid++, labels: [...new Set(labels)], props: { ...props } }; if (!n.props.tapestryKey) n.props.tapestryKey = crypto.randomUUID(); s.nodes.push(n); return n; };
  const link = (a, type, b, props = {}) => { s.rels.push({ eid: s.nextEid++, type, from: a.eid, to: b.eid, props: { ...props } }); };
  const nodeOf = (key) => s.nodes.find((n) => n.props.tapestryKey === key) || null;
  const named = (name, n) => { keys[name] = n.props.tapestryKey; if (n.props.uuid) uuids[name] = n.props.uuid; return n; };
  const tag = (node, t, i) => {
    const props = { uuid: C.tagUuid(node.props.uuid, t, i), type: t[0], value: t[1] === undefined ? '' : t[1], tapestryKey: crypto.randomUUID() };
    const tn = add(['NostrEventTag', 'TapestryNode'], props);
    link(node, 'HAS_TAG', tn);
    return tn;
  };
  const header = nodeOf(keys.beagle);
  const BEAGLE = { slug: 'beagle', singular: 'beagle', title: names('beagle', 'beagles').oTitles.singular, uuid: header.props.uuid };
  const beagleSup = nodeOf(keys.beagleSuperset);
  const wordOf = (name) => ({ slug: `beagle--${dtag.slug(name)}`, name: `beagle: ${name}`, title: `${BEAGLE.title}: ${name}`, wordTypes: ['word', 'beagle'] });
  const jsonOf = (name) => JSON.stringify({ word: wordOf(name), beagle: { name, slug: dtag.slug(name), description: `${name}, a beagle` } });
  /**
   * An element of beagle under `holder` (its superset by default). Lettered (NostrEvent, an id, a created_at) when
   * `lettered`, else made here. Its tags are d, name, z and json unless `tags` gives them; `[]` gives it none.
   * → { node, tags: { <type>: tag node } }
   */
  function element(name, { holder = beagleSup, lettered = false, author = TA, tags = null, extraProps = {}, key = null } = {}) {
    const d = dtag.childDTag(name, BEAGLE.uuid);
    const uuid = `39999:${author}:${d}`;
    const props = lettered
      ? { uuid, kind: 39999, pubkey: author, name, created_at: 1763000000, id: hex(`event ${uuid}`), ...extraProps }
      : { uuid, kind: 39999, pubkey: author, name, tapestryValue: name, created_at: 1763000000, ...extraProps };
    if (key) props.tapestryKey = key;
    const node = add([...(lettered ? ['NostrEvent'] : []), 'ListItem', 'TapestryNode'], props);
    const list = tags || [['d', d], ['name', name], ['z', BEAGLE.uuid], ['json', jsonOf(name)]];
    const byType = {};
    list.forEach((t, i) => { byType[t[0]] = tag(node, t, i); });
    if (holder) link(holder, 'HAS_ELEMENT', node);
    return { node, tags: byType };
  }
  return { s, keys, uuids, add, link, nodeOf, named, tag, element, BEAGLE, beagleSup, jsonOf, header };
}

async function seedDeleteNode() {
  const seed = await U.seedUpdateNode();
  const { keys, add, link, nodeOf, named, element, BEAGLE, beagleSup, jsonOf, header } = buildersOver(seed);

  // ── person nodes ──
  const taUser = named('taUser', add(['NostrUser', 'TapestryNode'], { pubkey: TA }));
  const ownerUser = named('ownerUser', add(['NostrUser', 'TapestryNode'], { pubkey: OWNER }));
  const otherUser = named('otherUser', add(['NostrUser', 'TapestryNode'], { pubkey: OTHER }));
  link(taUser, 'AUTHORS', nodeOf(keys.rover));
  link(ownerUser, 'AUTHORS', nodeOf(keys.patch));
  link(otherUser, 'AUTHORS', nodeOf(keys.snowy));
  link(beagleSup, 'HAS_ELEMENT', named('personElement', add(['NostrUser', 'TapestryNode'], { pubkey: PERSON })));

  // ── placeholders ──
  const ePlaceholder = named('ePlaceholder', add(['NostrEvent', 'TapestryNode'], { id: E_ID, uuid: E_ID }));
  const aPlaceholder = named('aPlaceholder', add(['NostrEvent', 'TapestryNode'], { uuid: `39999:${OTHER}:far-away`, kind: 39999, pubkey: OTHER }));
  named('aOwnPlaceholder', add(['NostrEvent', 'TapestryNode'], { uuid: `39999:${TA}:not-yet-here`, kind: 39999, pubkey: TA }));
  named('bPlaceholder', add(['NostrEvent', 'TapestryNode'], { uuid: `39998:${OTHER}:pointed-at` }));
  link(beagleSup, 'HAS_ELEMENT', named('elementPlaceholder', add(['NostrEvent', 'TapestryNode'], { uuid: `39999:${TA}:hollow`, kind: 39999, pubkey: TA })));

  // ── rich, and what points at it ──
  const richD = dtag.childDTag('Rich', BEAGLE.uuid);
  const rich = element('Rich', {
    lettered: true,
    tags: [['d', richD], ['name', 'Rich'], ['z', BEAGLE.uuid], ['json', jsonOf('Rich')], ['a', aPlaceholder.props.uuid], ['e', E_ID]],
    extraProps: { beagle_color: 'brown', tapestryJsonUpdatedAt: 1763000002 },
  });
  named('rich', rich.node);
  keys.richTags = Object.fromEntries(Object.entries(rich.tags).map(([t, n]) => [t, n.props.tapestryKey]));
  link(taUser, 'AUTHORS', rich.node);
  link(rich.tags.a, 'REFERENCES', aPlaceholder);
  link(rich.tags.e, 'REFERENCES', ePlaceholder);
  link(rich.node, 'CITES', nodeOf(keys.lucky), { note: 'see also', weight: 2 });
  link(nodeOf(keys.gizmo), 'DEPENDS_ON', rich.node);
  link(rich.node, 'RELATED_TO', rich.node);
  const citer = element('Citer', { tags: [['d', dtag.childDTag('Citer', BEAGLE.uuid)], ['name', 'Citer'], ['z', BEAGLE.uuid], ['json', jsonOf('Citer')], ['e', rich.node.props.id]] });
  named('citer', citer.node);
  keys.citerETag = citer.tags.e.props.tapestryKey;
  link(citer.tags.e, 'REFERENCES', rich.node);

  // ── stored: its JSON in the store ──
  const storedKey = crypto.randomUUID();
  named('stored', element('Stored', {
    key: storedKey,
    tags: [['d', dtag.childDTag('Stored', BEAGLE.uuid)], ['name', 'Stored'], ['z', BEAGLE.uuid], ['json', `lmdb:${storedKey}`]],
    extraProps: { tapestryJsonUpdatedAt: 1763000003 },
  }).node);

  // ── a tag two nodes have ──
  const shareTag = element('Share Tag', { tags: [['d', dtag.childDTag('Share Tag', BEAGLE.uuid)], ['name', 'Share Tag'], ['z', BEAGLE.uuid], ['json', jsonOf('Share Tag')], ['note', 'shared']] });
  named('shareTag', shareTag.node);
  keys.sharedTag = shareTag.tags.note.props.tapestryKey;
  const sharer = element('Sharer');
  named('sharer', sharer.node);
  link(sharer.node, 'HAS_TAG', shareTag.tags.note);

  // ── nodes other nodes are elements through ──
  const holder = named('holder', element('Holder').node);
  link(holder, 'HAS_ELEMENT', named('heldBelow', element('Held Below').node));
  const holder7 = named('holder7', element('Holder Seven').node);
  keys.below = [];
  for (let i = 0; i < 7; i++) {
    const b = element(`Below ${i}`).node;
    keys.below.push(b.props.tapestryKey);
    link(holder7, 'HAS_ELEMENT', b);
  }
  const selfHeld = named('selfHeld', element('Self Held').node);
  link(selfHeld, 'HAS_ELEMENT', selfHeld);

  // ── a deletion another operation recorded ──
  keys.goneKey = crypto.randomUUID();
  keys.neighborKey = crypto.randomUUID();
  const goneUuid = `39999:${TA}:${dtag.childDTag('Gone', BEAGLE.uuid)}`;
  const goneChange = {
    change: 'node-deleted',
    node: keys.goneKey,
    nodes: [keys.neighborKey],
    was: {
      labels: ['ListItem', 'TapestryNode'],
      properties: { created_at: 1763000000, kind: 39999, name: 'Gone', pubkey: TA, tapestryKey: keys.goneKey, tapestryValue: 'Gone', uuid: goneUuid },
      concepts: [{ concept: keys.beagle, name: header.props.name, address: BEAGLE.uuid }],
      relationships: [{ type: 'HAS_ELEMENT', direction: 'in', other: keys.neighborKey, properties: {} }],
      tags: [],
    },
  };
  named('goneEntry', add(['GraphChange', 'TapestryNode'], {
    at: GONE_AT, byRole: 'admin', byPubkey: ADMIN, operation: 'graph merge-nodes',
    keys: [keys.goneKey, keys.neighborKey], changes: JSON.stringify([goneChange]),
  }));
  keys.goneUuid = goneUuid;

  return { ...seed, keys };
}

async function seedCrowded() {
  const seed = await U.seedUpdateNode();
  const { link, named, element, add } = buildersOver(seed);
  const source = named('crowdSource', element('Crowd Source').node);
  const many = (target, n) => { for (let i = 0; i < n; i++) link(source, 'RELATED_TO', target); };
  many(named('crowded', element('Crowded', { tags: [] }).node), 10000);
  const byTags = element('Crowded By Tags', { tags: [['note', 'crowded']] });
  named('crowdedByTags', byTags.node);
  many(byTags.node, 9997);
  link(byTags.tags.note, 'REFERENCES', named('capTarget1', add(['NostrEvent', 'TapestryNode'], { uuid: `39999:${OTHER}:cap-one`, kind: 39999, pubkey: OTHER })));
  link(byTags.tags.note, 'REFERENCES', named('capTarget2', add(['NostrEvent', 'TapestryNode'], { uuid: `39999:${OTHER}:cap-two`, kind: 39999, pubkey: OTHER })));
  many(named('full', element('Full', { tags: [] }).node), 9999);
  return seed;
}

/** Store entries [[key, data]] under <dir>/lmdb, the store a harness run in <dir> reads (childEnv's path). */
function storeEntries(dir, entries) {
  const script = `
    const store = require(${JSON.stringify(path.join(ROOT, 'src/lib/tapestry-store.js'))});
    (async () => { for (const [k, v] of ${JSON.stringify(entries)}) await store.put(k, v); store.close(); process.stdout.write('STORED'); })()
      .catch((e) => { process.stderr.write(String(e && e.stack || e)); process.exit(1); });`;
  const r = spawnSync(process.execPath, ['-e', script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 60000 });
  if (!String(r.stdout).includes('STORED')) throw new Error(`the LMDB entries weren't stored: ${(r.stderr || '').slice(-400)}`);
}

/** The data the store under <dir>/lmdb holds for `key`, or null. */
function storedData(dir, key) {
  const script = `
    const store = require(${JSON.stringify(path.join(ROOT, 'src/lib/tapestry-store.js'))});
    const e = store.get(${JSON.stringify(key)});
    store.close();
    process.stdout.write('RESULT:' + JSON.stringify(e ? e.data : null));`;
  const r = spawnSync(process.execPath, ['-e', script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 60000 });
  const line = String(r.stdout).split('RESULT:')[1];
  if (line === undefined) throw new Error(`the store couldn't be read: ${(r.stderr || '').slice(-400)}`);
  return JSON.parse(line);
}

module.exports = { TA, OTHER, OWNER, ADMIN, PERSON, E_ID, GONE_AT, STORED_JSON, seedDeleteNode, seedCrowded, storeEntries, storedData };
