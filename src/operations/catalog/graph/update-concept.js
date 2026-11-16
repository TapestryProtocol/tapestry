'use strict';
/**
 * graph update-concept — change a concept's names, slug or description (catalog §2; story graph-operations-first-slice
 * #16, AC5–AC8; ADR graph-operations-first-slice/0016 Decisions 2, 4–6, 9–11).
 *
 * A write through the write path: its guard is concept-slug-unique (for a slug), it is safe to repeat by the concept
 * and its fields, it records a change entry for each field it changes, and it signs nothing. A rename follows the
 * Dictionary's rule (src/lib/conceptHeaderEdit.js): the names, and the titles and core-node names made from them, change;
 * the concept's slugs, key, labels, address and tapestryKeys don't, so its elements, schema and field marks go on
 * working. Only this instance's own concepts change: not firmware's, and not another author's.
 */

const { CHANGE_ENTRY } = require('../../changes');
const { refusal } = require('../../refusal');
const N = require('./_nodes');
const K = require('./_concepts');
const E = require('./_eventless');

const SLUG_PATTERN = '^[a-z0-9]+(-[a-z0-9]+)*$';
const FIELDS = Object.freeze(['name', 'plural', 'slug', 'description']);

module.exports = {
  group: 'graph',
  name: 'update-concept',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Change a concept's names, slug or description",
  description: [
    "Changes the concept whose header's tapestryKey is `concept`: its `name` and `plural` (trimmed, each run of white space one space), its `slug` (kebab-case), and its `description` (an empty one removes it). Give any of them; one already held changes nothing.",
    "A rename changes the names, and the titles and core-node names made from them, wherever each still holds the value the old names made: one edited by hand stays. The concept's slugs, key, labels, address and tapestryKeys never change, so its elements, its schema and its field marks go on working. A slug changes what create-concept finds the concept by; another of this instance's concepts can't have it (`slug-in-use`).",
    "Only this instance's own concepts change: its header's author is the instance's assistant, with or without a letter. A firmware concept, another author's, and a new singular name for a concept the server finds by its name are refused. For a concept with a letter, the graph then differs from it: `letterOutOfDate` says so, and export nostr is what sends a new one. Nothing is signed.",
  ].join('\n\n'),
  inputs: {
    concept: N.keyInput("The tapestryKey of the concept's header"),
    name: { schema: { type: 'string', maxLength: 1000 }, description: 'Its new singular name (up to 200 characters once trimmed)' },
    plural: { schema: { type: 'string', maxLength: 1000 }, description: 'Its new plural name' },
    slug: { schema: { type: 'string', pattern: SLUG_PATTERN, maxLength: 200 }, description: 'Its new slug: lowercase letters and digits, joined by hyphens, such as coffee-house' },
    description: { schema: { type: 'string', maxLength: 10000 }, description: 'Its new description; an empty one removes it' },
  },
  result: {
    description: 'The concept as it now is, the fields this call changed, whether its letter no longer matches it, and the change entry this call recorded (null when it changed nothing)',
    schema: {
      type: 'object',
      required: ['outcome', 'concept', 'changed', 'letterOutOfDate', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['updated', 'unchanged'], description: 'updated, or unchanged when it held every value given' },
        concept: K.CONCEPT,
        changed: { type: 'array', items: { type: 'string', enum: FIELDS }, description: 'The fields this call changed' },
        letterOutOfDate: { type: 'boolean', description: 'Whether this call changed a node that has a letter, which now differs from it until export nostr sends a new one' },
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [K.NOTHING_TO_CHANGE, K.BAD_NAME, K.BAD_DESCRIPTION, K.UNKNOWN_CONCEPT, K.NOT_OWN_CONCEPT, K.FIRMWARE_CONCEPT, K.NAME_KEYED, K.NOT_INSTALLED],
  // No item when an input has a problem: its own refusal comes first (Decision 2).
  guards: [{ rule: 'concept-slug-unique', items: (inputs) => (typeof inputs.slug === 'string' && !K.anyBadInput(inputs) ? [{ concept: inputs.concept, slug: inputs.slug }] : []) }],
  repeatKey: ['concept', 'name', 'plural', 'slug', 'description'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    if (!FIELDS.some((f) => typeof inputs[f] === 'string')) {
      throw refusal(K.NOTHING_TO_CHANGE.code, `Name a field to change: ${FIELDS.join(', ')}. Nothing changed.`);
    }
    const given = K.cleanInputs(inputs);
    await K.lock(tx);
    if (typeof inputs.slug === 'string') await K.recheck(read, [{ concept: inputs.concept, slug: inputs.slug }]);

    const facts = await K.conceptFacts(read, inputs.concept);
    if (!facts) throw refusal(K.UNKNOWN_CONCEPT.code, `No concept header has the tapestryKey ${inputs.concept}. Name a concept by its header's tapestryKey.`, { input: 'concept' });
    const h = facts.header;
    const ta = K.assistant();
    if (!ta || h.author !== ta) throw refusal(K.NOT_OWN_CONCEPT.code, `${h.names.singular || 'That concept'} (${h.uuid}) isn't this instance's own: its author is ${h.author || 'unknown'}, not the instance's assistant, so this write can't sign a new version of it. Nothing changed.`, { input: 'concept' });
    if (K.isFirmware(h.uuid)) throw refusal(K.FIRMWARE_CONCEPT.code, `${h.names.singular} (${h.uuid}) is a firmware concept, which a firmware reinstall rebuilds from its definition. Nothing changed.`, { input: 'concept' });

    const { deriveAllNames, toTitleName } = require('../../../lib/conceptNames');
    const oldNames = { singular: String(h.names.singular || ''), plural: String(h.names.plural || `${h.names.singular}s`) };
    const newNames = { ...oldNames };
    if (given.name) newNames.singular = deriveAllNames(given.name, given.name).oNames.singular;
    if (given.plural) newNames.plural = deriveAllNames(given.plural, given.plural).oNames.singular;
    const { nameKeyed } = require('../../../lib/conceptHeaderEdit');
    if (newNames.singular !== oldNames.singular && nameKeyed(oldNames.singular)) {
      throw refusal(K.NAME_KEYED.code, `The server finds ${oldNames.singular} (${h.uuid}) by its singular name, so a rename would break what looks it up; its plural may change. Nothing changed.`, { input: 'name' });
    }
    const newSlug = typeof inputs.slug === 'string' ? inputs.slug : h.slug;
    const descTag = facts.nodes.conceptHeader.tags.find((t) => t.type === 'description');
    const oldDescription = descTag ? descTag.value : null;
    const newDescription = typeof inputs.description === 'string' ? (given.description || null) : oldDescription;

    const changed = [];
    if (newNames.singular !== oldNames.singular) changed.push('name');
    if (newNames.plural !== oldNames.plural) changed.push('plural');
    if (newSlug !== h.slug) changed.push('slug');
    if (newDescription !== oldDescription) changed.push('description');
    if (!changed.length) {
      return { data: { outcome: 'unchanged', concept: K.answerOf(h, facts.roles), changed: [], letterOutOfDate: false }, changes: [] };
    }
    let json = facts.nodes.conceptHeader.json || {};

    const d = String(h.uuid).split(':').slice(2).join(':');
    const props = [];
    const tagProps = [];
    const jsonByRole = {};
    let renamed = [];
    if (changed.includes('name') || changed.includes('plural')) {
      const r = K.renameRows(facts, d, ta, oldNames, newNames);
      props.push(...r.props);
      tagProps.push(...r.tags);
      Object.assign(jsonByRole, r.json);
      renamed = r.renamed;
    }
    json = jsonByRole.conceptHeader || json;
    const headerTags = facts.nodes.conceptHeader.tags;
    const added = [];
    const removed = [];
    if (changed.includes('slug')) {
      const t = headerTags.find((x) => x.type === 'slug');
      if (t) tagProps.push({ key: t.key, props: { value: newSlug } });
      else added.push(['slug', newSlug]);
    }
    if (changed.includes('description')) {
      if (newDescription && descTag) tagProps.push({ key: descTag.key, props: { value: newDescription } });
      else if (newDescription) added.push(['description', newDescription]);
      else removed.push(descTag.key);
      if (json && json.conceptHeader && typeof json.conceptHeader === 'object') {
        json = JSON.parse(JSON.stringify(json));
        json.conceptHeader.description = newDescription || `${toTitleName(newNames.singular)} is a concept.`;
        jsonByRole.conceptHeader = json;
      }
    }
    for (const [role, j] of Object.entries(jsonByRole)) {
      const t = facts.nodes[role].tags.find((x) => x.type === 'json');
      if (t) tagProps.push({ key: t.key, props: { value: JSON.stringify(j) } });
    }
    const missing = [...props, ...tagProps].find((r) => typeof r.key !== 'string');
    if (missing) throw new Error('a node or tag this update writes has no tapestryKey, so it can\'t be changed; run lifecycle migrate first');
    const F = require('./_fields');
    const rows = [...props, ...tagProps];
    const written = await F.writeCopies(tx, rows);
    if (written !== rows.length) throw new Error(`the update wrote ${written} of its ${rows.length} nodes and tags: one went missing while it was written`);
    if (added.length) await E.addTags(tx, h.key, E.tagRows(h.uuid, added, headerTags.length));
    for (const key of removed) await tx.run('MATCH (t:NostrEventTag:TapestryNode {tapestryKey: $key}) DETACH DELETE t', { key });

    const touched = new Set([...renamed, ...(changed.some((f) => f === 'slug' || f === 'description') ? ['conceptHeader'] : [])]);
    const letterOutOfDate = [...touched].some((role) => facts.nodes[role] && facts.nodes[role].hasLetter);
    const changes = [];
    const was = { name: oldNames.singular, plural: oldNames.plural, slug: h.slug, description: oldDescription };
    const now = { name: newNames.singular, plural: newNames.plural, slug: newSlug, description: newDescription };
    for (const f of changed) changes.push({ change: 'concept-updated', concept: h.key, field: f, was: was[f] === undefined ? null : was[f], now: now[f] === undefined ? null : now[f] });
    const cores = renamed.filter((r) => r !== 'conceptHeader').map((r) => facts.nodes[r].key);
    if (cores.length) changes.push({ change: 'core-nodes-renamed', concept: h.key, nodes: cores, count: cores.length });
    const description = newDescription || (json && json.conceptHeader && typeof json.conceptHeader.description === 'string' ? json.conceptHeader.description : null);
    const concept = K.answerOf({ ...h, names: { ...newNames }, slug: newSlug, description }, facts.roles);
    return { data: { outcome: 'updated', concept, changed, letterOutOfDate }, changes };
  },
};
