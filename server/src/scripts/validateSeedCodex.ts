import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { normalizeCodexNo } from '../intakeData.js';

type BatchEntry = Record<string, unknown>;

const defaultSeedFiles = [
  'seed/batch_001.json',
  '../data/monari-intake/batches/batch_001.json',
];

const seedFiles = process.argv.slice(2).length ? process.argv.slice(2) : defaultSeedFiles;

function entryLabel(entry: BatchEntry, index: number): string {
  return String(entry.entry_key ?? entry.intake_id ?? entry.id ?? `entry_${index + 1}`);
}

function invalidCodexValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  const normalized = normalizeCodexNo(value);
  if (normalized !== null) return false;
  if (typeof value === 'number') return value <= 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return false;
    const numeric = Number(trimmed.replace(/^#\s*/, ''));
    return Number.isFinite(numeric) && numeric <= 0;
  }
  return false;
}

assert.equal(normalizeCodexNo(0), null);
assert.equal(normalizeCodexNo('0'), null);
assert.equal(normalizeCodexNo(''), null);
assert.equal(normalizeCodexNo(null), null);
assert.equal(normalizeCodexNo('#001'), 1);
assert.equal(normalizeCodexNo('001'), 1);
assert.equal(normalizeCodexNo(1), 1);

for (const seedFile of seedFiles) {
  const filename = resolve(process.cwd(), seedFile);
  const payload = JSON.parse(await readFile(filename, 'utf8')) as Record<string, unknown>;
  const entries = Array.isArray(payload.entries) ? payload.entries as BatchEntry[] : [];
  const invalidEntries: string[] = [];

  entries.forEach((entry, index) => {
    for (const field of ['codex_no', 'codexNumber']) {
      if (invalidCodexValue(entry[field])) invalidEntries.push(`${entryLabel(entry, index)} ${field}=${String(entry[field])}`);
    }
  });

  if (invalidEntries.length) {
    throw new Error(`Invalid codex numbers in ${seedFile}: ${invalidEntries.join(', ')}`);
  }

  console.log(`Validated ${entries.length} entries in ${seedFile}.`);
}
