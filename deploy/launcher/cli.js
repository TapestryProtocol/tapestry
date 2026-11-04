#!/usr/bin/env node
'use strict';
// Run through `docker exec edge-launcher node cli.js <command>`, by the publish workflow, the reap timer, or a person.
const http = require('node:http');

const SOCKET = process.env.LAUNCHER_CONTROL_SOCKET || '/run/launcher/control.sock';
const USAGE = 'usage: node cli.js roll [tag] | reap | reconcile | list';

const [command, arg] = process.argv.slice(2);
const requests = {
  roll: ['POST', `/roll?tag=${encodeURIComponent(arg || 'dogfood')}`],
  reap: ['POST', '/reap'],
  reconcile: ['POST', '/reconcile'],
  list: ['GET', '/list'],
};

function finish(result) {
  if (result.brains) {
    for (const b of result.brains) {
      console.log([b.slug, b.status, b.ownerLabel, b.url].join('  '));
    }
  }
  if (result.reaped) console.log(result.reaped.length ? `reaped: ${result.reaped.join(', ')}` : 'nothing to reap');
  if (result.failed) console.log(`stopped: ${result.failed} did not come back`);
  if (result.error) console.log(`error: ${result.error}`);
  process.exitCode = result.ok ? 0 : 1;
}

if (!requests[command]) {
  console.log(USAGE);
  process.exitCode = 2;
} else {
  const [method, path] = requests[command];
  // Only a result that says ok turns this to 0, so a launcher that dies partway never reads as success.
  process.exitCode = 1;
  const req = http.request({ socketPath: SOCKET, method, path }, (res) => {
    // Every line is progress except the last, which is the result as JSON.
    let partial = '';
    let held = null;
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      partial += chunk;
      const lines = partial.split('\n');
      partial = lines.pop();
      for (const line of lines) {
        if (held !== null) console.log(held);
        held = line;
      }
    });
    res.on('end', () => {
      try {
        finish(JSON.parse(held));
      } catch {
        console.log(`error: the launcher gave an answer that cannot be read: ${held}`);
        process.exitCode = 1;
      }
    });
    res.on('error', (err) => {
      if (held !== null) console.log(held);
      console.log(`error: the launcher dropped the connection: ${err.message}`);
    });
  });
  req.on('error', (err) => {
    console.log(`error: cannot reach the launcher at ${SOCKET}: ${err.message}`);
    process.exitCode = 1;
  });
  req.end();
}
