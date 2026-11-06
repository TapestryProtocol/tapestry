/**
 * The reading views' writes (Outline, for now): edit a thing's title and text, and make a new item in
 * a kind or a Set. The board asks can(id) first and shows every refused action disabled, with the
 * reason in words; write('edit' | 'create', body) does it.
 *
 * A port of the brainstorm-harness's brain-view writes (which run bin/brain), on this instance's own
 * endpoints, as the signed-in owner. The server decides what is allowed; nothing here widens that.
 *   - a thing's title and text: ONE republish of its event at the same address, so every link to it
 *     survives (POST /api/strfry/publish, signAs: 'assistant'), then POST /api/neo4j/event-update
 *   - a new item: POST /api/normalize/create-element, then, in a Set, POST /api/normalize/add-to-set
 * Every write is read back from the graph before it is reported as done.
 *
 * What only the owner can do: only the owner may sign as this instance's Tapestry Assistant, so only
 * the owner's session writes here. A thing signed by another key — including things another instance
 * sent here (`brain send`), signed by that instance's assistant — can be changed only by its author.
 */
import { R } from './readVerbs';
import { queryRelay } from '../../api/relay';

const TEXT_FIELDS = ['claim', 'stance', 'description'];
const FIELD_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const BOOKKEEPING = new Set(['scope', 'recorded', 'source_commit', 'sourceWork', 'project']);
const LAST_WRITE = {};   // uuid -> time of the last write from this page (two in one second can fork a node)
const short = (pk) => (pk || '').slice(0, 8) + '…';
const STATE_WORDS = { dict: 'community, in my Dictionary', imported: 'community, imported', known: 'community, known here only by its header' };

/** Tapestry's slug (src/lib/dtag.js), to foresee the address create-element will use. */
function slug(name) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
async function sha256hex(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function today() {   // local time, to the second, as bin/brain writes "recorded"
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function settle(uuid) {   // wait out a write to the same node in the last 1.5 s (same-second writes fork)
  const dt = Date.now() - (LAST_WRITE[uuid] || 0);
  if (dt < 1500) await sleep(1500 - dt);
}
const wrote = (uuid) => { LAST_WRITE[uuid] = Date.now(); };

async function post(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let d = null;
  try { d = await res.json(); } catch { d = null; }
  if (!res.ok || !d || d.success === false || d.error) {
    throw new Error((d && (d.error || d.message)) || `${path}: HTTP ${res.status}`);
  }
  return d;
}

/** An element's json as one dict of fields (Tapestry's {"word":…, "<kind>":{…}} wrapper opened), and
 *  where each field lives: {field: wrapper key, or null for the top level}. */
function flat(j) {
  const out = {}, where = {};
  if (!j || typeof j !== 'object' || Array.isArray(j)) return [out, where];
  const n = Object.keys(j).length;
  for (const [k, v] of Object.entries(j)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && n <= 2) {
      for (const [f, x] of Object.entries(v)) { out[f] = x; where[f] = k; }
    } else { out[k] = v; where[k] = null; }
  }
  return [out, where];
}

async function nodeFacts(id) {
  const r = (await R("MATCH (n:NostrEvent {uuid:$u}) OPTIONAL MATCH (n)-[:HAS_TAG]->(j:NostrEventTag {type:'json'}) "
    + "OPTIONAL MATCH (n)-[:HAS_TAG]->(d:NostrEventTag {type:'description'}) "
    + 'RETURN n.name AS name, labels(n) AS labels, n.pubkey AS pk, collect(DISTINCT j.value) AS js, head(collect(d.value)) AS d', { u: id }))[0];
  if (!r) return null;
  const labels = r.labels || [];
  const role = id.startsWith('39998:') || labels.includes('ConceptHeader') ? 'concept'
    : labels.includes('Set') && !labels.includes('Superset') ? 'set' : labels.includes('Superset') ? 'plumbing' : 'element';
  let json;
  try { json = JSON.parse((r.js || [])[0] || '{}'); } catch { json = null; }
  return { name: r.name || '', role, pk: r.pk || id.split(':')[1], json, jsonText: (r.js || [])[0] || null,
    forked: (r.js || []).length > 1, descTag: r.d };
}

/** Where a thing's text lives, as the Outline reads it: a claim or stance field, a description field,
 *  else its description tag; with none of these, new text goes in a description field. */
function textPlace(f) {
  const [fl, where] = flat(f.json || {});
  for (const k of TEXT_FIELDS) {
    if (typeof fl[k] === 'string') return { in: 'json', field: k, wrapper: where[k], text: fl[k], says: `its ${k} field` };
  }
  if (f.descTag) return { in: 'tag', field: 'description', text: f.descTag, says: 'its description' };
  return { in: 'json', field: 'description', wrapper: null, text: '', says: 'a new description field' };
}

/** [kind header, kind name] a new item in this concept or Set is an element of. A Set's items are of
 *  the kind its members mostly are, as long as that kind sits at or under the Set's own kind. */
async function kindOfHolder(id, role) {
  if (role === 'concept') {
    const r = await R('MATCH (h:NostrEvent {uuid:$u}) RETURN h.name AS n', { u: id });
    return [id, r[0] ? r[0].n : ''];
  }
  const r = await R('MATCH p = (h:ConceptHeader)-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF*1..8]->(s:NostrEvent {uuid:$u}) '
    + 'RETURN h.uuid AS h, h.name AS n ORDER BY length(p) LIMIT 1', { u: id });
  if (!r.length) return [null, null];
  const m = await R('MATCH (:NostrEvent {uuid:$s})-[:HAS_ELEMENT]->(e)<-[:HAS_ELEMENT]-(sup:Superset)<-[:IS_THE_CONCEPT_FOR]-(h:ConceptHeader) '
    + 'MATCH (:NostrEvent {uuid:$k})-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF*0..8]->(sup) '
    + 'RETURN h.uuid AS h, h.name AS n, count(DISTINCT e) AS c ORDER BY c DESC, n LIMIT 1', { s: id, k: r[0].h });
  return m.length ? [m[0].h, m[0].n] : [r[0].h, r[0].n];
}

/** The kind create-element would write into: the server finds a header by NAME alone, LIMIT 1
 *  (src/api/normalize/index.js handleCreateElement). Asked with the server's own query. */
async function serverPick(kindName) {
  const r = await R('MATCH (h:NostrEvent) WHERE (h:ListHeader OR h:ClassThreadHeader) AND h.kind IN [9998, 39998] AND h.name = $concept '
    + 'OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(sup:Superset) RETURN h.uuid AS u LIMIT 1', { concept: kindName });
  return r.length ? r[0].u : null;
}

/** The fields a new item here is offered: the kind's schema fields and its header's field tags
 *  (required, recommended, optional), and the fields its current elements actually use. */
async function fieldSlots(kindH, holder, role) {
  const slots = {};
  const slot = (f, kw) => {   // the title is the item's name (a name or title field is filled from it)
    if (!FIELD_RE.test(f || '') || BOOKKEEPING.has(f) || ['name', 'title', 'slug'].includes(f)) return;
    const s = slots[f] = slots[f] || { field: f, label: f, hint: '', rank: 9, used: 0, long: false };
    for (const [k, v] of Object.entries(kw)) {
      if (v == null || v === '') continue;
      if (k === 'rank') s.rank = Math.min(s.rank, v);
      else if (k === 'hint' && s.hint) continue;
      else s[k] = v;
    }
  };
  const sj = ((await R('MATCH (s)-[:IS_THE_JSON_SCHEMA_FOR]->(k:NostrEvent {uuid:$u}) '
    + "OPTIONAL MATCH (s)-[:HAS_TAG]->(j:NostrEventTag {type:'json'}) RETURN head(collect(j.value)) AS sj", { u: kindH }))[0] || {}).sj;
  const types = {}, schema = {};
  try {
    for (const p of Object.values(((JSON.parse(sj || '{}').jsonSchema || {}).properties) || {})) {
      for (const [f, spec] of Object.entries((p && p.properties) || {})) {
        if (spec && typeof spec === 'object') { types[f] = spec.type; schema[f] = spec.description || ''; }
      }
    }
  } catch { /* a schema that does not parse offers no fields */ }
  const listy = new Set(Object.keys(types).filter((f) => types[f] === 'array' || types[f] === 'object'));   // lists and links: later
  Object.entries(schema).forEach(([f, m]) => { if (!listy.has(f)) slot(f, { hint: m, rank: 3 }); });
  for (const r of await R("MATCH (h:NostrEvent {uuid:$u})-[:HAS_TAG]->(t:NostrEventTag) WHERE t.type IN ['required','recommended','optional','field-type'] "
    + 'RETURN t.type AS ty, t.value AS f, t.value1 AS v1', { u: kindH })) {
    const f = r.f || '';
    if (f.length < 2) continue;   // a one-letter value names a Nostr tag the item carries, not a field
    if (r.ty === 'field-type') { if (slots[f]) slots[f].type = r.v1; continue; }
    slot(f, { label: r.v1 || f, rank: { required: 0, recommended: 1, optional: 2 }[r.ty], ...(r.ty === 'required' ? { required: true } : {}) });
  }
  const rows = role === 'set'
    ? await R("MATCH (:NostrEvent {uuid:$u})-[:HAS_ELEMENT]->(e) OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type:'json'}) RETURN j.value AS j LIMIT 300", { u: holder })
    : await R('MATCH (:NostrEvent {uuid:$u})-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF*0..8]->()-[:HAS_ELEMENT]->(e) '
      + "WHERE NOT 'ConceptHeader' IN labels(e) OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type:'json'}) RETURN DISTINCT e.uuid AS e, j.value AS j LIMIT 300", { u: holder });
  const skipped = new Set(), lens = {};
  for (const r of rows) {
    let fl;
    try { [fl] = flat(JSON.parse(r.j || '{}')); } catch { continue; }
    for (const [f, v] of Object.entries(fl)) {
      if (BOOKKEEPING.has(f)) continue;
      if (typeof v === 'string' || typeof v === 'number') {
        slot(f, { rank: 4 });
        if (slots[f]) { slots[f].used += 1; (lens[f] = lens[f] || []).push(String(v).length); }
      } else if (v != null && v !== '' && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Object.keys(v).length) && typeof v !== 'boolean') {
        skipped.add(f);
      }
    }
  }
  Object.entries(lens).forEach(([f, ls]) => { if (slots[f]) slots[f].long = ls.reduce((a, b) => a + b, 0) / ls.length > 80; });
  TEXT_FIELDS.forEach((f) => { if (slots[f]) slots[f].long = true; });
  const n = rows.length;
  Object.values(slots).forEach((s) => { if (s.used) s.hint = (s.hint ? s.hint + ' · ' : '') + `${s.used} of ${n} here have it`; });
  const out = Object.values(slots).sort((a, b) => a.rank - b.rank || b.used - a.used || (a.field < b.field ? -1 : 1));
  const notOffered = [...new Set([...skipped, ...listy])].filter((f) => !slots[f] && !['name', 'title', 'slug'].includes(f)).sort();
  return [out, notOffered];
}

async function whose(id, ta) {
  // whose a kind is: ours, or another author's that our Dictionary holds a copy of, or another's
  const pk = id.split(':')[1];
  if (pk === ta) return ['ours', 'ours'];
  const kindOf = id.startsWith('39998:') ? id : null;
  const copies = await R('MATCH (h:NostrEvent) WHERE h.kind = 39998 AND h.pubkey = $ta '
    + "MATCH (h)-[:HAS_TAG]->(b:NostrEventTag {type:'b'}) WHERE b.value = $c RETURN h.uuid AS u LIMIT 1", { ta, c: kindOf || '' });
  if (kindOf && copies.length) return ['dict', STATE_WORDS.dict, copies[0].u];
  return ['imported', STATE_WORDS.imported];
}

/** What the reading views may do to one node, each action with ok and, when not, why (in words). */
export async function can(id, cfg) {
  const out = { id, edit: null, create: null };
  const f = await nodeFacts(id);
  if (!f) throw new Error(`${id} is not in the graph`);
  const ta = cfg.taPubkey;
  const off = !cfg.signedIn ? { ok: false, why: 'Sign in as this instance’s owner to change things here.' }
    : !cfg.isOwner ? { ok: false, why: 'Only this instance’s owner can change things here: a change is signed as its Tapestry Assistant, which only the owner may do.' }
      : null;
  if (f.role === 'element') {
    const e = { ok: true, why: '', name: f.name, ...textPlace(f) };
    if (off) Object.assign(e, off);
    else if (f.pk !== ta) {
      Object.assign(e, { ok: false, why: `Not this instance’s: it was signed by ${short(f.pk)}, not this instance’s assistant (${short(ta)}). `
        + 'Only its author can change it. (Things another instance sent here keep that instance’s signature: change them there and send them again.)' });
    } else if (f.forked) Object.assign(e, { ok: false, why: 'It has two different json tags (a same-second fork); there is no telling which is current.' });
    else if (f.json === null) Object.assign(e, { ok: false, why: 'Its json tag does not parse, so the page would not know what it was changing.' });
    out.edit = e;
  }
  if (f.role === 'concept' || f.role === 'set') {
    const [kh, kn] = await kindOfHolder(id, f.role);
    const c = { ok: true, why: '', holder: id, role: f.role, kind: kh, kind_name: kn, holder_name: f.name, fields: [], not_offered: [] };
    if (kh) [c.fields, c.not_offered] = await fieldSlots(kh, id, f.role);
    const kpk = (kh || '::').split(':')[1];
    const same = await R('MATCH (h:NostrEvent) WHERE h.kind IN [9998, 39998] AND h.name = $n RETURN h.uuid AS u', { n: kn || '' });
    const pick = kh && same.length > 1 ? await serverPick(kn) : kh;
    if (off) Object.assign(c, off);
    else if (f.role === 'set' && f.pk !== ta) {
      Object.assign(c, { ok: false, why: `This Set was made by ${short(f.pk)}, not this instance. In Tapestry a Set’s members are its author’s to choose: `
        + `an item of ours claiming a place in it is skipped by everyone reading their Sets. Only ${short(f.pk)} can add here.` });
    } else if (!kh) Object.assign(c, { ok: false, why: 'No kind holds this Set here, so a new item would have no kind.' });
    else if (kpk !== ta) {
      const [st, , copy] = await whose(kh, ta);
      const cn = copy ? ((await R('MATCH (h:NostrEvent {uuid:$u}) RETURN h.name AS n', { u: copy }))[0] || {}).n : null;
      Object.assign(c, { ok: false, copy: copy || undefined, why: st === 'dict' && copy
        ? `The kind “${kn}” is ${short(kpk)}’s. An item we make names our own kind as its parent (Tapestry’s stamping rule), so it goes in our copy of this kind in My Dictionary (“${cn}”), not here.`
        : `The kind “${kn}” is ${short(kpk)}’s. An item we make names our own kind as its parent (Tapestry’s stamping rule), and we have no copy of this one: add it to My Dictionary first, then add items to the copy.` });
    } else if (pick !== kh) {
      Object.assign(c, { ok: false, why: `${same.length} kinds here are called “${kn}”, and create-element finds a kind by name alone: it would pick `
        + `${short((pick || '::').split(':')[1])}’s, not ours. Not from here until create-element takes the kind’s address.` });
    }
    out.create = c;
  }
  return out;
}

/** The newest event at an address on this instance's relay. */
async function relayEvent(id) {
  const [k, pk, ...rest] = id.split(':');
  const evs = await queryRelay({ kinds: [Number(k)], authors: [pk], '#d': [rest.join(':')], limit: 10 });
  return (evs || []).sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0] || null;
}

async function edit(body, cfg) {
  const id = String(body.id || '');
  const e = (await can(id, cfg)).edit;
  if (!e) throw new Error('only a particular thing (an element) is edited here');
  if (!e.ok) return { ok: false, why: e.why };
  const name = String(body.name != null ? body.name : e.name).split(/\s+/).filter(Boolean).join(' ');
  const text = String(body.text != null ? body.text : e.text).replace(/\r\n/g, '\n').trim();
  if (!name) return { ok: false, why: 'The title may not be empty.' };
  const textChanged = text !== (e.text || '').trim(), nameChanged = name !== e.name;
  if (!textChanged && !nameChanged) return { ok: true, saved: [], id };

  // one republish of our event, same address: its name, its json (Neo4j's copy is the definitive one:
  // the relay can hold an older version after a same-second write), its description tag
  const f = await nodeFacts(id);
  const ev = await relayEvent(id);
  if (!ev) return { ok: false, why: 'It is not on this instance’s relay, so there is no event to republish.' };
  if (ev.pubkey !== cfg.taPubkey) return { ok: false, why: 'The event on the relay was signed by another key; only its author can change it.' };
  const j = f.json && typeof f.json === 'object' ? JSON.parse(JSON.stringify(f.json)) : {};
  if (textChanged && e.in === 'json') (e.wrapper ? j[e.wrapper] : j)[e.field] = text;
  if (nameChanged) {   // a name or title field that said the old name says the new one
    [j, ...Object.values(j).filter((v) => v && typeof v === 'object' && !Array.isArray(v))].forEach((x) => {
      ['name', 'title'].forEach((k) => { if (x[k] === e.name) x[k] = name; });
    });
  }
  let tags = (ev.tags || []).map((t) => [...t]);
  if (nameChanged) tags = tags.filter((t) => t[0] !== 'name').concat([['name', name]]);
  const jsonChanged = JSON.stringify(j) !== JSON.stringify(f.json || {});
  const relayJson = (tags.find((t) => t[0] === 'json') || [])[1];
  if (jsonChanged || (f.jsonText != null && relayJson !== f.jsonText)) {
    tags = tags.filter((t) => t[0] !== 'json').concat([['json', jsonChanged ? JSON.stringify(j) : f.jsonText]]);
  }
  if (textChanged && e.in === 'tag') tags = tags.filter((t) => t[0] !== 'description').concat([['description', text]]);
  await settle(id);
  const created = Math.max(Math.floor(Date.now() / 1000), (ev.created_at || 0) + 1);
  try {
    await post('/api/strfry/publish', { event: { kind: ev.kind, content: ev.content || '', tags, created_at: created }, signAs: 'assistant' });
    wrote(id);
    await post('/api/neo4j/event-update', { uuid: id });
  } catch (err) {
    wrote(id);
    return { ok: false, why: 'Not saved: ' + (err.message || err) };
  }
  // read it back: a write is checked by the state it was meant to change, never by its own report
  const now = await nodeFacts(id);
  const place = textPlace(now);
  const bad = [['title', now.name === name], ['text', (place.text || '').trim() === text]].filter(([, ok]) => !ok).map(([w]) => w);
  if (bad.length) return { ok: false, why: `Written, but the graph does not show the new ${bad.join(' and ')} yet.` };
  return { ok: true, saved: [nameChanged && 'title', textChanged && 'text'].filter(Boolean), id };
}

async function create(body, cfg) {
  const holder = String(body.holder || '');
  const c = (await can(holder, cfg)).create;
  if (!c) throw new Error('a new item is made in a kind or a Set');
  if (!c.ok) return { ok: false, why: c.why };
  const name = String(body.name || '').split(/\s+/).filter(Boolean).join(' ');
  if (!name) return { ok: false, why: 'A new item needs a title.' };
  if (name.length > 300) return { ok: false, why: 'That title is longer than 300 characters.' };
  if (!slug(name)) return { ok: false, why: 'The title needs at least one letter or digit.' };
  const offered = Object.fromEntries(c.fields.map((s) => [s.field, s]));
  const data = {};
  for (const [k, v0] of Object.entries(body.fields || {})) {
    const v = String(v0 != null ? v0 : '').replace(/\r\n/g, '\n').trim();
    if (!v) continue;
    if (!offered[k]) return { ok: false, why: `“${k}” is not one of the fields offered here.` };
    data[k] = v;
  }
  const missing = c.fields.filter((s) => s.required && !(s.field in data)).map((s) => s.label);
  if (missing.length) return { ok: false, why: 'Required here: ' + missing.join(', ') + '.' };
  const sc = String(body.scope || '');
  if (sc.startsWith('project:')) data.scope = [sc.slice('project:'.length)];
  data.recorded = today();
  if (await serverPick(c.kind_name) !== c.kind) return { ok: false, why: `create-element would now pick another kind called “${c.kind_name}”; nothing was made.` };
  const addr = `39999:${cfg.taPubkey}:${slug(name)}-${(await sha256hex(c.kind)).slice(0, 8)}`;
  const clash = await R('MATCH (n:NostrEvent {uuid:$u}) RETURN n.name AS n', { u: addr });
  if (clash.length) {
    return { ok: false, why: `“${c.kind_name}” already holds “${clash[0].n}”, which a new item with this title would overwrite `
      + '(titles that differ only in case or punctuation share an address). Pick another title.' };
  }
  // in a Set: add-to-set finds the Set and the item by name, first match; make sure each name means one node
  if (c.role === 'set') {
    const sets = await R("MATCH (s:NostrEvent)-[:HAS_TAG]->(n:NostrEventTag {type: 'name'}) WHERE 'Set' IN labels(s) AND toLower(n.value) = toLower($n) RETURN DISTINCT s.uuid AS u", { n: c.holder_name });
    if (sets.length !== 1 || sets[0].u !== holder) {
      return { ok: false, why: `${sets.length} Sets here are called “${c.holder_name}”, and Tapestry’s add-to-set finds a Set by name: it could put the item in the wrong one. Nothing was made.` };
    }
    const named = await R("MATCH (i)-[:HAS_TAG]->(n:NostrEventTag) WHERE (i:ListItem AND n.type = 'name' OR i:ListHeader AND n.type = 'names') "
      + 'AND toLower(n.value) = toLower($n) RETURN count(DISTINCT i) AS c', { n: name });
    if ((named[0] || {}).c) return { ok: false, why: `Something here is already called “${name}”, and add-to-set finds the item by name. Pick another title.` };
  }
  let made;
  try {
    made = await post('/api/normalize/create-element', { concept: c.kind_name, name, json: JSON.stringify(data) });
  } catch (err) {
    return { ok: false, why: 'Not made: ' + (err.message || err) };
  }
  const id = (made.element || {}).uuid;
  wrote(addr);
  if (!id) return { ok: false, why: 'Not made: the instance did not say what it made.' };
  const z = (await R("MATCH (:NostrEvent {uuid:$u})-[:HAS_TAG]->(t:NostrEventTag {type:'z'}) RETURN t.value AS z", { u: id })).map((r) => r.z);
  if (!z.includes(c.kind)) return { ok: false, id, why: `Made, but in another kind than “${c.kind_name}” (its z: ${z.join(', ')}). Tell the owner.` };
  if (c.role === 'set') {
    await settle(id);
    try {
      await post('/api/normalize/add-to-set', { setName: c.holder_name, itemName: name });
    } catch (err) {
      return { ok: false, id, why: `Made as a ${c.kind_name}, but not put in “${c.holder_name}”: ${err.message || err}` };
    }
    wrote(id);
    const inSet = await R('MATCH (:NostrEvent {uuid:$s})-[:HAS_ELEMENT]->(:NostrEvent {uuid:$e}) RETURN 1 AS x', { s: holder, e: id });
    if (!inSet.length) return { ok: false, id, why: `Made as a ${c.kind_name}, but the graph does not show it in “${c.holder_name}” yet.` };
  }
  return { ok: true, id };
}

export async function write(what, body, cfg) {
  if (what === 'edit') return edit(body, cfg);
  if (what === 'create') return create(body, cfg);
  throw new Error('no write ' + what);
}
