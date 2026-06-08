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
 *   # Preview without writing files
 *   npm run process:sprites -- --dry-run
 *
 *   # Recommended command for Flarepaw (run/guard/flame_guard/attack cleanup)
 *   npm run process:sprites -- --character flarepaw --threshold 220 --feather 25 --island-max-area 600 --defringe --defringe-strength 2
 *
 * ── Core options ─────────────────────────────────────────────────
 *
 *   --threshold N      Background whiteness cutoff 0–255.
 *                      Pixels where R, G, and B are all >= N are background.
 *                      Lower = more aggressive. Default: 240
 *
 *   --feather N        Soft-edge fade width (pixels). Pixels between
 *                      (threshold - feather) and threshold receive partial
 *                      transparency for smoother edges.
 *                      Default: 15. Set to 0 for a hard cut.
 *
 *   --mode MODE        'flood-fill' (default) — only removes background
 *                      reachable from the image border. Interior white
 *                      markings (eyes, highlights, fur) are preserved.
 *                      'threshold' — removes ALL near-white pixels.
 *                      Faster but can punch holes in white interior areas.
 *
 * ── Island / pocket cleanup ──────────────────────────────────────
 *
 *   Runs after the main flood-fill pass. Finds connected regions of
 *   near-white opaque pixels that were NOT reached from the image border
 *   (enclosed pockets: gaps between legs, inside bent arms, etc.) and
 *   removes small ones. Larger white regions — fur, teeth, eye whites —
 *   survive because their area exceeds --island-max-area.
 *
 *   --no-islands         Disable island cleanup (it is ON by default).
 *
 *   --island-max-area N  Connected near-white component larger than N pixels
 *                        is kept (assumed to be intentional white detail).
 *                        Default: 600. Tune up if a real white feature is
 *                        being removed; tune down to catch larger pockets.
 *
 *   --island-threshold N Whiteness floor for island detection.
 *                        Default: (threshold - 20). Pixels with all channels
 *                        below this are NOT considered near-white pockets.
 *
 * ── Edge defringe / halo cleanup ─────────────────────────────────
 *
 *   After all other passes, reduces alpha of opaque pixels at the sprite
 *   boundary that are suspiciously white/bright (anti-aliased background
 *   bleed). Only pixels directly adjacent to a transparent pixel are
 *   affected. Sprite interior pixels are untouched.
 *
 *   --defringe             Enable defringe (OFF by default).
 *
 *   --defringe-strength N  1 = light fade (30%), 2 = medium (65%),
 *                          3 = aggressive (full removal of fringe whites).
 *                          Default: 1
 *
 *   --defringe-passes N    How many times to apply the defringe sweep.
 *                          More passes eat further into the fringe.
 *                          Default: 2
 *
 *   --defringe-threshold N Pixels with min(R,G,B) below this are not
 *                          considered fringe. Default: (threshold - 40),
 *                          minimum 160.
 *
 * ── Other options ────────────────────────────────────────────────
 *
 *   --character NAME   Process only this character folder (default: all).
 *   --animation NAME   Process only this animation folder (default: all).
 *   --dry-run          Print what would be processed, write nothing.
 *   --verbose          Log each removed island's size.
 *   --help             Show this message.
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
 *   - Filenames are preserved verbatim.
 *   - Frames sort ascending numerically, so skipped numbers are fine.
 *   - Output PNGs use PNG level 9 compression.
 *   - Requires: sharp  (already in devDependencies — run npm install)
 */

'use strict';

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

// ── Paths ─────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '..');
const RAW_BASE  = path.join(REPO_ROOT, 'assets', 'raw');
const OUT_BASE  = path.join(REPO_ROOT, 'public', 'assets', 'characters');

// ── Argument parser ────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    threshold:         240,
    feather:            15,
    mode:        'flood-fill',
    islands:           true,   // island cleanup ON by default
    islandMaxArea:      600,
    islandThreshold:   null,   // null = derive from threshold at runtime
    defringe:          false,
    defringeStrength:    1,
    defringePasses:      2,
    defringeThreshold: null,   // null = derive from threshold at runtime
    character:         null,
    animation:         null,
    dryRun:            false,
    verbose:           false,
    help:              false,
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--threshold':          args.threshold         = parseInt(argv[++i], 10); break;
      case '--feather':            args.feather           = parseInt(argv[++i], 10); break;
      case '--mode':               args.mode              = argv[++i];               break;
      case '--no-islands':         args.islands           = false;                   break;
      case '--island-max-area':    args.islandMaxArea     = parseInt(argv[++i], 10); break;
      case '--island-threshold':   args.islandThreshold   = parseInt(argv[++i], 10); break;
      case '--defringe':           args.defringe          = true;                    break;
      case '--defringe-strength':  args.defringeStrength  = parseInt(argv[++i], 10); break;
      case '--defringe-passes':    args.defringePasses    = parseInt(argv[++i], 10); break;
      case '--defringe-threshold': args.defringeThreshold = parseInt(argv[++i], 10); break;
      case '--character':          args.character         = argv[++i];               break;
      case '--animation':          args.animation         = argv[++i];               break;
      case '--dry-run':            args.dryRun            = true;                    break;
      case '--verbose':            args.verbose           = true;                    break;
      case '--help': case '-h':    args.help              = true;                    break;
      default: console.warn(`Unknown option: ${argv[i]}`);
    }
  }

  // Derive defaults from threshold if not explicitly set
  if (args.islandThreshold  === null) args.islandThreshold  = Math.max(150, args.threshold - 20);
  if (args.defringeThreshold === null) args.defringeThreshold = Math.max(160, args.threshold - 40);

  if (!['flood-fill', 'threshold'].includes(args.mode)) {
    console.error(`Invalid --mode "${args.mode}". Use "flood-fill" or "threshold".`);
    process.exit(1);
  }

  return args;
}

// ── File discovery ─────────────────────────────────────────────────────────────

function findPngFiles(baseDir, charFilter, animFilter) {
  const results = [];
  if (!fs.existsSync(baseDir)) return results;

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
          const na = parseInt(a.match(/\d+/)?.[0] ?? '0', 10);
          const nb = parseInt(b.match(/\d+/)?.[0] ?? '0', 10);
          return na !== nb ? na - nb : a.localeCompare(b);
        });

      for (const filename of pngs) {
        results.push({
          character, animation, filename,
          inputPath:  path.join(animDir, filename),
          outputPath: path.join(OUT_BASE, character, animation, filename),
        });
      }
    }
  }
  return results;
}

// ── Pass 1: Flood-fill background removal from image edges ────────────────────
//
// Starts from every border pixel that is near-white and expands inward through
// connected near-white pixels. Only edge-reachable background is removed —
// interior white markings (eyes, fur, highlights) remain opaque.

function floodFillRemove(buf, width, height, threshold, feather) {
  const total   = width * height;
  const visited = new Uint8Array(total);

  const lo = threshold - feather;

  const isBackground = (bi) => {
    return buf[bi] >= lo && buf[bi + 1] >= lo && buf[bi + 2] >= lo;
  };

  const alphaFor = (bi) => {
    const min = Math.min(buf[bi], buf[bi + 1], buf[bi + 2]);
    if (min >= threshold) return 0;
    if (feather > 0 && min >= lo) return Math.round(255 * (1 - (min - lo) / feather));
    return 0;
  };

  const queue = [];
  const enqueue = (px, py) => {
    const pidx = py * width + px;
    if (visited[pidx]) return;
    if (!isBackground(pidx * 4)) return;
    visited[pidx] = 1;
    queue.push(pidx);
  };

  for (let x = 0; x < width;       x++) { enqueue(x, 0); enqueue(x, height - 1); }
  for (let y = 1; y < height - 1;  y++) { enqueue(0, y); enqueue(width - 1, y); }

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

// ── Pass 1 (alt): Simple per-pixel threshold removal ─────────────────────────

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

// ── Pass 2: Island / enclosed pocket cleanup ──────────────────────────────────
//
// After edge flood-fill, any near-white opaque pixels that remain are either:
//   (a) intentional white details — eyes, tooth highlights, fur markings
//   (b) enclosed background pockets trapped inside the silhouette
//
// Strategy: find connected components (4-connected) of near-white opaque
// pixels. Remove components whose total pixel area <= islandMaxArea.
// Larger components are assumed to be intentional white features.
//
// Returns { buf, removed, totalPx } for logging.

function removeIslands(buf, width, height, islandThreshold, islandMaxArea, verbose) {
  const total   = width * height;
  // 0 = unchecked near-white, 1 = visited, 2 = dark/transparent (skip)
  const state   = new Uint8Array(total);
  let removed   = 0;
  let totalPx   = 0;

  // Classify pixels
  for (let i = 0; i < total; i++) {
    const bi = i * 4;
    const a  = buf[bi + 3];
    if (a === 0) {
      state[i] = 2; // already transparent
      continue;
    }
    const r = buf[bi], g = buf[bi + 1], b = buf[bi + 2];
    if (r < islandThreshold || g < islandThreshold || b < islandThreshold) {
      state[i] = 2; // colored sprite pixel — not a candidate
    }
    // else: state[i] = 0 (near-white opaque candidate)
  }

  // Find connected components of unchecked near-white pixels (state == 0)
  const queue = [];
  for (let start = 0; start < total; start++) {
    if (state[start] !== 0) continue;

    // BFS to collect this component
    const component = [];
    queue.length = 0;
    queue.push(start);
    state[start] = 1;

    let head = 0;
    while (head < queue.length) {
      const pidx = queue[head++];
      component.push(pidx);

      const px = pidx % width;
      const py = (pidx - px) / width;

      const tryNeighbor = (nx, ny) => {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) return;
        const nidx = ny * width + nx;
        if (state[nidx] !== 0) return;
        state[nidx] = 1;
        queue.push(nidx);
      };

      tryNeighbor(px - 1, py);
      tryNeighbor(px + 1, py);
      tryNeighbor(px, py - 1);
      tryNeighbor(px, py + 1);
    }

    // Remove if small enough to be a pocket
    if (component.length <= islandMaxArea) {
      for (const pidx of component) buf[pidx * 4 + 3] = 0;
      if (verbose) process.stdout.write(`      island removed: ${component.length}px\n`);
      removed++;
      totalPx += component.length;
    }
  }

  return { buf, removed, totalPx };
}

// ── Pass 3: Edge defringe / halo cleanup ──────────────────────────────────────
//
// Reduces alpha of opaque pixels at the sprite boundary that are suspiciously
// bright/white — these are anti-aliased background bleed pixels left after the
// main removal passes.
//
// Algorithm (per pass):
//   1. Build a mask of "edge pixels": opaque pixels with at least one
//      fully-transparent 4-connected neighbour.
//   2. For each edge pixel, compute relative whiteness:
//        w = clamp((min(R,G,B) - defringeThreshold) / (255 - defringeThreshold), 0, 1)
//   3. Reduce alpha: new_alpha = alpha * (1 - w * strength_factor)
//
// Running multiple passes extends the effect one pixel layer at a time.

function defringeEdges(buf, width, height, defringeThreshold, strength, passes) {
  const total = width * height;
  const strengthFactor = strength === 3 ? 1.0 : strength === 2 ? 0.65 : 0.30;
  const range = 255 - defringeThreshold;

  for (let pass = 0; pass < passes; pass++) {
    // Snapshot alpha at start of this pass so we use original values for the
    // edge mask, not values already modified in this pass.
    const alphaSnap = new Uint8Array(total);
    for (let i = 0; i < total; i++) alphaSnap[i] = buf[i * 4 + 3];

    for (let i = 0; i < total; i++) {
      if (alphaSnap[i] === 0) continue;

      const px = i % width;
      const py = (i - px) / width;

      // Check for at least one fully-transparent 4-connected neighbour
      const hasTransparentNeighbour =
        (px > 0          && alphaSnap[i - 1]     === 0) ||
        (px < width - 1  && alphaSnap[i + 1]     === 0) ||
        (py > 0          && alphaSnap[i - width]  === 0) ||
        (py < height - 1 && alphaSnap[i + width]  === 0);

      if (!hasTransparentNeighbour) continue;

      const bi  = i * 4;
      const min = Math.min(buf[bi], buf[bi + 1], buf[bi + 2]);
      if (min <= defringeThreshold) continue;

      const w      = Math.min(1, (min - defringeThreshold) / range);
      const factor = 1 - w * strengthFactor;
      buf[bi + 3]  = Math.round(alphaSnap[i] * factor);
    }
  }

  return buf;
}

// ── Process a single PNG file ──────────────────────────────────────────────────

async function processFile(file, args, verbose) {
  const { data, info } = await sharp(file.inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buf = new Uint8Array(data.buffer);
  const { width, height } = info;

  // Pass 1 — main background removal
  if (args.mode === 'threshold') {
    thresholdRemove(buf, args.threshold, args.feather);
  } else {
    floodFillRemove(buf, width, height, args.threshold, args.feather);
  }

  // Pass 2 — enclosed pocket / island cleanup
  let islandStats = null;
  if (args.islands) {
    islandStats = removeIslands(buf, width, height, args.islandThreshold, args.islandMaxArea, verbose);
  }

  // Pass 3 — edge defringe
  if (args.defringe) {
    defringeEdges(buf, width, height, args.defringeThreshold, args.defringeStrength, args.defringePasses);
  }

  fs.mkdirSync(path.dirname(file.outputPath), { recursive: true });

  await sharp(Buffer.from(buf.buffer), {
    raw: { width, height, channels: 4 }
  })
    .png({ compressionLevel: 9 })
    .toFile(file.outputPath);

  return islandStats;
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    const self = fs.readFileSync(__filename, 'utf8');
    const doc  = self.match(/^\/\*\*([\s\S]*?)\*\//);
    if (doc) console.log(doc[0]);
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
    ? 'flood-fill (edge-connected)'
    : 'threshold  (all near-white)';

  console.log('\nMonarium sprite processor');
  console.log(`  pass 1 — background:  ${modeLabel}  threshold:${args.threshold}  feather:${args.feather}`);
  console.log(`  pass 2 — islands:     ${args.islands ? `ON  max-area:${args.islandMaxArea}  whiteness-floor:${args.islandThreshold}` : 'OFF'}`);
  console.log(`  pass 3 — defringe:    ${args.defringe ? `ON  strength:${args.defringeStrength}  passes:${args.defringePasses}  floor:${args.defringeThreshold}` : 'OFF (use --defringe to enable)'}`);
  if (args.dryRun) console.log('  DRY RUN — no files will be written');
  console.log(`  found ${files.length} PNG file(s)\n`);

  let ok = 0, errs = 0, totalIslands = 0, totalIslandPx = 0;

  for (const file of files) {
    const inRel  = path.relative(REPO_ROOT, file.inputPath);
    const outRel = path.relative(REPO_ROOT, file.outputPath);

    if (args.dryRun) {
      console.log(`  [dry]  ${inRel}`);
      console.log(`      →  ${outRel}`);
      continue;
    }

    try {
      const islandStats = await processFile(file, args, args.verbose);
      let suffix = '';
      if (islandStats && islandStats.removed > 0) {
        suffix = `  [islands:${islandStats.removed} ×${islandStats.totalPx}px]`;
        totalIslands  += islandStats.removed;
        totalIslandPx += islandStats.totalPx;
      }
      console.log(`  ✓  ${inRel}${suffix}`);
      ok++;
    } catch (err) {
      console.error(`  ✗  ${inRel}  ERROR: ${err.message}`);
      errs++;
    }
  }

  if (!args.dryRun) {
    let summary = `\n${ok} processed${errs ? `, ${errs} failed` : ''}.`;
    if (totalIslands > 0) summary += `  ${totalIslands} island(s) removed (${totalIslandPx} px total).`;
    console.log(summary);
  }

  if (errs > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
