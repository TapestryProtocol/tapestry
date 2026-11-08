'use strict';
/**
 * Input checking (ADR graph-operations-foundation/0001 Decision 5). Each operation's inputs become one object schema
 * that refuses anything it doesn't name. Query-string and command inputs arrive as text, so their checker coerces
 * ("5" → 5, "true" → true, one value → a list of one). A JSON body arrives typed, so its checker doesn't. Both apply
 * declared defaults. Errors map to the first refusal in the order unknown, missing, invalid, naming the input.
 */

const Ajv = require('ajv');

const textChecker = new Ajv({ allErrors: true, strict: false, useDefaults: true, coerceTypes: 'array' });
const bodyChecker = new Ajv({ allErrors: true, strict: false, useDefaults: true });

/** The object schema of a declaration's inputs. */
function inputsSchema(inputs) {
  const properties = {};
  const required = [];
  for (const [name, input] of Object.entries(inputs || {})) {
    properties[name] = input.schema;
    if (input.required) required.push(name);
  }
  const schema = { type: 'object', properties, additionalProperties: false };
  if (required.length) schema.required = required;
  return schema;
}

const compiled = new WeakMap();
function checkersFor(op) {
  let c = compiled.get(op);
  if (!c) {
    const schema = inputsSchema(op.inputs);
    c = { text: textChecker.compile(schema), body: bodyChecker.compile(schema) };
    compiled.set(op, c);
  }
  return c;
}

const refuse = (code, input, error) => ({ ok: false, refusal: input === undefined ? { error, code } : { error, code, input } });

/**
 * Check raw inputs against an operation.
 * @param {object} op       a loaded operation (its inputs, group and name)
 * @param {*} raw           the query object, the command's flags, or the JSON body
 * @param {'query'|'cli'|'body'} source
 * @returns {{ ok: true, inputs: object } | { ok: false, refusal: { error: string, code: string, input?: string } }}
 */
function checkInputs(op, raw, source) {
  if (raw === undefined || raw === null) raw = {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return refuse('invalid-body', undefined, `The body must be a JSON object of ${op.group} ${op.name}'s inputs.`);
  }
  const data = JSON.parse(JSON.stringify(raw));
  const validate = source === 'body' ? checkersFor(op).body : checkersFor(op).text;
  if (validate(data)) return { ok: true, inputs: data };

  const errors = validate.errors || [];
  const names = Object.keys(op.inputs || {});
  const unknown = errors.find((e) => e.keyword === 'additionalProperties' && e.instancePath === '');
  if (unknown) {
    const input = unknown.params.additionalProperty;
    return refuse('unknown-input', input,
      `'${input}' is not an input of ${op.group} ${op.name}. ${names.length ? `Its inputs: ${names.join(', ')}.` : 'It takes no inputs.'}`);
  }
  const missing = errors.find((e) => e.keyword === 'required' && e.instancePath === '');
  if (missing) {
    const input = missing.params.missingProperty;
    return refuse('missing-input', input, `'${input}' is required by ${op.group} ${op.name}.`);
  }
  const first = errors[0] || {};
  const input = String(first.instancePath || '').split('/')[1] || names[0];
  return refuse('invalid-input', input, `'${input}' ${first.message || 'is not valid'}.`);
}

module.exports = { checkInputs, inputsSchema };
