'use strict';
/**
 * The command groups an operation may belong to (design D1; docs/GRAPH_OPERATIONS_CATALOG.md), each with the line that
 * /docs and the command show for it. A new group is a design change, made here.
 *
 * `raw` is refused for now: the catalog makes it owner-only and command-only (catalog §3), and how a declaration says
 * "no route" is that group's first task's to decide (ADR graph-operations-foundation/0001 Decision 1).
 */

const GROUPS = Object.freeze({
  graph: 'The graph itself: reads, and writes that follow the protocol, on concepts, elements, sets, properties, schemas and relationships. Never signs.',
  rules: "The graph's rules: list them, check the graph against them, and repair what breaks them.",
  import: 'Outside data coming in: one importer for each kind of source.',
  export: 'Outside data going out: one exporter for each transport.',
  cache: "What is built from the graph, such as each node's Tapestry JSON in the LMDB: read it, check it and rebuild it.",
  lifecycle: "The instance's lifecycle: backup, restore, firmware, migrations and status.",
});

const REFUSED_GROUPS = Object.freeze({
  raw: 'the raw group is owner-only and command-only (catalog §3), and its first task decides how such an operation is declared',
});

module.exports = { GROUPS, REFUSED_GROUPS };
