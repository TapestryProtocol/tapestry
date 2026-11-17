'use strict';
/**
 * Naming a node (story graph-operations-first-slice #9, ADR graph-operations-first-slice/0009 Decisions 1–3 and 5):
 * what a ref names, and when it is ambiguous, defined once. graph resolve answers a page of what a ref names. A later
 * operation's input that takes a ref turns it into one tapestryKey with resolveOne, which refuses a ref that names no
 * node, or more than one, naming the candidates. Nothing here ever picks one.
 *
 * A ref is read by its shape alone (Decision 1); the first rule that applies decides:
 *   a tapestryKey                    read as a tapestryKey, as given
 *   kind:pubkey:… (a 64-hex pubkey)  an address, its pubkey lowercased
 *   64 hex characters                an address: an event's id, lowercased
 *   an naddr, nevent or note         the address or the id it decodes to; one that doesn't decode reads on
 *   anything else                    a name, cleaned of extra white space; and a slug, its lowercase, when that has a
 *                                    slug's shape (a versioned d-tag's nonce, ~N, included)
 *
 * What each reading names (Decision 2):
 *   tapestryKey  the node that has it
 *   address      the node at it (its uuid), and the replaceable node whose latest event it is (its id)
 *   name         every node whose name (its tapestryValue, else its name property) it is, case aside; and every concept
 *                header whose names tag's plural it is
 *   slug         every concept header whose slug tag it is, and every node of kind 39998 or 39999 whose whole d-tag it is
 *
 * A change entry, an event's tag node, and a node with no tapestryKey or the placeholder '{}' are never candidates.
 * `kind` concept keeps concept headers (ConceptHeader, or ListHeader for one the nostr import brought in); set keeps
 * sets and supersets that have an address. Whether a candidate counts is reads.js's trust test (C2), a fragment of the
 * query, run at read time: nothing about a point of view is stored (CLAUDE.md, principles 1–3).
 *
 * It opens nothing at load (ADR graph-operations-foundation/0001 Decision 10): nostr-tools, the config and the
 * assistant's key are required when first called.
 */

const CN = require('../lib/conceptNames');
const R = require('./reads');
const { refusal } = require('./refusal');
const { KEY_PATTERN } = require('./catalog/graph/_nodes');

const KEY = new RegExp(KEY_PATTERN);
const ADDRESS = /^(\d+):([0-9A-Fa-f]{64}):/;
const EVENT_ID = /^[0-9A-Fa-f]{64}$/;
const NIP19 = /^(naddr|nevent|note)1[02-9ac-hj-np-z]+$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*(~[0-9]+)?$/;
/** How much longer than its d-tag the address of a kind-39998 or 39999 node is: '3999N:', the pubkey, ':'. */
const D_TAG_PREFIX = 71;
/** How many candidates an ambiguous-ref refusal carries. */
const MAX_CANDIDATES = 10;

// ── the inputs ──

const REF_INPUT = {
  schema: { type: 'string', maxLength: 1000 },
  required: true,
  description: "What to resolve: a node's tapestryKey; a nostr address (kind:pubkey:d-tag) or an event's id, or the naddr, nevent or note of one; or a name or a slug, as people name a node",
};
const KIND_INPUT = {
  schema: { type: 'string', enum: ['concept', 'set'] },
  description: 'Keep only concept headers (concept), or only sets and supersets (set); leave it out for any node',
};

/** An input that takes a ref, for a later operation (Decision 5): REF_INPUT's schema, with its own description. */
function refInput(description) {
  return { schema: { ...REF_INPUT.schema }, description };
}

// ── the refusals ──

const BAD_REF = Object.freeze({ code: 'bad-ref', status: 400, when: 'A ref that is empty once trimmed, or holds a control character, a text-direction control or an invisible character that draws nothing where it is; the refusal names the input, and the character when one is the problem' });
const UNKNOWN_REF = Object.freeze({ code: 'unknown-ref', status: 404, when: "A ref that names no node that counts from the point of view, of the kind the input takes; the refusal names the input and says how many the point of view left out (a node's tapestryKey names it whatever the point of view)" });
const AMBIGUOUS_REF = Object.freeze({ code: 'ambiguous-ref', status: 409, when: 'A ref that names more than one node that counts from the point of view; the refusal names the input and carries its candidates, up to 10, and more when there are others: pass the tapestryKey of the one meant' });

// ── the schemas ──

const READING = {
  type: 'object',
  required: ['as', 'value'],
  properties: {
    as: { type: 'string', enum: ['tapestryKey', 'address', 'name', 'slug'], description: 'What the ref was read as' },
    value: { type: 'string', description: 'What was looked up: the key as given, the address with its pubkey in lowercase, the name with each run of white space as one space, or the slug in lowercase' },
  },
};

const CANDIDATE = {
  type: 'object',
  required: [...R.NODE.required, 'kind', 'matched'],
  properties: {
    ...R.NODE.properties,
    kind: { type: 'string', enum: ['concept', 'superset', 'set', 'node'], description: 'A concept header (concept), a superset or a set with an address, or another node' },
    matched: {
      type: 'array',
      items: { type: 'string', enum: ['tapestryKey', 'address', 'name', 'plural', 'slug', 'd-tag'] },
      description: "How the ref matched it, each way it did: its tapestryKey, its address, its name, a concept's plural, a concept's slug, or its d-tag",
    },
  },
};

// ── a ref, read (Decision 1) ──

/** A text as a refusal quotes it, as create-concept does: JSON, cut to 60 characters. */
const quote = (text) => JSON.stringify(text.length > 60 ? `${text.slice(0, 57)}…` : text);

/** The address or id an naddr, nevent or note decodes to, or null when it doesn't decode to one. */
function decoded(text) {
  let d;
  try { d = require('nostr-tools').nip19.decode(text); } catch { return null; }
  const data = d && d.data;
  if (d && d.type === 'naddr' && data && Number.isInteger(data.kind) && typeof data.pubkey === 'string' && EVENT_ID.test(data.pubkey) && typeof data.identifier === 'string') {
    return `${data.kind}:${data.pubkey.toLowerCase()}:${data.identifier}`;
  }
  if (d && d.type === 'nevent' && data && typeof data.id === 'string' && EVENT_ID.test(data.id)) return data.id.toLowerCase();
  if (d && d.type === 'note' && typeof data === 'string' && EVENT_ID.test(data)) return data.toLowerCase();
  return null;
}

/**
 * How `ref` is read, before anything is read from the graph: { family, readings, key | address | name and slug }.
 * `family` is key, address or name, which says what it matches; `readings` is [{ as, value }], as the answer gives it.
 * Refuses bad-ref, naming `input`, when the trimmed ref is empty or holds a character that can make it read as another.
 */
function readingsOf(ref, input = 'ref') {
  const raw = typeof ref === 'string' ? ref : '';
  const text = raw.trim();
  const why = CN.textProblem(text);
  if (why) throw refusal(BAD_REF.code, `The ${input} ${quote(raw)} can't be resolved: ${why}.`, { input });
  if (KEY.test(text)) return { family: 'key', key: text, readings: [{ as: 'tapestryKey', value: text }] };
  const at = text.match(ADDRESS);
  if (at) {
    const address = `${at[1]}:${at[2].toLowerCase()}:${text.slice(at[0].length)}`;
    return { family: 'address', address, readings: [{ as: 'address', value: address }] };
  }
  if (EVENT_ID.test(text)) {
    const address = text.toLowerCase();
    return { family: 'address', address, readings: [{ as: 'address', value: address }] };
  }
  if (NIP19.test(text)) {
    const address = decoded(text);
    if (address !== null) return { family: 'address', address, readings: [{ as: 'address', value: address }] };
  }
  const name = CN.cleanName(text);
  const lower = name.toLowerCase();
  const slug = SLUG.test(lower) ? lower : null;
  const readings = [{ as: 'name', value: name }];
  if (slug !== null) readings.push({ as: 'slug', value: slug });
  return { family: 'name', name, slug, readings };
}

// ── what each reading matches (Decisions 2 and 3) ──

const VISIBLE = 'NOT n:GraphChange AND NOT n:NostrEventTag';
const KEYED = "n.tapestryKey IS NOT NULL AND n.tapestryKey <> '{}'";
const NAMED = 'toLower(coalesce(n.tapestryValue, n.name)) = toLower($name)';
const D_TAG = "($dSuffix IS NOT NULL AND (n.uuid STARTS WITH '39998:' OR n.uuid STARTS WITH '39999:') AND n.uuid ENDS WITH $dSuffix AND size(n.uuid) = $dSize)";

/** Each family's match: one fixed text each, every value a $-parameter. */
const MATCH = Object.freeze({
  key: `MATCH (n:TapestryNode {tapestryKey: $key})
     WHERE ${VISIBLE}`,
  address: `MATCH (n:TapestryNode)
     WHERE (n.uuid = $address OR n.id = $address) AND ${KEYED} AND ${VISIBLE}`,
  name: `MATCH (n:TapestryNode)
     WHERE ${KEYED} AND ${VISIBLE}
       AND (${NAMED} OR n.tapestryKey IN $tagKeys OR ${D_TAG})`,
});

/** What each kind keeps: a fixed text the input chooses, never one built from it. */
const KINDS = Object.freeze({
  node: '',
  concept: `
       AND (n:ConceptHeader OR n:ListHeader)`,
  set: `
       AND (n:Set OR n:Superset) AND n.uuid IS NOT NULL`,
});

/** How family N's page says each node matched; a key and an address each match one way, which the family says. */
const MATCHES = Object.freeze({
  key: '',
  address: '',
  name: `,
            ${NAMED} AS byName, n.tapestryKey IN $pluralKeys AS byPlural, n.tapestryKey IN $slugKeys AS bySlug,
            ${D_TAG} AS byDTag`,
});

/** Statement T: the concept headers whose names tag's plural is the name, or whose slug tag is the slug. */
const TAGS = `MATCH (h:ConceptHeader|ListHeader)-[:HAS_TAG]->(t:NostrEventTag)
     WHERE h.tapestryKey IS NOT NULL AND h.tapestryKey <> '{}' AND NOT h:GraphChange
       AND ((t.type = 'names' AND toLower(t.value1) = toLower($name))
         OR ($slug IS NOT NULL AND t.type = 'slug' AND t.value = $slug))
     RETURN DISTINCT h.tapestryKey AS key, t.type AS tag`;

/** The ways a candidate matched, in the order the answer lists them: the row's column, and its word. */
const WAYS = Object.freeze([['byKey', 'tapestryKey'], ['byAddress', 'address'], ['byName', 'name'], ['byPlural', 'plural'], ['bySlug', 'slug'], ['byDTag', 'd-tag']]);

const asCount = (x) => (typeof x === 'number' ? x : x && typeof x.toNumber === 'function' ? x.toNumber() : Number(x) || 0);

/**
 * What `readings` (readingsOf's) names, of `kind` (concept, set, or node or null for any), from the resolved point of
 * view `pov`: how many nodes it names (`seen`) and how many of them count (`kept`), across the whole list; and `rows`,
 * the ones that count after the tapestryKey `after`, up to limit + 1, in tapestryKey order, each as candidateOf takes it.
 */
async function candidatesOf(read, readings, { kind = null, pov, after = null, limit }) {
  const family = readings && readings.family;
  if (!Object.prototype.hasOwnProperty.call(MATCH, family)) throw new Error(`candidatesOf: ${JSON.stringify(family)} is not a family of readings: key, address or name`);
  const kindText = KINDS[kind === null || kind === undefined ? 'node' : kind];
  if (typeof kindText !== 'string') throw new Error(`candidatesOf: ${JSON.stringify(kind)} is not a kind: concept, set or node`);
  if (!Number.isInteger(limit) || limit < 1) throw new Error(`candidatesOf: the limit must be a whole number from 1; got ${JSON.stringify(limit)}`);

  const params = R.trustParams(pov);
  if (family === 'key') params.key = readings.key;
  if (family === 'address') params.address = readings.address;
  if (family === 'name') {
    const slug = typeof readings.slug === 'string' ? readings.slug : null;
    const plural = new Set();
    const slugged = new Set();
    for (const t of await read(TAGS, { name: readings.name, slug })) {
      if (typeof t.key !== 'string') continue;
      if (t.tag === 'names') plural.add(t.key);
      if (t.tag === 'slug') slugged.add(t.key);
    }
    Object.assign(params, {
      name: readings.name,
      tagKeys: [...new Set([...plural, ...slugged])],
      pluralKeys: [...plural],
      slugKeys: [...slugged],
      // Computed here: the fakes have no arithmetic (ADR 0009, Context 9).
      dSuffix: slug === null ? null : `:${slug}`,
      dSize: slug === null ? null : D_TAG_PREFIX + slug.length,
    });
  }

  const match = `${MATCH[family]}${kindText}`;
  const counted = await read(
    `${match}
     ${R.trust('n')}
     RETURN count(n) AS seen, count(CASE WHEN counts THEN 1 END) AS kept`,
    params,
  );
  const seen = counted.length ? asCount(counted[0].seen) : 0;
  const kept = counted.length ? asCount(counted[0].kept) : 0;
  // The limit is a checked whole number, so it goes into the text: the driver would send a parameter as a float.
  const rows = await read(
    `${match} AND ($after IS NULL OR n.tapestryKey > $after)
     ${R.trust('n')}
     WHERE counts
     RETURN ${R.nodeColumns('n')}, n:ConceptHeader OR n:ListHeader AS isHeader, n:Superset AS isSuperset, n:Set AS isSet${MATCHES[family]}
     ORDER BY tapestryKey
     LIMIT ${limit + 1}`,
    { ...params, after: after === undefined ? null : after },
  );
  return { seen, kept, rows: rows.map((r) => ({ ...r, byKey: family === 'key', byAddress: family === 'address' })) };
}

/**
 * A node's kind, from a row with its address and its isHeader, isSuperset and isSet columns: a concept header is a
 * concept; a superset or a set with an address is one; anything else is a node. graph search answers a match's kind by
 * this too (ADR graph-operations-first-slice/0008 Decision 6).
 */
function kindOf(row) {
  const hasAddress = typeof (row && row.address) === 'string' && row.address.length > 0;
  return row && row.isHeader === true ? 'concept'
    : hasAddress && row.isSuperset === true ? 'superset'
      : hasAddress && row.isSet === true ? 'set'
        : 'node';
}

/** A candidate, answered from one of candidatesOf's rows: a node's five facts (reads.js, C3), its kind, how it matched. */
function candidateOf(row, own) {
  const node = R.nodeOf(row, own);
  return { ...node, kind: kindOf(row), matched: WAYS.filter(([column]) => row[column] === true).map(([, way]) => way) };
}

// ── naming a node in a later operation (Decision 5) ──

const nodes = (n) => `${n} ${n === 1 ? 'node' : 'nodes'}`;

/**
 * The tapestryKey of the one node `ref` names, of `kind` (concept, set, or node for any), from the resolved point of
 * view `pov`, or a refusal naming `input`. A ref shaped like a tapestryKey comes back as given, with no read: the
 * operation's own checks answer for a key as they do today. Any other ref is read (bad-ref), then counted and paged as
 * graph resolve does: none that counts is refused unknown-ref, saying how many the point of view left out; more than
 * one is refused ambiguous-ref, carrying up to 10 candidates and `more`. It never guesses.
 */
async function resolveOne(read, { input, ref, kind = 'node', pov }) {
  const readings = readingsOf(ref, input);
  if (readings.family === 'key') return readings.key;
  const { seen, kept, rows } = await candidatesOf(read, readings, { kind, pov, after: null, limit: MAX_CANDIDATES });
  const shown = quote(ref.trim());
  const as = kind === 'concept' ? ' as a concept' : kind === 'set' ? ' as a set' : '';
  const from = pov && pov.name === 'everyone' ? "everyone's point of view" : "the owner's point of view";
  if (rows.length === 0) {
    const leftOut = Math.max(0, seen - kept);
    throw refusal(UNKNOWN_REF.code, leftOut > 0
      ? `The ${input} ${shown} names no node${as} that counts from ${from}: the point of view left out the ${nodes(leftOut)} it names. A node's tapestryKey names it whatever the point of view.`
      : `The ${input} ${shown} names no node${as} of this graph. Pass a node's tapestryKey, or a name, slug or address that names one node; graph resolve lists what a ref names.`, { input });
  }
  if (rows.length === 1) return rows[0].tapestryKey;
  const candidates = rows.slice(0, MAX_CANDIDATES).map((r) => candidateOf(r, pov.own));
  const more = rows.length > MAX_CANDIDATES;
  const listed = candidates.map((c) => `${c.tapestryKey} (${c.name === null ? 'no name' : quote(c.name)}, a ${c.kind})`);
  throw refusal(AMBIGUOUS_REF.code, `The ${input} ${shown} names ${nodes(Math.max(kept, rows.length))}${as} from ${from}, so it can't say which is meant: ${listed.join('; ')}${more ? '; and more, which graph resolve lists' : ''}. Pass the tapestryKey of the one you mean.`, { input, candidates, more });
}

module.exports = {
  REF_INPUT, KIND_INPUT, refInput,
  BAD_REF, UNKNOWN_REF, AMBIGUOUS_REF,
  READING, CANDIDATE,
  readingsOf, candidatesOf, candidateOf, kindOf, resolveOne,
};
