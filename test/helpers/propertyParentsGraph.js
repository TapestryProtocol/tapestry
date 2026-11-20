'use strict';
/**
 * The graph story graph-operations-first-slice #45's suites seed for test/helpers/graphFake.js: the rule
 * property-has-one-parent, rules check and rules repair (ADR graph-operations-first-slice/0045).
 *
 * preparePropertyParents(label) starts from test/helpers/enumerationGraph.js's prepareEnumeration, which says what it
 * holds (the property operations' concepts, bot, project, person and grok bot with their fields from graph set-schema,
 * nostr relay (another author's), recipe (the owner's own key's), firmware word, hut, and the relationship concept).
 * Two of its properties already break the rule: grok bot's project, hung on its JSON schema node too, as today's
 * enumerate route left Grok Bots' (Grok Bots' shape, the live case), and hut's door, under its primary property and
 * under roof. Then it adds by hand, one case for each kind of finding (the keys are in `x`):
 *
 *   grokProject   grok bot's project: its primary property and its own concept's schema         fixable, own
 *   grokLetter    the relationship element today's enumerate route signs for that link (nodeFrom, nodeTo,
 *                 relationshipType IS_A_PROPERTY_OF), an element of the relationship concept's superset
 *   teamLead      bot's team.lead: under team (a property) and on bot's schema                   fixable, own, nested
 *   wordSpelling  firmware word's spelling: under word's primary property and on word's schema   fixable, firmware
 *   relayMotto    nostr relay's motto: its primary property and relay's schema                   another author's
 *   recipeDish    recipe's dish: its primary property and recipe's schema                         the owner's own key's
 *   hutDoor       hut's door: two properties of one tree (the seed's)                             a choice
 *   shared        one node under tea house's and gadget's primary properties (create-property's shared node)
 *   schemaOnly    a property whose only parent is lamp's JSON schema node (create-property's old top level)
 *   underElement  a property whose only parent is tea house's element lapsang
 *   otherSchema   person's mentor: under person's primary property and on bot's schema (another concept's)
 *   misplacedPP   bookshop's primary property: on its own schema and on kiosk's
 *   unhooked      a property under no parent, as generate-property-tree unhooks one: never judged (open question 3)
 *
 * Word, relay and recipe are each given a JSON schema node if they lack one, and word's primary property hangs on
 * word's, so a primary property is judged where it should be. Everything else in the seed hangs under one parent of
 * the right kind, which oddProperties(state), the rule restated in plain JavaScript over the state, confirms: the seed
 * throws unless the nodes it finds are exactly the eleven above with a finding (unhooked has none).
 *
 * → prepareEnumeration's { file, dir, k, made, c, sup, f, pp, schema, el, uuid } plus x (the keys above), xs (the
 * schema nodes of word, relay, recipe, lamp and kiosk, by id), FIXABLE (own: grokProject, teamLead), FIRMWARE
 * (wordSpelling), CHOICES (the rest with a finding) and FINDINGS (every key with a finding).
 */

const crypto = require('crypto');
const S = require('./graphOpsSuite');
const P = require('./propertyGraph');
const EG = require('./enumerationGraph');
const G = require('./graphFake');

const { TA, OWNER, OTHER } = EG;
const { assert, show } = S;

const MEMBER = 'IS_A_PROPERTY_OF';
const PRIMARY = 'IS_THE_PRIMARY_PROPERTY_FOR';
const SCHEMA = 'IS_THE_JSON_SCHEMA_FOR';

/** The rule, restated over a state: each Property with at least one parent that breaks it → [{ key, code }]. */
function oddProperties(s) {
  const byEid = new Map(s.nodes.map((n) => [n.eid, n]));
  const outOf = (n, type) => s.rels.filter((r) => r.from === n.eid && r.type === type).map((r) => byEid.get(r.to)).filter(Boolean);
  const out = [];
  for (const n of s.nodes) {
    if (!n.labels.includes('Property')) continue;
    const ups = outOf(n, MEMBER);
    if (!ups.length) continue;
    const headers = outOf(n, PRIMARY);
    let code = null;
    if (headers.length) {
      const ownSchemas = new Set(s.rels.filter((r) => r.type === SCHEMA && headers.some((h) => h.eid === r.to)).map((r) => r.from));
      if (ups.length !== 1 || !ownSchemas.has(ups[0].eid) || !ups[0].labels.includes('JSONSchema')) code = 'primary-property-misplaced';
    } else if (ups.length > 1) code = 'more-than-one-parent';
    else if (!ups[0].labels.includes('Property')) code = 'parent-not-a-property';
    if (code) out.push({ key: n.props.tapestryKey, code });
  }
  return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Properties with at least one parent: what a check of the whole graph judges (ADR 0045 Decision 2). */
function judgedProperties(s) {
  const eids = new Set(s.rels.filter((r) => r.type === MEMBER).map((r) => r.from));
  return s.nodes.filter((n) => n.labels.includes('Property') && eids.has(n.eid)).map((n) => n.props.tapestryKey).sort();
}

async function preparePropertyParents(label) {
  const ctx = await EG.prepareEnumeration(label);
  const { file, c, f, pp, schema, made } = ctx;
  const s = S.readState(file);
  const b = P.over(s);
  const node = (key) => { const n = b.byKey(key); assert(n, `the seed holds the node ${key}`); return n; };
  const coreOf = (headerKey, type) => b.coreOf(node(headerKey), type);
  const hex = (x) => crypto.createHash('sha256').update(String(x)).digest('hex');

  /** A header's JSON schema node: the one it has, or one made here, lettered by the header's author. */
  const schemaOf = (headerKey, slug, name) => {
    const had = coreOf(headerKey, SCHEMA);
    if (had) return had;
    const h = node(headerKey);
    const author = h.props.pubkey || TA;
    const d = `${slug}-schema`;
    const json = { word: { slug: `json-schema-for-the-concept-of-${slug}`, name: `JSON schema for the concept of ${name}`, wordTypes: ['word', 'jsonSchema'] }, jsonSchema: { type: 'object', properties: { [slug]: { type: 'object', properties: {} } } } };
    const n = b.lettered({ uuid: `39999:${author}:${d}`, labels: ['ListItem', 'JSONSchema'], name: `JSON schema for the concept of ${name}`, author, tags: [['d', d], ['name', `JSON schema for the concept of ${name}`], ['json', JSON.stringify(json)]] });
    b.link(n, SCHEMA, h);
    return n;
  };
  /** A property node in the old shape, by `author`, under each of `parents` (the first gives its address). */
  const property = (parents, name, author = TA) => {
    const d = P.childD(name, parents[0].props.uuid);
    const json = { word: { slug: P.slugOf(name), name, wordTypes: ['word', 'property'] }, property: { name, type: 'string', description: `The ${name}`, required: false } };
    const n = b.lettered({ uuid: `39999:${author}:${d}`, labels: ['ListItem', 'Property'], name, author, tags: [['d', d], ['name', name], ['description', `The ${name}`], ['type', 'string'], ['z', `39998:${TA}:property`], ['json', JSON.stringify(json)]] });
    for (const p of parents) b.link(n, MEMBER, p);
    return n;
  };

  // The schemas the cases need.
  const xs = {
    word: schemaOf(c.word, 'word', 'words'),
    relay: schemaOf(c.relay, 'nostr-relay', 'nostr relays'),
    recipe: schemaOf(c.recipe, 'recipe', 'recipes'),
    lamp: coreOf(made.lamp.conceptHeader, SCHEMA),
    kiosk: coreOf(made.kiosk.conceptHeader, SCHEMA),
  };
  for (const [id, n] of Object.entries(xs)) assert(n, `the seed has a JSON schema node for ${id}`);
  const wordPP = coreOf(c.word, PRIMARY);
  assert(wordPP, "the seed gives firmware word a primary property (enumerationGraph's firmwareProperty)");
  if (!s.rels.some((r) => r.type === MEMBER && r.from === wordPP.eid)) b.link(wordPP, MEMBER, xs.word);

  // Fixable: own concepts' properties hung on their own concept's schema too.
  const grokProject = node(f.grokBot.project);
  assert(s.rels.some((r) => r.type === MEMBER && r.from === grokProject.eid && r.to === node(schema.grokBot).eid), "the seed hangs grok bot's project on its JSON schema node (enumerationGraph's Grok Bots' shape)");
  const teamLead = node(f.bot['team.lead']);
  b.link(teamLead, MEMBER, node(schema.bot));
  // Firmware's: word's spelling on word's schema.
  const wordSpelling = node(f.wordSpelling);
  b.link(wordSpelling, MEMBER, xs.word);
  // Other authors' concepts.
  const relayMotto = node(f.relayMotto);
  b.link(relayMotto, MEMBER, xs.relay);
  const recipeDish = node(f.recipeDish);
  b.link(recipeDish, MEMBER, xs.recipe);
  // Choices.
  const hutDoor = node(f.hutDoor);
  const shared = property([node(made.teaHouse.nodes.primaryProperty), node(made.gadget.nodes.primaryProperty)], 'shared');
  const schemaOnly = property([xs.lamp], 'wattage');
  const underElement = property([node(ctx.el.lapsang)], 'steeping');
  const otherSchema = node(f.person.mentor);
  b.link(otherSchema, MEMBER, node(schema.bot));
  const misplacedPP = coreOf(made.bookshop.conceptHeader, PRIMARY);
  assert(misplacedPP && s.rels.some((r) => r.type === MEMBER && r.from === misplacedPP.eid), "bookshop's primary property hangs on its own schema, as create-concept wires it");
  b.link(misplacedPP, MEMBER, xs.kiosk);
  // Never judged.
  const unhookedNode = b.lettered({ uuid: `39999:${TA}:unhooked-${hex('unhooked').slice(0, 8)}`, labels: ['ListItem', 'Property'], name: 'unhooked', tags: [['d', `unhooked-${hex('unhooked').slice(0, 8)}`], ['name', 'unhooked'], ['z', `39998:${TA}:property`]] });

  // The letter today's enumerate route signs for grok bot's project's link to its schema.
  const relSup = node(ctx.sup.relationship);
  const from = grokProject.props.uuid;
  const to = node(schema.grokBot).props.uuid;
  const d = hex(`${from} ${MEMBER} ${to}`).slice(0, 32);
  const grokLetter = b.lettered({ uuid: `39999:${TA}:${d}`, labels: ['ListItem'], name: `project ${MEMBER} JSON schema for the concept of grok bots`, tags: [['d', d], ['name', `project ${MEMBER} JSON schema for the concept of grok bots`], ['z', `39998:${TA}:relationship`], ['nodeFrom', from], ['nodeTo', to], ['relationshipType', MEMBER]] });
  b.link(relSup, 'HAS_ELEMENT', grokLetter);

  G.writeState(file, s);

  const key = (n) => n.props.tapestryKey;
  const x = {
    grokProject: key(grokProject), grokLetter: key(grokLetter), teamLead: key(teamLead), wordSpelling: key(wordSpelling),
    relayMotto: key(relayMotto), recipeDish: key(recipeDish), hutDoor: key(hutDoor), shared: key(shared),
    schemaOnly: key(schemaOnly), underElement: key(underElement), otherSchema: key(otherSchema), misplacedPP: key(misplacedPP),
    unhooked: key(unhookedNode), wordPP: key(wordPP), team: f.bot.team,
  };
  const FIXABLE = [x.grokProject, x.teamLead];
  const FIRMWARE = [x.wordSpelling];
  const CHOICES = [x.relayMotto, x.recipeDish, x.hutDoor, x.shared, x.schemaOnly, x.underElement, x.otherSchema, x.misplacedPP];
  const FINDINGS = [...FIXABLE, ...FIRMWARE, ...CHOICES].sort();

  const found = oddProperties(S.readState(file)).map((o) => o.key);
  assert(show(found) === show(FINDINGS), `the seed's properties that break the rule are exactly its eleven cases; got ${show(found.map((k) => [k, (Object.entries(x).find(([, v]) => v === k) || ['(not a case)'])[0]]))}`);

  return { ...ctx, x, xs: Object.fromEntries(Object.entries(xs).map(([id, n]) => [id, key(n)])), FIXABLE, FIRMWARE, CHOICES, FINDINGS, OWNER, OTHER };
}

module.exports = { TA, OWNER, OTHER, MEMBER, PRIMARY, SCHEMA, oddProperties, judgedProperties, preparePropertyParents };
