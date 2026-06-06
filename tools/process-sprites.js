#!/usr/bin/env node
/**
 * process-sprites.js — Monarium sprite background-removal pipeline
 * ─────────────────────────────────────────────────────────────────
 *
 * Reads raw extracted PNG frames from:
 *   assets/raw/<character>/<animation>/
 *
 * Outputs transparent PNGs (original canvas size preserved) to:
 *   public/assets/characters/<character>/<animation>/
 *
 * Raw source files are never modified.
 *
 * ── Quick start ──────────────────────────────────────────────────
 *
 *   npm run process:sprites
 *
 *   # Single character only
 *   npm run process:sprites -- --character flarepaw
 *
 *   # Single animation folder only
 *   npm run process:sprites -- --character flarepaw --animation attack
 *
 *   # Preview what would run without writing any files
 *   npm run process:sprites -- --dry-run
 *
 *   # Loosen threshold (useful for off-white or cream backgrounds)
 *   npm run process:sprites -- --threshold 220
 *
 *   # Wider soft-edge fade zone around the background boundary
 *   npm run process:sprites -- --threshold 235 --feather 25
 *
 *   # Simple per-pixel cutoff instead of flood-fill (faster, less safe)
 *   npm run process:sprites -- --mode threshold
 *
 * ── Options ──────────────────────────────────────────────────────
 *
 *   --threshold N      Background whiteness cutoff 0–255.
 *                      Pixels where R, G, and B are all >= N are treated as
 *                      background. Lower = more aggressive removal.
 *                      Default: 240
 *
 *   --feather N        Soft-edge fade width (pixels). Pixels between
 *                      (threshold - feather) and threshold receive partial
 *                      transparency for smoother sprite edges.
 *                      Default: 15. Set to 0 for a hard cut.
 *
 *   --mode MODE        'flood-fill' (default) — only removes background that
 *                      is reachable from the image border. Interior white
 *                      markings (eyes, highlights, fur) are preserved.
 *                      'threshold' — removes ALL near-white pixels anywhere
 *                      in the frame. Faster but can punch holes in sprites.
 *
 *   --character NAME   Process only this character folder (default: all).
 *
 *   --animation NAME   Process only this animation folder (default: all).
 *
 *   --dry-run          Print the file mapping without writing anything.
 *
 *   --help             Show this help message.
 *
 * ── Directory layout ─────────────────────────────────────────────
 *
 *   assets/
 *     raw/
 *       flarepaw/
 *         attack/
 *           frame_054.png    ← raw frame with white background
 *           frame_055.png
 *         idle/
 *           idle_000.png
 *   public/
 *     assets/
 *       characters/
 *         flarepaw/
 *           attack/
 *             frame_054.png  ← transparent output (same canvas size)
 *             frame_055.png
 *           idle/
 *             idle_000.png
 *
 * ── Notes ─────────────────────────────────────────────────────────
 *
 *   - Canvas size is preserved exactly. No cropping or resizing is done.
 *     Consistent baseline across frames is more important than tight crops.
 *   - Filenames are preserved verbatim.
 *   - Frames within each folder are processed in ascending numeric order,
 *     so skipped numbers (frame_054, frame_056, frame_058) are fine.
 *   - Output PNGs use maximum compression (PNG level 9) for smaller files.
 *   - Requires: sharp  (npm install — already in devDependencies)
 */

'use strict';

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

// ── Paths (relative to repo root) ─────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '..');
const RAW_BASE  = path.join(REPO_ROOT, 'assets', 'raw');
const OUT_BASE  = path.join(REPO_ROOT, 'public', 'assets', 'characters');

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULTS = {
  threshold: 240,      // R, G, B all >= threshold → background
  feather:    15,      // fade zone width below threshold
  mode:  'flood-fill', // or 'threshold'
};

// ── Argument parser ────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    threshold:  DEFAULTS.threshold,
    feather:    DEFAULTS.feather,
    mode:       DEFAULTS.mode,
    character:  null,
    animation:  null,
    dryRun:     false,
    help:       false,
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--threshold':  args.threshold = parseInt(argv[++i], 10); break;
      case '--feather':    args.feather   = parseInt(argv[++i], 10); break;
      case '--mode':       args.mode      = argv[++i];               break;
      case '--character':  args.character = argv[++i];               break;
      case '--animation':  args.animation = argv[++i];               break;
      case '--dry-run':    args.dryRun    = true;                    break;
      case '--help':
      case '-h':           args.help      = true;                    break;
      default:
        console.warn(`Unknown option: ${argv[i]}`);
    }
  }

  if (!['flood-fill', 'threshold'].includes(args.mode)) {
    console.error(`Invalid --mode "${args.mode}". Use "flood-fill" or "threshold".`);
    process.exit(1);
  }

  return args;
}

// ── File discovery ─────────────────────────────────────────────────────────────

function findPngFiles(baseDir, charFilter, animFilter) {
  const results = [];

  if (!fs.existsSync(baseDir)) {
    return results;
  }

  const chars = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && (!charFilter || d.name === charFilter))
    .map(d => d.name);

  for (const character of chars) {
    const charDir = path.join(baseDir, character);

    const anims = fs.readdirSync(charDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && (!animFilter || d.name === animFilter))
      .map(d => d.name);

    for (const animation of anims) {
      const animDir = path.join(charDir, animation);

      const pngs = fs.readdirSync(animDir)
        .filter(f => f.toLowerCase().endsWith('.png'))
        .sort((a, b) => {
          // Sort by the first run of digits in the filename so that
          // frame_054 < frame_055 < frame_058 even with gaps.
          const na = parseInt(a.match(/\d+/)?.[0] ?? '0', 10);
          const nb = parseInt(b.match(/\d+/)?.[0] ?? '0', 10);
          return na !== nb ? na - nb : a.localeCompare(b);
        });

      for (const filename of pngs) {
        results.push({
          character,
          animation,
          filename,
          inputPath:  path.join(animDir, filename),
          outputPath: path.join(OUT_BASE, character, animation, filename),
        });
      }
    }
  }

  return results;
}

// ── Background removal — flood fill from image edges ─────────────────────────
//
// Only background pixels reachable from the image border are made transparent.
// Interior white/near-white areas (eyes, highlights, fur) are left intact.

function floodFillRemove(buf, width, height, threshold, feather) {
  const total   = width * height;
  const visited = new Uint8Array(total);

  // Returns true if a pixel at byte offset `bi` is within the background range.
  const isBackground = (bi) => {
    const r = buf[bi], g = buf[bi + 1], b = buf[bi + 2];
    return r >= (threshold - feather) && g >= (threshold - feather) && b >= (threshold - feather);
  };

  // Compute output alpha for a background pixel: 0 if all channels >= threshold,
  // feathered partial alpha if within the fade zone.
  const alphaFor = (bi) => {
    const r = buf[bi], g = buf[bi + 1], b = buf[bi + 2];
    const lo  = threshold - feather;
    const min = Math.min(r, g, b);
    if (min >= threshold) return 0;
    if (feather > 0 && min >= lo) {
      return Math.round(255 * (1 - (min - lo) / feather));
    }
    return 0;
  };

  // Collect all border pixels that qualify as background.
  const queue = [];

  const enqueue = (px, py) => {
    const pidx = py * width + px;
    if (visited[pidx]) return;
    const bi = pidx * 4;
    if (!isBackground(bi)) return;
    visited[pidx] = 1;
    queue.push(pidx);
  };

  for (let x = 0; x < width;  x++) { enqueue(x, 0); enqueue(x, height - 1); }
  for (let y = 1; y < height - 1; y++) { enqueue(0, y); enqueue(width - 1, y); }

  // BFS — use index-based head pointer to avoid expensive Array.shift()
  let head = 0;
  while (head < queue.length) {
    const pidx = queue[head++];
    const bi   = pidx * 4;
    buf[bi + 3] = alphaFor(bi);

    const px = pidx % width;
    const py = (pidx - px) / width;

    if (px > 0)          enqueue(px - 1, py);
    if (px < width - 1)  enqueue(px + 1, py);
    if (py > 0)          enqueue(px, py - 1);
    if (py < height - 1) enqueue(px, py + 1);
  }

  return buf;
}

// ── Background removal — simple per-pixel threshold ───────────────────────────
//
// Removes ALL near-white pixels regardless of position.
// Faster than flood fill but can punch holes in white interior markings.

function thresholdRemove(buf, threshold, feather) {
  const lo = threshold - feather;
  for (let i = 0; i < buf.length; i += 4) {
    const min = Math.min(buf[i], buf[i + 1], buf[i + 2]);
    if (min >= threshold) {
      buf[i + 3] = 0;
    } else if (feather > 0 && min >= lo) {
      buf[i + 3] = Math.round(255 * (1 - (min - lo) / feather));
    }
  }
  return buf;
}

// ── Process a single PNG file ──────────────────────────────────────────────────

async function processFile(file, args) {
  const { data, info } = await sharp(file.inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buf = new Uint8Array(data.buffer);

  if (args.mode === 'threshold') {
    thresholdRemove(buf, args.threshold, args.feather);
  } else {
    floodFillRemove(buf, info.width, info.height, args.threshold, args.feather);
  }

  fs.mkdirSync(path.dirname(file.outputPath), { recursive: true });

  await sharp(Buffer.from(buf.buffer), {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .png({ compressionLevel: 9 })
    .toFile(file.outputPath);
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    // Re-print the top-of-file usage block by reading ourselves
    const self = fs.readFileSync(__filename, 'utf8');
    const docMatch = self.match(/^\/\*\*([\s\S]*?)\*\//);
    if (docMatch) console.log(docMatch[0]);
    process.exit(0);
  }

  const files = findPngFiles(RAW_BASE, args.character, args.animation);

  if (files.length === 0) {
    console.warn(`\nNo PNG files found under: ${path.relative(REPO_ROOT, RAW_BASE)}`);
    if (args.character) console.warn(`  --character "${args.character}"`);
    if (args.animation) console.warn(`  --animation "${args.animation}"`);
    console.warn('\nExpected layout:  assets/raw/<character>/<animation>/*.png');
    process.exit(0);
  }

  const modeLabel = args.mode === 'flood-fill'
    ? 'flood-fill (edge-connected, safe for interior white)'
    : 'threshold  (all near-white pixels, fast)';

  console.log('\nMonarium sprite processor');
  console.log(`  mode:       ${modeLabel}`);
  console.log(`  threshold:  ${args.threshold}  (R,G,B all >= ${args.threshold} → background)`);
  console.log(`  feather:    ${args.feather}  (${args.feather === 0 ? 'hard cut' : `fade ${args.feather}px below threshold`})`);
  if (args.dryRun) console.log('  DRY RUN — no files will be written');
  console.log(`  found ${files.length} PNG file(s)\n`);

  let ok = 0, errs = 0;

  for (const file of files) {
    const inRel  = path.relative(REPO_ROOT, file.inputPath);
    const outRel = path.relative(REPO_ROOT, file.outputPath);

    if (args.dryRun) {
      console.log(`  [dry]  ${inRel}`);
      console.log(`      →  ${outRel}`);
      continue;
    }

    try {
      await processFile(file, args);
      console.log(`  ✓  ${inRel}  →  ${outRel}`);
      ok++;
    } catch (err) {
      console.error(`  ✗  ${inRel}  ERROR: ${err.message}`);
      errs++;
    }
  }

  if (!args.dryRun) {
    const summary = errs > 0
      ? `${ok} processed, ${errs} failed.`
      : `${ok} processed.`;
    console.log(`\n${summary}`);
  }

  if (errs > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
