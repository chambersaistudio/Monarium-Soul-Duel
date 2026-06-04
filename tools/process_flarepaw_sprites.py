#!/usr/bin/env python3
"""
process_flarepaw_sprites.py
============================
Slices a raw Flarepaw sprite sheet into clean, individually-normalised PNG frames.

Usage
-----
  python tools/process_flarepaw_sprites.py [options]

  --sheet PATH      Source sheet (default: raw_assets/flarepaw/flarepaw_master_sheet.png)
  --output PATH     Output base dir (default: public/assets/characters/flarepaw/frames)
  --cols N          Columns in grid (default: 5)
  --rows N          Rows to process (default: 4)
  --size N          Output canvas side px (default: 512)
  --baseline N      Pixels from canvas bottom to keep below feet (default: 40)
  --tolerance N     White-pixel detection tolerance 0-255 (default: 30)
  --skip-row N      Comma-separated row indices to skip (0-based, default: 3)
  --preview         Save a debug composite showing cleaned frames before normalisation

Row mapping (0-indexed)
  Row 0 → idle
  Row 1 → run
  Row 2 → jump
  Row 3 → combat  (skipped by default; pass --skip-row "" to include)

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

# ── Constants ─────────────────────────────────────────────────────────────────

ROW_NAMES = ["idle", "run", "jump", "combat"]


# ── Background removal ─────────────────────────────────────────────────────────

def flood_fill_background(img_array: np.ndarray, tolerance: int = 30) -> np.ndarray:
    """
    Edge-connected flood fill to remove the white/near-white background.

    Seeds from every pixel on the image border.  Only pixels reachable from the
    edge that satisfy the whiteness threshold are made transparent.  Internal
    white/near-white pixels (highlights, eyes, teeth) are preserved.
    """
    h, w = img_array.shape[:2]

    # Ensure RGBA
    if img_array.shape[2] == 3:
        alpha = np.full((h, w, 1), 255, dtype=np.uint8)
        result = np.concatenate([img_array, alpha], axis=2).copy()
    else:
        result = img_array.copy()

    visited = np.zeros((h, w), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    # Seed all four edges
    for x in range(w):
        queue.append((0, x))
        queue.append((h - 1, x))
    for y in range(1, h - 1):
        queue.append((y, 0))
        queue.append((y, w - 1))

    thresh = 255 - tolerance

    while queue:
        y, x = queue.popleft()
        if visited[y, x]:
            continue
        r, g, b = int(result[y, x, 0]), int(result[y, x, 1]), int(result[y, x, 2])
        if r < thresh or g < thresh or b < thresh:
            continue  # not white — stop propagating this path
        visited[y, x] = True
        result[y, x, 3] = 0  # transparent

        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                queue.append((ny, nx))

    return result


# ── Content bounding box ───────────────────────────────────────────────────────

def content_bbox(img_array: np.ndarray, margin: int = 8):
    """
    Returns (x, y, w, h) tight bounding box of non-transparent content.
    Falls back to full image bounds if no content found.
    """
    if img_array.shape[2] < 4:
        return 0, 0, img_array.shape[1], img_array.shape[0]

    alpha = img_array[:, :, 3]
    rows_mask = np.any(alpha > 10, axis=1)
    cols_mask = np.any(alpha > 10, axis=0)

    if not rows_mask.any():
        return 0, 0, img_array.shape[1], img_array.shape[0]

    rmin, rmax = int(np.where(rows_mask)[0][0]),  int(np.where(rows_mask)[0][-1])
    cmin, cmax = int(np.where(cols_mask)[0][0]),  int(np.where(cols_mask)[0][-1])

    rmin = max(0, rmin - margin)
    rmax = min(img_array.shape[0] - 1, rmax + margin)
    cmin = max(0, cmin - margin)
    cmax = min(img_array.shape[1] - 1, cmax + margin)

    return cmin, rmin, cmax - cmin + 1, rmax - rmin + 1


# ── Canvas placement ───────────────────────────────────────────────────────────

def place_on_canvas(
    content: "Image.Image",
    canvas_size: int,
    baseline_margin: int,
) -> "Image.Image":
    """
    Places the content image on a square transparent canvas.

    - Centres horizontally.
    - Aligns the bottom of the content to (canvas_size - baseline_margin).
    - Downscales if the content exceeds the available area; never upscales.
    """
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    cw, ch = content.size
    available_h = canvas_size - baseline_margin - 10  # 10px top clearance
    available_w = canvas_size - 20                    # 10px side clearance each

    # Downscale only — never upscale
    if cw > available_w or ch > available_h:
        scale = min(available_w / cw, available_h / ch)
        new_w = max(1, int(cw * scale))
        new_h = max(1, int(ch * scale))
        content = content.resize((new_w, new_h), Image.LANCZOS)
        cw, ch = content.size

    paste_x = (canvas_size - cw) // 2
    paste_y = canvas_size - baseline_margin - ch  # baseline-aligned

    canvas.paste(content, (paste_x, paste_y), content)
    return canvas


# ── Main pipeline ──────────────────────────────────────────────────────────────

def process_sheet(
    input_path: str,
    output_base: str,
    cols: int,
    rows: int,
    canvas_size: int,
    baseline_margin: int,
    tolerance: int,
    skip_rows: set,
    preview: bool,
):
    if not os.path.isfile(input_path):
        sys.exit(f"ERROR: Sheet not found: {input_path}")

    print(f"Loading sheet: {input_path}")
    sheet = Image.open(input_path).convert("RGBA")
    sw, sh = sheet.size
    print(f"Sheet dimensions: {sw} × {sh}")

    cell_w = sw // cols
    cell_h = sh // rows
    print(f"Cell size: {cell_w} × {cell_h}  (grid {cols} cols × {rows} rows)")
    print(f"Output canvas: {canvas_size} × {canvas_size}  baseline margin: {baseline_margin}px")
    print()

    preview_frames = []

    for row in range(rows):
        if row in skip_rows:
            print(f"Skipping row {row} ({ROW_NAMES[row] if row < len(ROW_NAMES) else 'row'+str(row)})")
            continue

        row_name = ROW_NAMES[row] if row < len(ROW_NAMES) else f"row{row}"
        out_dir = os.path.join(output_base, row_name)
        os.makedirs(out_dir, exist_ok=True)
        print(f"Processing row {row} → {row_name}/")

        for col in range(cols):
            sx = col * cell_w
            sy = row * cell_h
            cell = sheet.crop((sx, sy, sx + cell_w, sy + cell_h))

            # Remove white background
            cell_arr = np.array(cell)
            clean_arr = flood_fill_background(cell_arr, tolerance=tolerance)
            clean = Image.fromarray(clean_arr, "RGBA")

            # Find content bounds
            bx, by, bw, bh = content_bbox(clean_arr, margin=10)

            if bw <= 0 or bh <= 0:
                print(f"  [{row_name} {col+1:02d}] WARNING: no content detected — skipping.")
                continue

            # Crop to content only
            content = clean.crop((bx, by, bx + bw, by + bh))

            if preview:
                preview_frames.append(content.copy())

            # Place on normalised 512×512 canvas
            canvas = place_on_canvas(content, canvas_size, baseline_margin)

            fname = f"flarepaw_{row_name}_{col+1:02d}.png"
            fpath = os.path.join(out_dir, fname)
            canvas.save(fpath, "PNG")
            print(f"  ✓ {fname}  (content {bw}×{bh})")

        print()

    if preview and preview_frames:
        cols_p = min(5, len(preview_frames))
        rows_p = (len(preview_frames) + cols_p - 1) // cols_p
        thumb = 200
        composite = Image.new("RGBA", (cols_p * thumb, rows_p * thumb), (40, 40, 40, 255))
        for i, f in enumerate(preview_frames):
            fx = (i % cols_p) * thumb
            fy = (i // cols_p) * thumb
            f_thumb = f.copy()
            f_thumb.thumbnail((thumb, thumb), Image.LANCZOS)
            composite.paste(f_thumb, (fx + (thumb - f_thumb.width) // 2,
                                      fy + (thumb - f_thumb.height) // 2), f_thumb)
        preview_path = os.path.join(output_base, "_preview_cleaned.png")
        composite.save(preview_path)
        print(f"Preview saved: {preview_path}")

    print("Done.")


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Slice and clean a Flarepaw sprite sheet into individual PNG frames."
    )
    parser.add_argument(
        "--sheet",
        default="raw_assets/flarepaw/flarepaw_master_sheet.png",
        help="Path to the source sprite sheet",
    )
    parser.add_argument(
        "--output",
        default="public/assets/characters/flarepaw/frames",
        help="Output base directory",
    )
    parser.add_argument("--cols",      type=int, default=5,   help="Columns in sheet grid")
    parser.add_argument("--rows",      type=int, default=4,   help="Rows in sheet grid")
    parser.add_argument("--size",      type=int, default=512, help="Output canvas px (square)")
    parser.add_argument("--baseline",  type=int, default=40,  help="Px from canvas bottom to feet")
    parser.add_argument("--tolerance", type=int, default=30,  help="White BG detection tolerance")
    parser.add_argument(
        "--skip-row",
        default="3",
        help="Comma-separated row indices to skip (default: 3=combat). Pass '' to process all.",
    )
    parser.add_argument("--preview", action="store_true", help="Save a _preview_cleaned.png")
    args = parser.parse_args()

    skip_rows: set = set()
    if args.skip_row.strip():
        for s in args.skip_row.split(","):
            s = s.strip()
            if s.isdigit():
                skip_rows.add(int(s))

    process_sheet(
        input_path=args.sheet,
        output_base=args.output,
        cols=args.cols,
        rows=args.rows,
        canvas_size=args.size,
        baseline_margin=args.baseline,
        tolerance=args.tolerance,
        skip_rows=skip_rows,
        preview=args.preview,
    )
