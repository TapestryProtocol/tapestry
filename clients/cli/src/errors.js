'use strict';
/**
 * How a run ends badly, each with its exit code (src/commands.js): Usage 2, Refused 1, Failed 3. A Refused or Failed
 * may carry the instance's own JSON answer, which is printed on stdout as it came.
 */

class CliError extends Error {
  constructor(message, exit, body) {
    super(message);
    this.exit = exit;
    this.body = body;
  }
}
class Usage extends CliError { constructor(message) { super(message, 2); } }
/** Nothing set up yet (no key, or no instance): `tapestry help` then shows how to set up, rather than failing. */
class Setup extends Usage {}
class Refused extends CliError { constructor(message, body) { super(message, 1, body); } }
class Failed extends CliError { constructor(message, body) { super(message, 3, body); } }

/** The instance's own words for a refusal or a failure. */
function messageOf(json) {
  if (!json || typeof json !== 'object') return String(json);
  return json.message || json.error || JSON.stringify(json);
}

module.exports = { CliError, Usage, Setup, Refused, Failed, messageOf };
