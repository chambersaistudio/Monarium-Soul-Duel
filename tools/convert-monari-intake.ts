/**
 * Convert a Monarium intake CSV export to the local batch JSON shape.
 * Usage: npx tsx tools/convert-monari-intake.ts input.csv data/monari-intake/batches/batch_001.json
 * XLSX files should first be exported as CSV; V1 intentionally adds no spreadsheet dependency.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';

const [inputArg, outputArg = 'data/monari-intake/batches/batch_001.json'] = process.argv.slice(2);
if (!inputArg) throw new Error('Provide a CSV input path.');
if (extname(inputArg).toLowerCase() !== '.csv') throw new Error('V1 accepts CSV. Export XLSX to CSV before conversion.');

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"' && quoted && source[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(value); if (row.some(cell => cell.trim())) rows.push(row); row = []; value = '';
    } else value += char;
  }
  row.push(value); if (row.some(cell => cell.trim())) rows.push(row);
  return rows;
}

const rows = parseCsv(readFileSync(resolve(inputArg), 'utf8'));
const headers = rows.shift()?.map(header => header.trim()) ?? [];
const numbers = new Set(['hp','aura','attack','special_attack','defense','special_defense','speed','stage_number','confidence_score']);
const entries = rows.map((cells, index) => Object.fromEntries(headers.map((header, column) => {
  const raw = cells[column]?.trim() ?? '';
  return [header, numbers.has(header) ? Number(raw || 0) : raw];
}))).map((entry, index) => ({
  id: entry.id || `batch001-${String(index + 1).padStart(3, '0')}`,
  status: entry.status || 'incoming',
  updated_at: new Date().toISOString(),
  ...entry,
}));

const batch = {
  id: 'batch_001', name: 'Batch 001', status: 'in_review',
  imported_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  source_filename: basename(inputArg), image_root: '/assets/monari/_incoming/batch_001/', entries,
};
writeFileSync(resolve(outputArg), `${JSON.stringify(batch, null, 2)}\n`);
console.log(`Converted ${entries.length} rows to ${outputArg}`);
