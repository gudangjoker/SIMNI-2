import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const rules = JSON.parse(await readFile('firebase/database.rules.production.json', 'utf8')).rules;
assert.equal(rules.auditLogs.$workspaceId.$operationId['.write'], false);
assert.equal(rules.administrativeOperations['.read'], false);
assert.equal(rules.administrativeOperations['.write'], false);
console.log('PASS Client cannot author receipts or access private operation reservations');
// Exercise the real server engine, including unknown commit and receipt recovery.
await import('./admin-operations-regression.mjs');
// Actual data/schema permissions are additionally checked in tahap7-rules-emulator.
