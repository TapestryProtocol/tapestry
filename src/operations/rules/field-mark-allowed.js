'use strict';
/**
 * field-mark-allowed: a field marked to be carried on its elements' Neo4j nodes is a plain top-level field of a
 * concept, with a property node in the concept's property tree, and a property name no other mark yields and nothing
 * else wrote (story graph-operations-foundation #5, AC3; ADR graph-operations-foundation/0005 Decision 5). Its entry in
 * the rules document is docs/GRAPH_RULES.md.
 *
 * Its items are { concept, field }, the concept named by its header's tapestryKey. For each, in this order, the first
 * check it fails is its violation:
 *   not-installed     the graph has no set of neo4j properties that are also fields, the firmware's
 *   unknown-concept   no concept header has the key (ConceptHeader, or ListHeader for one the nostr import brought in)
 *   unknown-field     the field isn't one of its top-level fields, jsonSchema.properties[<key>].properties
 *   no-property-node  the field has no node under the concept's section node in its property tree, or the concept
 *                     has no primary property (create-property's node off the schema node doesn't count)
 *   not-plain         the field's schema type isn't string, number, integer or boolean, or a list of one of them (a
 *                     type list may add null)
 *   unusable-name     the concept's key isn't letters and digits, so <key>_<field> can't be written unquoted in Cypher
 *   property-taken    another mark yields the same <key>_<field>: another concept with the same key marked a field of
 *                     the same name
 *   property-in-use   a current element of the concept carries <key>_<field>, though the field isn't marked
 * The last two skip the field's own mark, so a repeat on a marked field passes. As a guard it runs before
 * graph mark-field writes; as a check (rules check, A10.31) it runs over every current mark, and reports one whose
 * field has changed type, lost its property node, or now collides.
 */

const F = require('../catalog/graph/_fields');

const NAME = 'field-mark-allowed';
const KEY = /^[A-Za-z][A-Za-z0-9]*$/;
const FIELD = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const PLAIN = new Set(['string', 'number', 'integer', 'boolean']);

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const typesOf = (t) => (Array.isArray(t) ? t.filter((x) => typeof x === 'string') : typeof t === 'string' ? [t] : []);

/** What a field's schema says it holds, when that isn't a plain value or a list of one plain type; null when it is. */
function notPlain(def) {
  const d = isObject(def) ? def : {};
  const named = typesOf(d.type).filter((t) => t !== 'null');
  if (!named.length) return 'no type its schema names';
  if (named.length > 1) return `more than one type (${named.join(', ')})`;
  const [type] = named;
  if (PLAIN.has(type)) return null;
  if (type === 'array') {
    const items = typesOf(isObject(d.items) ? d.items.type : null).filter((t) => t !== 'null');
    if (items.length === 1 && PLAIN.has(items[0])) return null;
    if (items.includes('object')) return 'a list of objects (an array of objects)';
    if (items.includes('array')) return 'a list of lists (an array of arrays)';
    return items.length ? `a list of ${items.join(' or ')}` : 'a list whose items have no type';
  }
  if (type === 'object') return 'an object';
  return `a ${type}`;
}

const of = (c) => c.uuid || c.key;

module.exports = {
  name: NAME,
  summary: "A field marked to be carried on its elements' Neo4j nodes is a plain top-level field of a concept, with a property node in its property tree, and a property name no other mark yields and nothing else wrote.",
  refuses: true,
  refusals: [
    F.NOT_INSTALLED,
    F.UNKNOWN_CONCEPT,
    F.UNKNOWN_FIELD,
    { code: 'no-property-node', status: 409, when: "The field has no property node under its concept's section node in the concept's property tree, or the concept has no primary property: run POST /api/normalize/generate-property-tree for the concept first" },
    { code: 'not-plain', status: 409, when: 'The field holds an object, a list of objects or a list of lists, which no Neo4j property can hold' },
    { code: 'unusable-name', status: 409, when: "The concept's key isn't letters and digits, so <key>_<field> can't be written unquoted in Cypher" },
    { code: 'property-taken', status: 409, when: 'Another mark already yields the same property name: another concept with the same key marked a field of the same name' },
    { code: 'property-in-use', status: 409, when: "A current element of the concept already carries the property name, though the field isn't marked: something else wrote it" },
  ],

  async violations(items, read) {
    const out = [];
    const list = (items || []).filter(Boolean);
    if (!list.length) return out;
    if (!(await F.firstSetOf(read))) {
      for (const item of list) out.push({ item, code: 'not-installed', message: F.say.notInstalled() });
      return out;
    }
    const concepts = new Map();
    const elements = new Map();
    let marks = null;
    for (const item of list) {
      const { concept: key, field } = item;
      if (!concepts.has(key)) concepts.set(key, await F.conceptOf(read, key));
      const c = concepts.get(key);
      if (!c) { out.push({ item, code: 'unknown-concept', message: F.say.unknownConcept(key) }); continue; }
      if (typeof field !== 'string' || !Object.prototype.hasOwnProperty.call(c.fields, field)) {
        out.push({ item, code: 'unknown-field', message: F.say.unknownField(c, field) });
        continue;
      }
      const node = await F.propertyNodeOf(read, c, field);
      if (!node) {
        out.push({
          item,
          code: 'no-property-node',
          message: `${field} has no property node in ${of(c)}'s property tree${c.wrapped || !c.oKey ? '' : `, under its ${c.oKey} section`}, so there is nothing to mark (a node made by create-property, off the schema node, doesn't count: it can be shared between concepts). Make the concept's property tree first with POST /api/normalize/generate-property-tree, which signs the property nodes it makes with the assistant's key, then mark the field.`,
        });
        continue;
      }
      const holds = notPlain(c.fields[field]);
      if (holds) {
        out.push({ item, code: 'not-plain', message: `${field} holds ${holds}, and a Neo4j property holds only a string, a number, an integer or a boolean, or a list of one of them. Fields like it wait for nested fields (design §5, question 1).` });
        continue;
      }
      if (!KEY.test(String(c.oKey)) || !FIELD.test(field)) {
        out.push({ item, code: 'unusable-name', message: `${of(c)}'s key, ${c.oKey}, isn't letters and digits, so its property ${F.propertyName(c.oKey, field)} couldn't be written in Cypher without quotes. A field of it can't be marked.` });
        continue;
      }
      const property = F.propertyName(c.oKey, field);
      if (!marks) marks = await F.marksOf(read, {});
      const other = marks.find((m) => m.property === property && m.node !== node);
      if (other) {
        out.push({ item, code: 'property-taken', message: `${property} is already carried for another concept with the key ${c.oKey}: ${other.uuid || other.concept} (tapestryKey ${other.concept}) marked its ${other.field}. A property name has one mark across the graph; unmark that one first to mark this.` });
        continue;
      }
      if (marks.some((m) => m.node === node)) continue;
      if (!elements.has(c.key)) elements.set(c.key, await F.elementsOf(read, c, F.MAX_ELEMENTS + 1));
      const carrier = elements.get(c.key).find((e) => e.copies[property] !== undefined);
      if (carrier) {
        out.push({ item, code: 'property-in-use', message: `${carrier.uuid ? `${carrier.uuid} (tapestryKey ${carrier.key})` : carrier.key}, an element of ${of(c)}, already carries ${property}, though ${field} isn't marked: something else wrote it. Remove it first, or leave the field unmarked.` });
      }
    }
    return out;
  },
};
