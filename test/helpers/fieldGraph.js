'use strict';
/**
 * The graph the field-mapping suites seed for test/helpers/graphFake.js (story graph-operations-foundation #5, ADR
 * graph-operations-foundation/0005), shaped as today's routes make it (ADR Context 4, 6, 7 and 11):
 *
 *   - the concept of neo4j properties, as a firmware install makes it: its header 39998:<TA>:neo4j-property, its
 *     superset, and its two sets, 39999:<TA>:the-set-of-neo4j-properties-that-are-also-fields (the first, whose
 *     elements are the marks) and 39999:<TA>:the-set-of-neo4j-only-properties. noConcept leaves all of it out, and
 *     noFirstSet the first set;
 *   - the property concept's header and superset: every property node is an element of it (D9);
 *   - each concept with its header (json: conceptHeader.oKeys), superset, JSON Schema node (json: { word, jsonSchema }),
 *     primary property (`<slug>-primary-property`, named "primary property for the concept of <plural>"), and the
 *     property tree generate-property-tree makes: on a wrapped schema (one top-level key, the concept's key) the
 *     fields hang on the primary property; otherwise each top-level key gets a section node under it, and the fields
 *     hang under the section node named for the concept's key. A create-property node hangs off the schema node;
 *   - each element as the import makes it: labels NostrEvent, ListItem and TapestryNode, a uuid, a name, a created_at,
 *     and tags d, name and json, so a read must ask for the json tag by its type.
 *
 * The concepts, by the name the suites use (TA is test/helpers/graphOpsSuite.js's):
 *   dog       39998:<TA>:dog, key dog, unwrapped ({ word, dog }), with a set "walkers" under its superset. Its fields
 *             and what each holds are below (DOG_FIELDS). Its tree has a node for every field but collar, nickname and
 *             microchip; it also has `retired`, a field that has left the schema, and owner's child `name`. create-
 *             property made a `nickname` node and a second `breed` node off the schema node.
 *   widget    wrapped; color, size, shape.
 *   cat       wrapped, labelled ListHeader only, as one the nostr import brought in; color, size.
 *   pet       wrapped; name.
 *   rock      wrapped, with no primary property; its hardness node was made by create-property.
 *   weird     wrapped, its key `weird-thing` (not letters and digits); color, and shape, an object.
 *   otherWeird 39998:<OTHER>:weird-thing: another author's, the same key; color.
 *   otherDog  39998:<OTHER>:dog, another author's dog: the same key, dog, unwrapped; name, breed, color.
 *   big       wrapped (bigCount elements, only when bigCount is given); label.
 *
 * The elements (DOG_ELEMENTS says what each dog's JSON holds):
 *   dogs: rover (an element of the superset), spot (of the set walkers), bella (of both: two paths), fido, rex, flat
 *   (flat JSON, as the UI's write verbs save it), luna (json lmdb:<lunaKey>; the suite stores the entry, LUNA_JSON),
 *   ghost (json lmdb:<a key nothing stores>), max (a dog and a pet, both sections in its JSON), od1 (a dog of both
 *   dog concepts; its JSON has dog.color);
 *   stray, an implicit member: its z tag names the dog concept, but no HAS_ELEMENT reaches it;
 *   loner, a node of no concept that carries dog_breed;
 *   w1, w2 (widget), c1 (cat), p1 (pet), r1 (rock), wt1 (weird);
 *   mute, a dog with no json tag at all, only with jsonless (ADR 0005 Amendment 2.2: its JSON can't be read).
 *
 * Options: marks [[concept, field]] (made as the first set's HAS_ELEMENT to the field's tree node), markNodes
 * [<name>] (the same edge to a node by its name here, such as dogWordTypes, the word section's child), copies
 * { <element>: { <property>: value } }, json { <element>: <object> } (in place of its JSON), dogFields (dog's schema
 * fields, in place of DOG_FIELDS), unhook [[concept, field]] (the field's tree node loses its IS_A_PROPERTY_OF but
 * keeps its other edges, a mark among them: a mark whose property node has left the tree, which rules check must
 * report), bigCount, bigCopied (each big element already carries big_label, as a mark of label leaves it), jsonless
 * (adds mute), noConcept, noFirstSet, lunaKey (the key luna's json names; random otherwise).
 */

const crypto = require('crypto');
const path = require('path');
const { spawnSync } = require('child_process');
const { emptyState, writeState } = require('./graphFake');
const S = require('./graphOpsSuite');

const { TA, ROOT } = S;
const OTHER = 'ab'.repeat(32);
const SET1 = `39999:${TA}:the-set-of-neo4j-properties-that-are-also-fields`;
const SET2 = `39999:${TA}:the-set-of-neo4j-only-properties`;
const NEO4J_PROPERTY = `39998:${TA}:neo4j-property`;

const DOG_FIELDS = Object.freeze({
  slug: { type: 'string' },
  name: { type: 'string' },
  breed: { type: 'string', enum: ['goldenRetriever', 'irishSetter'] },
  age: { type: 'integer' },
  weight: { type: 'number' },
  vaccinated: { type: 'boolean' },
  nicknames: { type: 'array', items: { type: 'string' } },
  scores: { type: 'array', items: { type: 'integer' } },
  checks: { type: 'array', items: { type: 'boolean' } },
  color: { type: ['string', 'null'] },
  owner: { type: 'object', properties: { name: { type: 'string' } } },
  toys: { type: 'array', items: { type: 'object', properties: { kind: { type: 'string' } } } },
  grid: { type: 'array', items: { type: 'array', items: { type: 'integer' } } },
  collar: { type: 'object', properties: { size: { type: 'string' } } },
  nickname: { type: 'string' },
  microchip: { type: 'string' },
});
const DOG_TREE = ['slug', 'name', 'breed', 'age', 'weight', 'vaccinated', 'nicknames', 'scores', 'checks', 'color', 'owner', 'toys', 'grid', 'retired'];

/** What each dog's JSON holds under `dog` (flat's is flat; luna's is in the LMDB; ghost's entry is missing). */
const DOG_ELEMENTS = Object.freeze({
  rover: { slug: 'rover', name: 'Rover', breed: 'goldenRetriever', age: 3, weight: 30.5, vaccinated: true, nicknames: ['Ro', 'Rov'], scores: [1, 2, 3], checks: [true, false], color: 'brown', owner: { name: 'Al' }, toys: [{ kind: 'ball' }], grid: [[1, 2]] },
  spot: { slug: 'spot', name: 'Spot', breed: 'irishSetter', age: 5, weight: 30, vaccinated: false, scores: [], color: null },
  bella: { slug: 'bella', name: 'Bella', breed: 'goldenRetriever', age: 2.5, nicknames: ['Bee', 3], scores: [1.5, 2] },
  fido: { slug: 'fido', name: 'Fido', age: 9007199254740993, nicknames: ['Fi', null] },
  rex: { slug: 'rex', name: 'Rex', breed: { name: 'mutt' }, age: 'three', nicknames: [{ kind: 'pup' }] },
  max: { slug: 'max', name: 'Max', breed: 'irishSetter' },
  od1: { name: 'Odie', breed: 'irishSetter', color: 'grey' },
});
const LUNA_JSON = Object.freeze({ word: { slug: 'dog--luna', name: 'dog: Luna', wordTypes: ['word', 'dog'] }, dog: { slug: 'luna', name: 'Luna', breed: 'irishSetter', age: 4 } });

function seedFields(opts = {}) {
  const s = emptyState();
  const keys = {};
  const nodesByName = {};
  const add = (labels, props) => { const n = { eid: s.nextEid++, labels: [...labels], props: { ...props, tapestryKey: crypto.randomUUID() } }; s.nodes.push(n); return n; };
  const link = (a, type, b) => { s.rels.push({ eid: s.nextEid++, type, from: a.eid, to: b.eid, props: {} }); };
  const tag = (n, type, value) => { const t = add(['NostrEventTag', 'TapestryNode'], { type, value, uuid: `${n.eid}_${type}` }); link(n, 'HAS_TAG', t); return t; };
  const event = (labels, { uuid, name, author = TA, json, extraTags = [] }) => {
    // A created_at, as every import gives an event: a NostrEvent with none is a placeholder (ADR
    // graph-operations-first-slice/0026 Decision 4).
    const n = add(labels, { uuid, name, kind: Number(uuid.split(':')[0]), pubkey: author, aTag: uuid, created_at: 1763000000 });
    tag(n, 'd', uuid.split(':').slice(2).join(':'));
    if (name) tag(n, 'name', name);
    for (const [t, v] of extraTags) tag(n, t, v);
    if (json !== undefined) tag(n, 'json', typeof json === 'string' ? json : JSON.stringify(json));
    return n;
  };
  const named = (name, n) => { nodesByName[name] = n; keys[name] = n.props.tapestryKey; return n; };

  // ── the concept of neo4j properties ──
  let set1 = null;
  if (!opts.noConcept) {
    const h = named('neo4jProperty', event(['NostrEvent', 'ListHeader', 'ConceptHeader', 'TapestryNode'], { uuid: NEO4J_PROPERTY, name: 'neo4j property', json: { word: { slug: 'concept-header-for-the-concept-of-neo4j-properties', name: 'concept header for the concept of neo4j properties', wordTypes: ['word', 'conceptHeader'] }, conceptHeader: { oNames: { singular: 'neo4j property', plural: 'neo4j properties' }, oKeys: { singular: 'neo4jProperty', plural: 'neo4jProperties' } } } }));
    const sup = named('neo4jPropertySuperset', event(['NostrEvent', 'ListItem', 'Superset', 'TapestryNode'], { uuid: `39999:${TA}:neo4j-property-superset`, name: 'superset for the concept of neo4j properties' }));
    link(h, 'IS_THE_CONCEPT_FOR', sup);
    if (!opts.noFirstSet) {
      set1 = named('set1', event(['NostrEvent', 'ListItem', 'Set', 'TapestryNode'], { uuid: SET1, name: 'neo4j properties that are also fields', json: { word: { slug: 'the-set-of-neo4j-properties-that-are-also-fields' }, set: { slug: 'neo4j-properties-that-are-also-fields' } } }));
      link(sup, 'IS_A_SUPERSET_OF', set1);
    }
    const set2 = named('set2', event(['NostrEvent', 'ListItem', 'Set', 'TapestryNode'], { uuid: SET2, name: 'neo4j-only properties', json: { word: { slug: 'the-set-of-neo4j-only-properties' }, set: { slug: 'neo4j-only-properties' } } }));
    link(sup, 'IS_A_SUPERSET_OF', set2);
  }

  // ── the property concept ──
  const propHeader = named('property', event(['NostrEvent', 'ListHeader', 'ConceptHeader', 'TapestryNode'], { uuid: `39998:${TA}:property`, name: 'property', json: { conceptHeader: { oKeys: { singular: 'property', plural: 'properties' } } } }));
  const propSuperset = named('propertySuperset', event(['NostrEvent', 'ListItem', 'Superset', 'TapestryNode'], { uuid: `39999:${TA}:property-superset`, name: 'superset for the concept of properties' }));
  link(propHeader, 'IS_THE_CONCEPT_FOR', propSuperset);

  const short = (n) => crypto.createHash('sha256').update(n.props.uuid).digest('hex').slice(0, 8);
  const propNode = (field, parent, author, def = {}) => {
    const n = event(['NostrEvent', 'ListItem', 'Property', 'TapestryNode'], {
      uuid: `39999:${author}:${field.toLowerCase()}-${short(parent)}`, name: field, author,
      extraTags: [['type', String(def.type || 'string')]],
      json: { word: { slug: field.toLowerCase(), name: field, wordTypes: ['word', 'property'] }, property: { name: field, type: Array.isArray(def.type) ? def.type[0] : (def.type || 'string'), description: '', required: false } },
    });
    link(n, 'IS_A_PROPERTY_OF', parent);
    link(propSuperset, 'HAS_ELEMENT', n);
    return n;
  };

  // ── concepts ──
  const concepts = {};
  function concept(cname, { slug, plural, oKey, author = TA, wrapped, fields, tree = Object.keys(fields), createProperty = [], primaryProperty = true, headerLabels = ['NostrEvent', 'ListHeader', 'ConceptHeader', 'TapestryNode'] }) {
    const h = named(cname, event(headerLabels, {
      uuid: `39998:${author}:${slug}`, name: slug.replace(/-/g, ' '), author,
      json: { word: { slug: `concept-header-for-the-concept-of-${plural}`, wordTypes: ['word', 'conceptHeader'] }, conceptHeader: { description: '', oNames: { singular: slug.replace(/-/g, ' '), plural: plural.replace(/-/g, ' ') }, oSlugs: { singular: slug, plural }, oKeys: { singular: oKey, plural: `${oKey}s` } } },
    }));
    const sup = named(`${cname}Superset`, event(['NostrEvent', 'ListItem', 'Superset', 'TapestryNode'], { uuid: `39999:${author}:${slug}-superset`, name: `superset for the concept of ${plural}`, author }));
    link(h, 'IS_THE_CONCEPT_FOR', sup);
    const jsonSchema = wrapped
      ? { type: 'object', properties: { [oKey]: { type: 'object', properties: fields } } }
      : { type: 'object', required: ['word', oKey], properties: { word: { type: 'object', properties: { wordTypes: { type: 'array', items: { type: 'string' } } } }, [oKey]: { type: 'object', properties: fields } } };
    const schema = named(`${cname}Schema`, event(['NostrEvent', 'ListItem', 'JSONSchema', 'TapestryNode'], { uuid: `39999:${author}:${slug}-schema`, name: `JSON schema for the concept of ${plural}`, author, json: { word: { slug: `json-schema-for-the-concept-of-${plural}`, wordTypes: ['word', 'jsonSchema'] }, jsonSchema } }));
    link(schema, 'IS_THE_JSON_SCHEMA_FOR', h);
    const c = { h, sup, schema, oKey, author, prop: {}, cp: {}, sets: {} };
    keys[`${cname}Prop`] = {};
    keys[`${cname}Cp`] = {};
    if (primaryProperty) {
      const pp = named(`${cname}Pp`, event(['NostrEvent', 'Property', 'TapestryNode'], { uuid: `39999:${author}:${slug}-primary-property`, name: `primary property for the concept of ${plural}`, author, json: { word: { slug: `primary-property-for-the-concept-of-${plural}`, wordTypes: ['word', 'property', 'primaryProperty'] }, property: { key: oKey, type: 'object' } } }));
      link(pp, 'IS_THE_PRIMARY_PROPERTY_FOR', h);
      c.pp = pp;
      let section = pp;
      if (!wrapped) {
        const word = propNode('word', pp, author, { type: 'object' });
        const wordTypes = propNode('wordTypes', word, author, { type: 'array' });
        nodesByName[`${cname}WordTypes`] = wordTypes;
        keys[`${cname}WordTypes`] = wordTypes.props.tapestryKey;
        c.wordSection = word;
        keys[`${cname}WordSection`] = word.props.tapestryKey;
        section = propNode(oKey, pp, author, { type: 'object' });
        keys[`${cname}Section`] = section.props.tapestryKey;
      }
      c.section = section;
      for (const f of tree) {
        c.prop[f] = propNode(f, section, author, fields[f] || {});
        keys[`${cname}Prop`][f] = c.prop[f].props.tapestryKey;
      }
    }
    for (const f of createProperty) {
      c.cp[f] = propNode(f, schema, author, fields[f] || {});
      keys[`${cname}Cp`][f] = c.cp[f].props.tapestryKey;
    }
    concepts[cname] = c;
    return c;
  }
  const subset = (c, sname) => { const n = named(sname, event(['NostrEvent', 'ListItem', 'Set', 'TapestryNode'], { uuid: `39999:${c.author}:${sname}`, name: sname, author: c.author })); link(c.sup, 'IS_A_SUPERSET_OF', n); c.sets[sname] = n; return n; };
  const element = (ename, holders, json, extraTags = []) => {
    const author = holders[0] && holders[0].author ? holders[0].author : TA;
    const n = named(ename, event(['NostrEvent', 'ListItem', 'TapestryNode'], { uuid: `39999:${author}:${ename}`, name: ename, author, json: opts.json && opts.json[ename] !== undefined ? opts.json[ename] : json, extraTags }));
    for (const holder of holders) link(holder.node || holder, 'HAS_ELEMENT', n);
    return n;
  };
  const word = (slug) => ({ slug, name: slug, wordTypes: ['word'] });

  const dog = concept('dog', { slug: 'dog', plural: 'dogs', oKey: 'dog', wrapped: false, fields: opts.dogFields || DOG_FIELDS, tree: DOG_TREE, createProperty: ['nickname', 'breed'] });
  // owner's child, `name`: a property named like a field of dog, a level down.
  keys.dogOwnerName = propNode('name', dog.prop.owner, TA, { type: 'string' }).props.tapestryKey;
  const walkers = subset(dog, 'walkers');
  const D = (e) => ({ word: word(`dog--${e}`), dog: DOG_ELEMENTS[e] });
  element('rover', [dog.sup], D('rover'));
  element('spot', [walkers], D('spot'));
  element('bella', [dog.sup, walkers], D('bella'));
  element('fido', [dog.sup], D('fido'));
  element('rex', [dog.sup], D('rex'));
  element('flat', [dog.sup], { name: 'Flat', breed: 'goldenRetriever', age: 7 });
  const lunaKey = opts.lunaKey || crypto.randomUUID();
  element('luna', [dog.sup], `lmdb:${lunaKey}`);
  element('ghost', [dog.sup], `lmdb:${crypto.randomUUID()}`);
  if (opts.jsonless) element('mute', [dog.sup], undefined);

  const widget = concept('widget', { slug: 'widget', plural: 'widgets', oKey: 'widget', wrapped: true, fields: { color: { type: 'string' }, size: { type: 'integer' }, shape: { type: 'string' } } });
  element('w1', [widget.sup], { widget: { color: 'red', size: 2, shape: 'round' } });
  element('w2', [widget.sup], { widget: { color: 'blue' } });

  const cat = concept('cat', { slug: 'cat', plural: 'cats', oKey: 'cat', wrapped: true, fields: { color: { type: 'string' }, size: { type: 'integer' } }, headerLabels: ['NostrEvent', 'ListHeader', 'TapestryNode'] });
  element('c1', [cat.sup], { cat: { color: 'black', size: 4 } });

  const pet = concept('pet', { slug: 'pet', plural: 'pets', oKey: 'pet', wrapped: true, fields: { name: { type: 'string' } } });
  element('p1', [pet.sup], { pet: { name: 'Polly' } });
  element('max', [dog.sup, pet.sup], { word: word('max'), dog: DOG_ELEMENTS.max, pet: { name: 'Maxie' } });

  const rock = concept('rock', { slug: 'rock', plural: 'rocks', oKey: 'rock', wrapped: true, fields: { hardness: { type: 'number' } }, primaryProperty: false, createProperty: ['hardness'] });
  element('r1', [rock.sup], { rock: { hardness: 7 } });

  const weird = concept('weird', { slug: 'weird-thing', plural: 'weird-things', oKey: 'weird-thing', wrapped: true, fields: { color: { type: 'string' }, shape: { type: 'object', properties: { sides: { type: 'integer' } } } } });
  element('wt1', [weird.sup], { 'weird-thing': { color: 'teal', shape: { sides: 3 } } });
  concept('otherWeird', { slug: 'weird-thing', plural: 'weird-things', oKey: 'weird-thing', author: OTHER, wrapped: true, fields: { color: { type: 'string' } } });

  const otherDog = concept('otherDog', { slug: 'dog', plural: 'dogs', oKey: 'dog', author: OTHER, wrapped: false, fields: { name: { type: 'string' }, breed: { type: 'string' }, color: { type: 'string' } } });
  element('od1', [otherDog.sup, dog.sup], { word: word('odie'), dog: DOG_ELEMENTS.od1 });

  // An implicit member of dog, not wired: no HAS_ELEMENT reaches it (ADR Context 11).
  element('stray', [], { word: word('dog--stray'), dog: { name: 'Stray', breed: 'goldenRetriever' } }, [['z', `39998:${TA}:dog`]]);
  // A node of no concept that carries a property in dog's namespace.
  named('loner', add(['NostrEvent', 'TapestryNode'], { uuid: `39999:${TA}:loner`, name: 'loner', dog_breed: 'goldenRetriever' }));

  if (opts.bigCount) {
    const big = concept('big', { slug: 'big', plural: 'bigs', oKey: 'big', wrapped: true, fields: { label: { type: 'string' } } });
    keys.bigElements = [];
    for (let i = 0; i < opts.bigCount; i++) {
      const n = add(['NostrEvent', 'ListItem', 'TapestryNode'], { uuid: `39999:${TA}:big-${i}`, name: `big ${i}`, ...(opts.bigCopied ? { big_label: `b${i}` } : {}) });
      tag(n, 'json', JSON.stringify({ big: { label: `b${i}` } }));
      link(big.sup, 'HAS_ELEMENT', n);
      keys.bigElements.push(n.props.tapestryKey);
    }
  }

  // ── what the options add ──
  for (const [cname, field] of opts.marks || []) {
    const c = concepts[cname];
    if (!c || !c.prop[field]) throw new Error(`seedFields: ${cname} has no tree node for ${field} to mark`);
    if (!set1) throw new Error('seedFields: no first set to mark from');
    link(set1, 'HAS_ELEMENT', c.prop[field]);
  }
  for (const name of opts.markNodes || []) {
    if (!nodesByName[name] || !set1) throw new Error(`seedFields: can't mark ${name}`);
    link(set1, 'HAS_ELEMENT', nodesByName[name]);
  }
  for (const [cname, field] of opts.unhook || []) {
    const node = concepts[cname] && concepts[cname].prop[field];
    if (!node) throw new Error(`seedFields: ${cname} has no tree node for ${field} to unhook`);
    s.rels = s.rels.filter((r) => !(r.from === node.eid && r.type === 'IS_A_PROPERTY_OF'));
  }
  for (const [ename, props] of Object.entries(opts.copies || {})) {
    const n = nodesByName[ename];
    if (!n) throw new Error(`seedFields: no node ${ename} to put copies on`);
    Object.assign(n.props, props);
  }

  return {
    state: s,
    keys,
    lunaKey,
    concepts,
    /** Write the state to <dir>/graph.json and return its path. */
    file(dir) { const f = path.join(dir, 'graph.json'); writeState(f, s); return f; },
  };
}

// ── reading a state ──
const nodeOf = (s, key) => s.nodes.find((n) => n.props.tapestryKey === key) || null;
const keyOfEid = (s, eid) => { const n = s.nodes.find((x) => x.eid === eid); return n ? n.props.tapestryKey : null; };
/** A node's properties that start with prefix, as stored ({ $int } for an integer). */
function copiesOn(s, key, prefix) {
  const n = nodeOf(s, key);
  if (!n) throw new Error(`no node ${key} in the graph`);
  return Object.fromEntries(Object.entries(n.props).filter(([k]) => k.startsWith(prefix)));
}
const isInt = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && typeof v.$int === 'string';
/** The tapestryKeys the first set's HAS_ELEMENT edges reach: the marks. */
function marksIn(s) {
  const set1 = s.nodes.find((n) => n.props.uuid === SET1);
  if (!set1) return [];
  return s.rels.filter((r) => r.from === set1.eid && r.type === 'HAS_ELEMENT').map((r) => keyOfEid(s, r.to));
}
const edges = (s, fromKey, type, toKey) => s.rels.filter((r) => r.type === type && keyOfEid(s, r.from) === fromKey && keyOfEid(s, r.to) === toKey).length;

/** Store LMDB entries [[key, data]] under <dir>/lmdb, the store a harness run in <dir> reads (childEnv's path). */
function seedLmdb(dir, entries) {
  const script = `
    const store = require(${JSON.stringify(path.join(ROOT, 'src/lib/tapestry-store.js'))});
    (async () => { for (const [k, v] of ${JSON.stringify(entries)}) await store.put(k, v); store.close(); process.stdout.write('STORED'); })()
      .catch((e) => { process.stderr.write(String(e && e.stack || e)); process.exit(1); });`;
  const r = spawnSync(process.execPath, ['-e', script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 60000 });
  if (!String(r.stdout).includes('STORED')) throw new Error(`the LMDB entries weren't stored: ${(r.stderr || '').slice(-400)}`);
}

module.exports = {
  TA, OTHER, SET1, SET2, NEO4J_PROPERTY, DOG_FIELDS, DOG_ELEMENTS, LUNA_JSON,
  seedFields, nodeOf, copiesOn, isInt, marksIn, edges, seedLmdb,
};
