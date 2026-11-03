/**
 * POST /api/neo4j/query — Run a Cypher query via POST body.
 *
 * Now uses the Neo4j Bolt driver instead of shelling out to cypher-shell.
 *
 * Request body: { "cypher": "<cypher string>", "params": { ... } }
 * Response:     { "success": true, "data": [...rows...] }
 *
 * For backward compatibility, also returns "cypherResults" as a simplified
 * CSV-like string (header + rows). New callers should use "data" instead.
 */

const { runCypher, explainCypher, writeCypher } = require('../../lib/neo4j-driver');
const { isOwner } = require('../../middleware/auth');

// Detect write operations that require WRITE access mode
const WRITE_KEYWORDS = /\b(CREATE|MERGE|DELETE|SET|REMOVE|DETACH|DROP|CALL\s*\{)\b/i;

// What a public read may contain beyond plain graph reads (security-auth-exposure #12). Read mode
// already stops writes; these stop the reads that reach outside the graph: LOAD CSV and procedures
// such as apoc.load.* fetch URLs from inside the container, where a loopback request counts as the
// trusted local operator; dbms.* procedures and most SHOW commands expose the server's setup.
// Administrative commands (TERMINATE TRANSACTIONS, SHOW USERS, …) are refused too: they act on the
// server, not the graph. Kept to what the UI sends (useNeo4jLabels, the Dashboard's schema panels).
const PUBLIC_PROCEDURES = new Set(['db.labels', 'db.relationshipTypes', 'db.propertyKeys']);
const PUBLIC_SHOW_OPERATORS = new Set(['ShowConstraints', 'ShowIndexes']);
// Operator families that act on the server rather than read the graph.
const ADMIN_OPERATORS = /^(Show|Terminate|Administration|Create|Drop|Alter|Grant|Deny|Revoke|Start|Stop|Enable|Rename|Assert|Ensure|Transaction)/;
// A subquery inside an expression (COLLECT { … } in a list comprehension or CASE) isn't planned as
// steps of its own: its calls and loads appear only as text in the parent step's arguments.
const NESTED_REACH = /ResolvedCall\(|\bLOAD\s+CSV\b/i;

/**
 * Walk a query plan and return why a public caller may not run it, or null if it's a plain read.
 * Judged on the plan rather than the query text, so backticks and comments can't hide a call; every
 * step's argument text is read too, for the calls a nested subquery expression carries inline.
 */
function publicPlanRefusal(plan) {
    if (!plan || typeof plan !== 'object') return 'a query Neo4j returned no plan for';
    const stack = [plan];
    while (stack.length) {
        const node = stack.pop();
        if (!node) continue;
        const [opType, database] = String(node.operatorType || '').split('@');
        if (database === 'system') return `${opType} on the system database`;
        if (opType === 'LoadCSV') return 'LOAD CSV';
        if (/ProcedureCall$/.test(opType)) {
            const details = String((node.arguments && node.arguments.Details) || '');
            const name = details.split('(')[0].trim();
            if (!PUBLIC_PROCEDURES.has(name)) return `procedure ${name || '(unknown)'}`;
        } else if (ADMIN_OPERATORS.test(opType) && !PUBLIC_SHOW_OPERATORS.has(opType)) {
            return opType;
        }
        for (const value of Object.values(node.arguments || {})) {
            const text = String(value);
            if (NESTED_REACH.test(text)) return 'a procedure call or LOAD CSV nested in an expression';
        }
        stack.push(...(node.children || []));
    }
    return null;
}

async function queryPost(req, res) {
    const cypherCommand = (req.body && req.body.cypher) || '';
    const params = (req.body && req.body.params) || {};

    if (!cypherCommand.trim()) {
        return res.status(400).json({ success: false, error: 'Missing "cypher" in request body' });
    }

    try {
        const isWrite = WRITE_KEYWORDS.test(cypherCommand);

        // Write Cypher (CREATE/MERGE/DELETE/SET/…) mutates the graph, so it is
        // owner-only. Reads stay open — this endpoint is the read backbone of the
        // browsing UI. A genuinely-local request (req.localTrusted, stamped by the
        // auth middleware for the in-process bridge and direct-local operator) is
        // authorized too. (ADR security-auth-exposure/0001.)
        const isPublic = !isOwner(req) && !req.localTrusted;
        if (isWrite && isPublic) {
            return res.status(403).json({ success: false, error: 'Write queries require owner authentication' });
        }

        // A public read must be a plain read of the graph: plan it first, and refuse anything that
        // reaches outside it (security-auth-exposure #12).
        if (isPublic) {
            const refusal = publicPlanRefusal(await explainCypher(cypherCommand, params));
            if (refusal) {
                return res.status(403).json({ success: false, error: `Public queries may only read the graph (${refusal} requires owner authentication)` });
            }
        }

        const rows = isWrite
            ? await writeCypher(cypherCommand, params)
            : await runCypher(cypherCommand, params);

        // Build backward-compatible cypherResults string
        let cypherResults = '';
        if (rows.length > 0) {
            const keys = Object.keys(rows[0]);
            cypherResults = keys.join(',') + '\n';
            for (const row of rows) {
                cypherResults += keys.map(k => {
                    const v = row[k];
                    if (v === null || v === undefined) return 'NULL';
                    if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`;  // CSV-escape quotes
                    if (Array.isArray(v)) return JSON.stringify(v);
                    return String(v);
                }).join(',') + '\n';
            }
        }

        res.json({ success: true, data: rows, cypherResults });
    } catch (err) {
        console.error('Neo4j query error:', err.message);
        res.json({ success: false, error: err.message, cypherResults: '' });
    }
}

module.exports = { queryPost };
