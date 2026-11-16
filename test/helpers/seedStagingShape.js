'use strict';
/**
 * Seed a scratch Tapestry container to staging's shape (graph-operations-foundation #8), so Pass 3 can be measured
 * where it stalled. Staging on 2026-11-15 (count store): 3,851,736 nodes, all TapestryNode with a tapestryKey;
 * 3,107,258 NostrUser; 370,377 SetOfNostrUserWotMetricsCards (each also labelled Set) and as many
 * NostrUserWotMetricsCard; the setup indexes of setup/neo4jConstraintsAndIndexes.sh; and the rule tapestry_key online.
 *
 * Adds 3,107,258 keyed NostrUser nodes. The first 370,377 each own one keyed Set:SetOfNostrUserWotMetricsCards (by
 * WOT_METRICS_CARDS) holding one keyed NostrUserWotMetricsCard (by SPECIFIC_INSTANCE), as the trust pipeline's
 * src/cns/addSetsOfMetricsCards.sh and addMetricsCards.sh make them. None of them has a uuid or an id.
 *
 *   TAPESTRY_CONTAINER=tapestry-scratch node test/helpers/seedStagingShape.js
 *
 * Scratch containers only (the name must start with tapestry-scratch). About 2.5 minutes on the Mac Studio. A graph
 * that already holds 370,000 card sets is left as it is. Batches stay inside the scratch stack's 512 MB transaction
 * limit (BRAINSTORM_NEO4J_TX_MAX_MB in scripts/scratch-stack.sh).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { assertScratch, cypher, sh } = require('./scratchLoopback');

const ROOT = path.resolve(__dirname, '../..');
const USERS = 3107258;
const CARD_SETS = 370377;

function cypherShell(statement, params = {}, input) {
  const c = assertScratch();
  const password = sh("sed -n 's/^export NEO4J_PASSWORD=//p' /etc/brainstorm.conf | tr -d '\"'").trim();
  const args = ['exec', '-i', c, 'cypher-shell', '-a', 'bolt://localhost:7687', '-u', 'neo4j', '-p', password, '--format', 'plain'];
  for (const [k, v] of Object.entries(params)) args.push('--param', `${k} => ${JSON.stringify(v)}`);
  if (statement) args.push(statement);
  return execFileSync('docker', args, { input: input || '', encoding: 'utf8', maxBuffer: 64 << 20, timeout: 600000 });
}

function seed() {
  const t0 = Date.now();
  const have = Number(cypher('MATCH (n:SetOfNostrUserWotMetricsCards) RETURN count(n) AS c')[0].c);
  if (have >= 370000) { console.log(`[seed] already seeded: ${have} card sets`); return; }

  // Staging's setup constraints and indexes (the CYPHER_COMMAND of setup/neo4jConstraintsAndIndexes.sh).
  const setup = fs.readFileSync(path.join(ROOT, 'setup/neo4jConstraintsAndIndexes.sh'), 'utf8');
  const block = setup.split('CYPHER_COMMAND="')[1].split('\n"')[0];
  cypherShell(null, {}, block.split('\n').filter((l) => /^CREATE /.test(l)).join('\n'));

  const batch = (from, to) => cypherShell(
    `UNWIND range($from, $to) AS g
     CREATE (u:NostrUser:TapestryNode {pubkey: replace(randomUUID(),'-','') + replace(randomUUID(),'-',''), tapestryKey: randomUUID(), hops: 999})
     WITH u, g WHERE g < $sets
     CREATE (u)-[:WOT_METRICS_CARDS]->(s:Set:SetOfNostrUserWotMetricsCards:TapestryNode {observee_pubkey: u.pubkey, tapestryKey: randomUUID()})
     CREATE (s)-[:SPECIFIC_INSTANCE]->(:NostrUserWotMetricsCard:TapestryNode {observer_pubkey: 'seed-observer', observee_pubkey: u.pubkey, customer_id: 0, tapestryKey: randomUUID()})
     RETURN count(*) AS n`,
    { from, to, sets: CARD_SETS });
  for (let from = 0; from < CARD_SETS; from += 10000) batch(from, Math.min(from + 9999, CARD_SETS - 1));
  console.log(`[seed] ${CARD_SETS} card-set owners, sets and cards (${Math.round((Date.now() - t0) / 1000)}s)`);
  for (let from = CARD_SETS; from < USERS; from += 50000) batch(from, Math.min(from + 49999, USERS - 1));
  console.log(`[seed] ${USERS} users in all (${Math.round((Date.now() - t0) / 1000)}s)`);

  // The rule tapestry-keys adds (src/operations/catalog/lifecycle/_migrations.js), online as on staging.
  cypherShell('CREATE CONSTRAINT tapestry_key IF NOT EXISTS FOR (n:TapestryNode) REQUIRE n.tapestryKey IS UNIQUE');
  cypherShell('CALL db.awaitIndexes(600)');
  console.log(`[seed] done in ${Math.round((Date.now() - t0) / 1000)}s`);
}

if (require.main === module) {
  try { seed(); } catch (e) { console.error(`[seed] ${e.message}`); process.exitCode = 1; }
}

module.exports = { seed, USERS, CARD_SETS };
