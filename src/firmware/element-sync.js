'use strict';
/**
 * What a firmware install does with one element file of a concept whose manifest entry sets updateElements — story
 * graph-operations-first-slice #41 (Loom A10.41), ADR graph-operations-first-slice/0041 Decision 6 and Amendment 1.
 *
 * planElement({ json, found, ta, resolve }) → { action, uuid, others }
 *   json     the element file's JSON
 *   found    the elements install read with the file's name, in the concept's class thread: [{ uuid, json }], json as
 *            the node's json tag holds it (JSON text, an LMDB reference, or null)
 *   ta       the instance's assistant's pubkey, read at runtime (firmware.getTAPubkey()), never written into code
 *   resolve  turns an LMDB reference into its JSON, as an object or text, or null when its entry is missing;
 *            resolveValue from src/lib/tapestry-resolve by default
 *
 *   create     no element has the name
 *   unchanged  the assistant's element holds the file's JSON, compared as values (uuid: its address)
 *   update     it holds other JSON, or JSON that can't be read (uuid: its address)
 *   blocked    only other authors' elements have the name (others: their addresses): install never signs over them
 *
 * With more than one of the assistant's elements, the first by address decides. It reads and writes nothing itself.
 */

/** JSON as text with every object's keys sorted, so two values compare equal whatever their key order. */
function stable(x) {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`;
  if (x && typeof x === 'object') return `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${stable(x[k])}`).join(',')}}`;
  return JSON.stringify(x);
}

function defaultResolve(value) {
  // Required here, not at load: reading the store is the caller's moment, never this module's.
  return require('../lib/tapestry-resolve').resolveValue(value);
}

/** The JSON a json tag holds, or a throw when it can't be read. */
function storedJson(value, resolve) {
  let v = value;
  if (typeof v === 'string' && v.startsWith('lmdb:')) v = resolve(v);
  if (typeof v === 'string') v = JSON.parse(v);
  if (v === null || typeof v !== 'object') throw new Error('no JSON');
  return v;
}

function planElement({ json, found, ta, resolve } = {}) {
  const rows = (Array.isArray(found) ? found : []).filter((r) => r && typeof r.uuid === 'string');
  if (!rows.length) return { action: 'create' };
  const prefix = typeof ta === 'string' && ta ? `39999:${ta}:` : null;
  const own = rows.filter((r) => prefix && r.uuid.startsWith(prefix)).sort((a, b) => (a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0));
  if (!own.length) return { action: 'blocked', others: rows.map((r) => r.uuid) };
  const first = own[0];
  let stored;
  try {
    stored = storedJson(first.json, typeof resolve === 'function' ? resolve : defaultResolve);
  } catch {
    return { action: 'update', uuid: first.uuid };
  }
  return { action: stable(stored) === stable(json) ? 'unchanged' : 'update', uuid: first.uuid };
}

module.exports = { planElement };
