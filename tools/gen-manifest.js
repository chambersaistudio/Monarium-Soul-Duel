#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');

// Optional: node gen-manifest.js [characterName] to update only one entry
const filterEntry = process.argv[2] || null;

const PUBLIC       = path.join(__dirname, '..', 'public', 'assets');
const CHARS_DIR    = path.join(PUBLIC, 'characters');
const MONARI_DIR   = path.join(PUBLIC, 'monari');
const TS_OUT_FILE  = path.join(__dirname, '..', 'src', 'generated', 'characters-manifest.ts');

// Folders inside a character/monari root that are NOT animation frame folders.
// gen-manifest will skip these when scanning for animation clips.
const NON_ANIM_FOLDERS = new Set([
  'reference', 'portraits', 'overworld', 'cutscenes',
]);

// ── Helpers ────────────────────────────────────────────────────────────────────

function numericStem(filename) {
  const m = path.basename(filename, '.png').match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function getFrames(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.png$/i.test(f))
    .sort((a, b) => numericStem(a) - numericStem(b))
    .map(f => path.basename(f, '.png'));
}

/**
 * Scan a character/monari root directory for animation folders.
 *
 * Two layouts are supported:
 *   flat    — animation PNGs live directly inside charDir/{folder}/
 *   wrapped — animation PNGs live inside charDir/battle/{folder}/
 *
 * Both layouts produce the same manifest output (folder name as key).
 * Folders listed in NON_ANIM_FOLDERS are always skipped.
 */
function scanEntry(entryDir) {
  const animations = {};
  const folderBases = {};

  for (const entry of fs.readdirSync(entryDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (NON_ANIM_FOLDERS.has(entry.name)) continue;

    const folderPath = path.join(entryDir, entry.name);

    if (entry.name === 'battle') {
      // battle/ is an organisational wrapper — scan its sub-directories
      for (const sub of fs.readdirSync(folderPath, { withFileTypes: true })) {
        if (!sub.isDirectory()) continue;
        const frames = getFrames(path.join(folderPath, sub.name));
        if (frames.length > 0) { animations[sub.name] = frames; folderBases[sub.name] = `battle/${sub.name}`; }
      }
    } else {
      // Flat animation folder at the character/monari root
      const frames = getFrames(folderPath);
      if (frames.length > 0) { animations[entry.name] = frames; folderBases[entry.name] = entry.name; }
    }
  }

  return { animations, folderBases };
}

// ── Scan directories ───────────────────────────────────────────────────────────

function scanDir(dir, assetBase) {
  const result = {};
  if (!fs.existsSync(dir)) return result;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (filterEntry && entry.name !== filterEntry) continue;

    const entryDir  = path.join(dir, entry.name);
    const { animations, folderBases } = scanEntry(entryDir);
    if (Object.keys(animations).length > 0) {
      result[entry.name] = { base: `${assetBase}/${entry.name}`, animations, folderBases };
    }
  }

  return result;
}

const allChars   = scanDir(CHARS_DIR, 'assets/characters');
const allMonari  = scanDir(MONARI_DIR, 'assets/monari');
const allEntries = { ...allChars, ...allMonari };

if (Object.keys(allEntries).length === 0) {
  console.error('[gen-manifest] No entries with animation folders found.');
  process.exit(1);
}

// ── Write per-entry JSON manifests (runtime use) ───────────────────────────────

function writeRuntimeJson(dir, entryName, animations, folderBases) {
  const jsonOut  = path.join(dir, entryName, 'sprite-manifest.json');
  const jsonData = {
    character: entryName,
    generated: new Date().toISOString().slice(0, 10),
    animations,
    folderBases,
  };
  fs.writeFileSync(jsonOut, JSON.stringify(jsonData, null, 2) + '\n');
  console.log(`[gen-manifest] → ${jsonOut}`);
}

for (const [name, { animations, folderBases }] of Object.entries(allChars)) {
  writeRuntimeJson(CHARS_DIR, name, animations, folderBases);
}
for (const [name, { animations, folderBases }] of Object.entries(allMonari)) {
  writeRuntimeJson(MONARI_DIR, name, animations, folderBases);
}

// ── Write unified TypeScript manifest (compile-time import) ───────────────────

const tsDir = path.dirname(TS_OUT_FILE);
if (!fs.existsSync(tsDir)) fs.mkdirSync(tsDir, { recursive: true });

const charBlocks = Object.entries(allEntries).map(([name, { base, animations, folderBases }]) => {
  const animLines = Object.entries(animations).map(
    ([folder, stems]) => `      ${folder}: [${stems.map(s => `'${s}'`).join(', ')}],`,
  );
  const folderBaseLines = Object.entries(folderBases).map(
    ([folder, folderBase]) => `      ${folder}: '${folderBase}',`,
  );
  return [
    `  ${name}: {`,
    `    base: '${base}',`,
    `    folderBases: {`,
    ...folderBaseLines,
    `    },`,
    `    animations: {`,
    ...animLines,
    `    },`,
    `  },`,
  ].join('\n');
});

const tsContent = [
  '// AUTO-GENERATED by tools/gen-manifest.js — do not edit by hand',
  '// npm run gen:manifest',
  '',
  'export interface CharacterManifest {',
  '  base: string;',
  '  folderBases?: Record<string, string>;',
  '  animations: Record<string, readonly string[]>;',
  '}',
  '',
  'export const CHARACTERS_MANIFEST: Record<string, CharacterManifest> = {',
  ...charBlocks,
  '};',
  '',
].join('\n');

fs.writeFileSync(TS_OUT_FILE, tsContent);
console.log(`[gen-manifest] → ${TS_OUT_FILE}`);
console.log('');

// ── Console summary ────────────────────────────────────────────────────────────

for (const [name, { base, animations }] of Object.entries(allEntries)) {
  const total = Object.values(animations).reduce((n, f) => n + f.length, 0);
  console.log(`${name}  (${total} frames)  base: ${base}`);
  for (const [folder, stems] of Object.entries(animations)) {
    console.log(`  ${folder}: ${stems.length}f  [${stems.join(', ')}]`);
  }
}
