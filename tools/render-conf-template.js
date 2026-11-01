#!/usr/bin/env node
/**
 * Render a config template to stdout by substituting ${VAR_NAME} against process.env.
 * Story #16 / ADR 0014.
 *
 * Usage:  node tools/render-conf-template.js <template-path>
 * Output: substituted template on stdout. Exit 0 on success.
 * Errors:
 *   - Exit 1 + stderr message on missing argv, file-read failure.
 *   - Exit 2 + stderr message on unknown ${VAR} references (one or more env vars
 *     referenced in the template but undefined in process.env).
 *   - Exit 3 + stderr message when a referenced value holds a character the conf
 *     can't hold safely between double quotes (" $ ` \ or a line break): bash
 *     would end the string, expand it, or run a command from it (ADR
 *     security-auth-exposure/0006). The message names variables, never values,
 *     and nothing is written to stdout.
 *
 * Substitution rules: ${VAR_NAME} only.
 *   - Bare $VAR (no braces) is LEFT AS LITERAL.
 *   - $(cmd) is LEFT AS LITERAL — this renderer is NOT a shell evaluator.
 *   - `cmd` (backticks) is LEFT AS LITERAL.
 *   - ${VAR:-default} is LEFT AS LITERAL (future enhancement if operator need surfaces).
 *
 * The narrow substitution surface is deliberate: the brainstorm.conf template
 * has plain ${VAR_NAME} references and nothing else (verified at ADR 0014 time).
 * Adopting shell-power here would open an injection class for repo-controlled
 * content without any current need.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const templatePath = process.argv[2];
if (!templatePath) {
  console.error('Usage: render-conf-template.js <template-path>');
  process.exit(1);
}

let content;
try {
  content = fs.readFileSync(templatePath, 'utf8');
} catch (e) {
  console.error('Failed to read template ' + templatePath + ': ' + e.message);
  process.exit(1);
}

const VAR_REF = /\$\{([A-Z_][A-Z0-9_]*)\}/g;
const UNSAFE_IN_DOUBLE_QUOTES = /["$`\\\r\n]/;
const missing = [];
const unsafe = [];
const rendered = content.replace(VAR_REF, function (_match, name) {
  if (Object.prototype.hasOwnProperty.call(process.env, name)) {
    if (UNSAFE_IN_DOUBLE_QUOTES.test(process.env[name])) unsafe.push(name);
    return process.env[name];
  }
  missing.push(name);
  return '';
});

if (missing.length) {
  const unique = Array.from(new Set(missing));
  console.error(
    'RenderError: missing env vars in ' + path.basename(templatePath) + ': ' + unique.join(', ')
  );
  process.exit(2);
}

if (unsafe.length) {
  const names = Array.from(new Set(unsafe)).sort();
  console.error(
    'RenderError: ' + names.join(', ') + ' contain' + (names.length === 1 ? 's' : '') +
    ' a character the config file can\'t hold safely (" $ ` \\ or a line break); refusing to render'
  );
  process.exit(3);
}

process.stdout.write(rendered);
