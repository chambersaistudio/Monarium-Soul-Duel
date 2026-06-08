#!/usr/bin/env python3
"""
process_sprites.py
==================
Removes backgrounds and normalises Flarepaw sprite frames.

TWO MODES
---------
Sheet mode (default)
    Slice a grid sprite sheet PNG into individual animation frames.

    python tools/process_sprites.py [--sheet PATH] [options]

Folder mode
    Process individual PNG files already extracted into a folder.
    Use this to reprocess a single animation folder (e.g. jump).

    python tools/process_sprites.py --frames-dir raw_assets/flarepaw/jump \\
                                     --out-dir public/assets/characters/flarepaw/jump

BACKGROUND REMOVAL
------------------
The algorithm is an edge-connected flood-fill with *dynamic* background color
sampling — it works on any background color, not just pure white.

  1. Sample the background color from the image borders (median of border pixels).
  2. Pre-compute the Euclidean color-distance of every pixel from the sampled bg.
  3. Flood-fill outward from every border pixel, marking only pixels whose
     color-distance from the background is ≤ --tolerance.
  4. Interior pixels (eye glints, teeth, highlights) are unreachable from the
     border through the character body, so they are never touched.
  5. Optional feathering softens the outer silhouette ring.
  6. Optional defringing replaces background-tainted RGB in semi-transparent edge
     pixels (only those pixels — opaque interior pixels are never recoloured).

PRESETS
-------
--preset preserve-details   tolerance=30  feather=1  defringe
    Recommended for characters with eye glints, white highlights, or teeth.

QUICK REFERENCE
---------------
Reprocess jump folder:
    python tools/process_sprites.py \\
        --frames-dir raw_assets/flarepaw/jump \\
        --out-dir public/assets/characters/flarepaw/jump \\
        --preset preserve-details --preview

Reprocess all animation folders one shot (sheet mode, all rows):
    python tools/process_sprites.py --skip-row "" --preset preserve-details

Requires: Pillow  (pip install Pillow)
          numpy   (pip install numpy)
"""

import argparse
import os
import sys
from collections import deque

import numpy as np

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: pip install Pillow")

# ── Row names for sheet mode ───────────────────────────────────────────────────

ROW_NAMES = ["idle", "run", "jump", "combat"]

# ── Preset definitions ─────────────────────────────────────────────────────────

PRESETS: dict = {
    "preserve-details": {"tolerance": 30, "feather": 1, "defringe": True},
}

# ── Background color sampling ──────────────────────────────────────────────────

def sample_bg_color(img_array: np.ndarray, edge_width: int = 8) -> tuple:
    """
    Samples the background color from a band around all four image edges.
    Returns (R, G, B) as floats — median of all border pixels, which is
    robust to corner artifacts and partial-frame edge content.
    """
    h, w = img_array.shape[:2]
    ew   = min(edge_width, h // 4, w // 4)
    samples = [
        img_array[:ew,   :,   :3].reshape(-1, 3),   # top
        img_array[-ew:,  :,   :3].reshape(-1, 3),   # bottom
        img_array[:,   :ew,   :3].reshape(-1, 3),   # left
        img_array[:,  -ew:,   :3].reshape(-1, 3),   # right
    ]
    all_px = np.vstack(samples).astype(np.float32)
    bg     = tuple(float(v) for v in np.median(all_px, axis=0))
    return bg  # (R, G, B)


# ── Background removal ─────────────────────────────────────────────────────────

def remove_background(img_array: np.ndarray, tolerance: int = 30) -> np.ndarray:
    """
    Edge-connected flood fill that removes only background pixels.

    Key difference from a global alpha-matte:
    - Seeds from every border pixel.
    - Uses Euclidean color-distance from the dynamically-sampled background
      color as the propagation condition.
    - Interior white islands (eye glints, highlights) are unreachable from
      the border through the character body → they are always preserved.
    - Only alpha is modified; RGB values of surviving pixels are untouched.
    """
    h, w = img_array.shape[:2]

    if img_array.shape[2] == 3:
        alpha  = np.full((h, w, 1), 255, dtype=np.uint8)
        result = np.concatenate([img_array, alpha], axis=2).copy()
    else:
        result = img_array.copy()

    bg  = np.array(sample_bg_color(result), dtype=np.float32)
    rgb = result[:, :, :3].astype(np.float32)

    # Euclidean distance from the sampled background color
    dist  = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    is_bg = dist <= float(tolerance)

    visited: np.ndarray = np.zeros((h, w), dtype=bool)
    queue: deque = deque()

    for x in range(w):
        if is_bg[0,   x]: queue.append((0,   x))
        if is_bg[h-1, x]: queue.append((h-1, x))
    for y in range(1, h - 1):
        if is_bg[y,   0]: queue.append((y,   0))
        if is_bg[y, w-1]: queue.append((y, w-1))

    while queue:
        y, x = queue.popleft()
        if visited[y, x]:
            continue
        visited[y, x]    = True
        result[y, x, 3]  = 0

        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_bg[ny, nx]:
                queue.append((ny, nx))

    return result


# ── Silhouette feathering ──────────────────────────────────────────────────────

def feather_silhouette(img_array: np.ndarray, radius: int = 1) -> np.ndarray:
    """
    Softens the outer silhouette boundary by reducing alpha for fully-opaque
    pixels within `radius` pixels of the transparent exterior.

    Works outward → inward:
    - The outermost opaque ring gets the most reduction.
    - Pixels deeper inside the character are untouched.
    - Interior opaque pixels (eye whites, highlights) are not affected
      because they are not adjacent to the transparent exterior.
    """
    if radius <= 0:
        return img_array.copy()

    result   = img_array.copy()
    h, w     = result.shape[:2]
    alpha    = result[:, :, 3].astype(np.float32)

    # frontier starts as the transparent exterior
    frontier = alpha < 10
    opaque   = alpha >= 200

    for step in range(1, radius + 1):
        # Dilate the frontier 1 step in the 4-connected sense
        grown           = np.zeros((h, w), dtype=bool)
        grown[:-1,  :]  |= frontier[1:,  :]
        grown[1:,   :]  |= frontier[:-1, :]
        grown[:,  :-1]  |= frontier[:, 1:]
        grown[:,   1:]  |= frontier[:, :-1]

        # Only affect pixels that are opaque and newly adjacent to the frontier
        edge_ring = grown & opaque & ~frontier
        if not edge_ring.any():
            break

        # Alpha for this ring: interpolate toward 0 at the outermost step
        # step=1 is outermost → lowest alpha; step=radius → near-full alpha
        t            = step / (radius + 1.0)
        target_alpha = 255.0 * t
        alpha[edge_ring] = np.minimum(alpha[edge_ring], target_alpha)

        frontier = grown | (alpha < 10)
        opaque   = alpha >= 200

    result[:, :, 3] = np.clip(alpha, 0, 255).astype(np.uint8)
    return result


# ── Defringe ───────────────────────────────────────────────────────────────────

def defringe_edges(img_array: np.ndarray) -> np.ndarray:
    """
    Removes background-color contamination from semi-transparent edge pixels
    by estimating the true foreground color from nearby fully-opaque neighbors.

    Contract:
    - Only pixels with 0 < alpha < 220 are recoloured.
    - Fully-opaque interior pixels (alpha >= 220) are NEVER modified.
    - Uses vectorised numpy shifts to avoid pixel-by-pixel Python loops.
    """
    result = img_array.copy()
    h, w   = result.shape[:2]
    alpha  = result[:, :, 3].astype(np.float32)

    semi_mask  = (alpha > 0) & (alpha < 220)
    if not semi_mask.any():
        return result

    opaque_mask = alpha >= 220
    rgb_sum     = np.zeros((h, w, 3), dtype=np.float32)
    count_map   = np.zeros((h, w),    dtype=np.float32)

    # Accumulate RGB contributions from opaque neighbors (2-pixel radius)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            if dy == 0 and dx == 0:
                continue
            y0s = max(0,  -dy);  y0e = min(h, h - dy)
            x0s = max(0,  -dx);  x0e = min(w, w - dx)
            y1s = max(0,   dy);  y1e = min(h, h + dy)
            x1s = max(0,   dx);  x1e = min(w, w + dx)

            src_opaque = opaque_mask[y0s:y0e, x0s:x0e].astype(np.float32)
            rgb_sum[y1s:y1e, x1s:x1e]  += (
                result[y0s:y0e, x0s:x0e, :3].astype(np.float32) * src_opaque[:, :, None]
            )
            count_map[y1s:y1e, x1s:x1e] += src_opaque

    has_nbr = (count_map > 0) & semi_mask
    if has_nbr.any():
        est = rgb_sum[has_nbr] / count_map[has_nbr, None]
        result[has_nbr, :3] = np.clip(est, 0, 255).astype(np.uint8)

    return result


# ── Content bounding box ───────────────────────────────────────────────────────

def content_bbox(img_array: np.ndarray, margin: int = 8):
    """Returns (x, y, w, h) of the tight content bbox with a margin pad."""
    if img_array.shape[2] < 4:
        return 0, 0, img_array.shape[1], img_array.shape[0]

    alpha     = img_array[:, :, 3]
    rows_mask = np.any(alpha > 10, axis=1)
    cols_mask = np.any(alpha > 10, axis=0)

    if not rows_mask.any():
        return 0, 0, img_array.shape[1], img_array.shape[0]

    rmin = max(0,                 int(np.where(rows_mask)[0][0])  - margin)
    rmax = min(img_array.shape[0]-1, int(np.where(rows_mask)[0][-1]) + margin)
    cmin = max(0,                 int(np.where(cols_mask)[0][0])  - margin)
    cmax = min(img_array.shape[1]-1, int(np.where(cols_mask)[0][-1]) + margin)

    return cmin, rmin, cmax - cmin + 1, rmax - rmin + 1


# ── Canvas placement ───────────────────────────────────────────────────────────

def place_on_canvas(
    content: "Image.Image",
    canvas_size: int,
    baseline_margin: int,
) -> "Image.Image":
    """
    Places cropped content on a square transparent canvas.
    - Centres horizontally.
    - Baseline-aligns feet (canvas bottom − baseline_margin).
    - Downscales if content exceeds available area; never upscales.
    """
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    cw, ch = content.size

    available_h = canvas_size - baseline_margin - 10
    available_w = canvas_size - 20

    if cw > available_w or ch > available_h:
        scale   = min(available_w / cw, available_h / ch)
        content = content.resize(
            (max(1, int(cw * scale)), max(1, int(ch * scale))),
            Image.LANCZOS,
        )
        cw, ch = content.size

    paste_x = (canvas_size - cw) // 2
    paste_y  = canvas_size - baseline_margin - ch
    canvas.paste(content, (paste_x, paste_y), content)
    return canvas


# ── Core per-frame pipeline ────────────────────────────────────────────────────

def process_frame(
    cell: "Image.Image",
    canvas_size: int,
    baseline_margin: int,
    tolerance: int,
    feather: int,
    do_defringe: bool,
) -> "Image.Image | None":
    """
    Full pipeline for a single frame image:
    remove_background → feather → defringe → crop to content → place on canvas.
    Returns None if no content is found after cleaning.
    """
    arr = np.array(cell.convert("RGBA"))

    bg_r, bg_g, bg_b = sample_bg_color(arr)
    arr = remove_background(arr, tolerance=tolerance)

    if feather > 0:
        arr = feather_silhouette(arr, radius=feather)

    if do_defringe:
        arr = defringe_edges(arr)

    bx, by, bw, bh = content_bbox(arr, margin=10)
    if bw <= 0 or bh <= 0:
        return None

    content = Image.fromarray(arr, "RGBA").crop((bx, by, bx + bw, by + bh))
    canvas  = place_on_canvas(content, canvas_size, baseline_margin)
    return canvas


# ── Sheet mode ─────────────────────────────────────────────────────────────────

def process_sheet(
    input_path: str,
    output_base: str,
    cols: int,
    rows: int,
    canvas_size: int,
    baseline_margin: int,
    tolerance: int,
    skip_rows: set,
    feather: int,
    do_defringe: bool,
    preview: bool,
) -> None:
    if not os.path.isfile(input_path):
        sys.exit(f"ERROR: Sheet not found: {input_path}")

    print(f"Loading sheet: {input_path}")
    sheet  = Image.open(input_path).convert("RGBA")
    sw, sh = sheet.size
    cell_w = sw // cols
    cell_h = sh // rows
    print(f"Sheet {sw}×{sh}  →  {cols}c × {rows}r  cells {cell_w}×{cell_h}")
    print(f"Output canvas {canvas_size}×{canvas_size}, baseline {baseline_margin}px")
    print()

    preview_frames = []

    for row in range(rows):
        if row in skip_rows:
            rn = ROW_NAMES[row] if row < len(ROW_NAMES) else f"row{row}"
            print(f"Skipping row {row} ({rn})")
            continue

        row_name = ROW_NAMES[row] if row < len(ROW_NAMES) else f"row{row}"
        out_dir  = os.path.join(output_base, row_name)
        os.makedirs(out_dir, exist_ok=True)
        print(f"Row {row} → {row_name}/")

        for col in range(cols):
            cell    = sheet.crop((col * cell_w, row * cell_h,
                                  (col + 1) * cell_w, (row + 1) * cell_h))
            arr     = np.array(cell)
            bg      = sample_bg_color(arr)
            label   = f"  [{row_name} {col+1:02d}]"
            print(f"{label} bg=({bg[0]:.0f},{bg[1]:.0f},{bg[2]:.0f})", end="  ")

            canvas  = process_frame(cell, canvas_size, baseline_margin,
                                    tolerance, feather, do_defringe)
            if canvas is None:
                print("WARNING: no content — skipped")
                continue

            if preview:
                preview_frames.append(canvas.copy())

            fname = f"flarepaw_{row_name}_{col+1:02d}.png"
            canvas.save(os.path.join(out_dir, fname), "PNG")
            print(f"✓ {fname}")
        print()

    if preview and preview_frames:
        _save_preview(preview_frames, os.path.join(output_base, "_preview_cleaned.png"))

    print("Done.")


# ── Folder mode ────────────────────────────────────────────────────────────────

def process_folder(
    frames_dir: str,
    out_dir: str,
    canvas_size: int,
    baseline_margin: int,
    tolerance: int,
    feather: int,
    do_defringe: bool,
    preview: bool,
) -> None:
    """
    Process all PNG files in frames_dir and write cleaned frames to out_dir.
    Output filenames match input filenames.
    """
    if not os.path.isdir(frames_dir):
        sys.exit(f"ERROR: Directory not found: {frames_dir}")

    png_files = sorted(f for f in os.listdir(frames_dir) if f.lower().endswith(".png"))
    if not png_files:
        sys.exit(f"ERROR: No PNG files found in: {frames_dir}")

    os.makedirs(out_dir, exist_ok=True)
    print(f"{len(png_files)} frames: {frames_dir}")
    print(f"Output:          {out_dir}")
    print()

    preview_frames = []

    for fname in png_files:
        src  = os.path.join(frames_dir, fname)
        img  = Image.open(src).convert("RGBA")
        arr  = np.array(img)
        bg   = sample_bg_color(arr)
        print(f"  {fname}  ({img.width}×{img.height})  bg=({bg[0]:.0f},{bg[1]:.0f},{bg[2]:.0f})", end="  ")

        canvas = process_frame(img, canvas_size, baseline_margin,
                               tolerance, feather, do_defringe)
        if canvas is None:
            print("WARNING: no content — skipped")
            continue

        if preview:
            preview_frames.append(canvas.copy())

        dst = os.path.join(out_dir, fname)
        canvas.save(dst, "PNG")
        print(f"✓")

    if preview and preview_frames:
        _save_preview(preview_frames, os.path.join(out_dir, "_preview_cleaned.png"))

    print()
    print(f"Done — {len(png_files)} frames processed.")


# ── Preview helper ─────────────────────────────────────────────────────────────

def _save_preview(frames: list, path: str, thumb: int = 200) -> None:
    cols_p    = min(5, len(frames))
    rows_p    = (len(frames) + cols_p - 1) // cols_p
    composite = Image.new("RGBA", (cols_p * thumb, rows_p * thumb), (40, 40, 40, 255))
    for i, f in enumerate(frames):
        ft = f.copy()
        ft.thumbnail((thumb, thumb), Image.LANCZOS)
        fx = (i % cols_p) * thumb
        fy = (i // cols_p) * thumb
        composite.paste(ft, (fx + (thumb - ft.width) // 2,
                              fy + (thumb - ft.height) // 2), ft)
    composite.save(path)
    print(f"Preview: {path}")


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    ap = argparse.ArgumentParser(
        description="Remove backgrounds and normalise Flarepaw sprite frames.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples
--------
Reprocess jump frames (folder mode, preserve-details preset):
  python tools/process_sprites.py \\
      --frames-dir raw_assets/flarepaw/jump \\
      --out-dir public/assets/characters/flarepaw/jump \\
      --preset preserve-details --preview

Reprocess all rows from the master sheet:
  python tools/process_sprites.py --skip-row "" --preset preserve-details

Only jump row from sheet (skip rows 0,1,3 — keep row 2):
  python tools/process_sprites.py --skip-row "0,1,3" --preset preserve-details --preview
""",
    )

    # Mode (mutually exclusive)
    mode_grp = ap.add_mutually_exclusive_group()
    mode_grp.add_argument(
        "--sheet", default=None,
        help="Source sprite sheet PNG (sheet mode, default: raw_assets/flarepaw/flarepaw_master_sheet.png)",
    )
    mode_grp.add_argument(
        "--frames-dir", default=None,
        help="Directory of individual PNG frames to process (folder mode)",
    )

    # Output
    ap.add_argument("--output",  default="public/assets/characters/flarepaw/frames",
                    help="Output base dir for sheet mode (default: public/assets/characters/flarepaw/frames)")
    ap.add_argument("--out-dir", default=None,
                    help="Output dir for folder mode (default: same as --output)")

    # Sheet-mode layout
    ap.add_argument("--cols",     type=int, default=5,   help="Sheet columns (sheet mode, default: 5)")
    ap.add_argument("--rows",     type=int, default=4,   help="Sheet rows (sheet mode, default: 4)")
    ap.add_argument("--skip-row", default="3",
                    help="Comma-separated row indices to skip (sheet mode, default: '3'). Pass '' for all rows.")

    # Shared processing options
    ap.add_argument("--size",      type=int, default=512,
                    help="Output canvas size in px (square, default: 512)")
    ap.add_argument("--baseline",  type=int, default=40,
                    help="Transparent margin below feet in output px (default: 40)")
    ap.add_argument("--tolerance", type=int, default=30,
                    help="Color-distance tolerance for bg flood fill (default: 30)")
    ap.add_argument("--feather",   type=int, default=1,
                    help="Silhouette feather radius in px (default: 1, 0=off)")
    ap.add_argument("--defringe",  action="store_true",
                    help="Replace bg-tainted RGB in semi-transparent edge pixels")
    ap.add_argument("--preset",    choices=list(PRESETS), default=None,
                    help="Apply a named preset (overrides --tolerance/--feather/--defringe)")
    ap.add_argument("--preview",   action="store_true",
                    help="Save a _preview_cleaned.png composite for inspection")

    args = ap.parse_args()

    # Apply preset (overrides individual flags)
    if args.preset:
        p = PRESETS[args.preset]
        args.tolerance = p["tolerance"]
        args.feather   = p["feather"]
        args.defringe  = p["defringe"]

    print(f"tolerance={args.tolerance}  feather={args.feather}  defringe={args.defringe}"
          + (f"  preset={args.preset}" if args.preset else ""))
    print()

    if args.frames_dir:
        # ── Folder mode ────────────────────────────────────────────────────────
        out = args.out_dir or args.output
        process_folder(
            frames_dir     = args.frames_dir,
            out_dir        = out,
            canvas_size    = args.size,
            baseline_margin= args.baseline,
            tolerance      = args.tolerance,
            feather        = args.feather,
            do_defringe    = args.defringe,
            preview        = args.preview,
        )
    else:
        # ── Sheet mode (default) ───────────────────────────────────────────────
        sheet = args.sheet or "raw_assets/flarepaw/flarepaw_master_sheet.png"
        skip_rows: set = set()
        if args.skip_row.strip():
            for s in args.skip_row.split(","):
                s = s.strip()
                if s.isdigit():
                    skip_rows.add(int(s))

        process_sheet(
            input_path     = sheet,
            output_base    = args.output,
            cols           = args.cols,
            rows           = args.rows,
            canvas_size    = args.size,
            baseline_margin= args.baseline,
            tolerance      = args.tolerance,
            skip_rows      = skip_rows,
            feather        = args.feather,
            do_defringe    = args.defringe,
            preview        = args.preview,
        )
