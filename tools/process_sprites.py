#!/usr/bin/env python3
"""
process_sprites.py
==================
Universal sprite-frame background remover for Monarium: Soul Duel.

Supports two background removal modes:
  auto    (default) — samples the background colour from the image border,
                      then removes it via edge-connected flood-fill.
                      Crops to content and normalises to a 512×512 canvas.
  chroma            — removes a user-specified key colour (green, magenta, etc.)
                      using global colour-distance replacement.
                      Preserves canvas size and does NOT crop.

Usage examples
--------------
  # Auto mode (background removal) with preserve-details preset:
  python3 tools/process_sprites.py \\
      --frames-dir raw_assets/flarepaw/jump \\
      --out-dir public/assets/characters/flarepaw/jump \\
      --preset preserve-details

  # Chroma key (green screen):
  python3 tools/process_sprites.py \\
      --frames-dir assets/raw/flarepaw/actions/flame_paw_barrage \\
      --out-dir public/assets/characters/flarepaw/actions/flame_paw_barrage \\
      --mode chroma \\
      --key-color "#00ff00" \\
      --tolerance 35 \\
      --feather 1 \\
      --despill

  # Chroma key (hot magenta, for green/grass characters):
  python3 tools/process_sprites.py \\
      --frames-dir raw_assets/leafmoth/attack \\
      --out-dir public/assets/characters/leafmoth/attack \\
      --mode chroma \\
      --key-color "#ff00ff" \\
      --tolerance 40 \\
      --feather 1 \\
      --despill

After any reprocess always run:
  npm run gen:manifest

Requires: Pillow, numpy
  pip install Pillow numpy
"""

import argparse
import os
import sys
from collections import deque

import numpy as np

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")


# ── Shared utilities ───────────────────────────────────────────────────────────

def ensure_rgba(arr: np.ndarray) -> np.ndarray:
    """Return a copy guaranteed to have 4 channels (RGBA)."""
    if arr.shape[2] == 3:
        alpha = np.full((arr.shape[0], arr.shape[1], 1), 255, dtype=np.uint8)
        return np.concatenate([arr, alpha], axis=2).copy()
    return arr.copy()


def parse_hex_color(hex_str: str) -> tuple[int, int, int]:
    """Parse '#rrggbb' or 'rrggbb' into (R, G, B) integers 0-255."""
    hex_str = hex_str.strip().lstrip('#')
    if len(hex_str) != 6:
        raise ValueError(f"Invalid colour '{hex_str}': expected 6 hex digits.")
    return int(hex_str[0:2], 16), int(hex_str[2:4], 16), int(hex_str[4:6], 16)


def feather_silhouette(arr: np.ndarray, radius: int = 1) -> np.ndarray:
    """
    Soften the alpha boundary of a sprite by averaging edge-pixel alpha with
    a dilated mask.  Interior fully-opaque pixels are untouched.
    """
    if radius <= 0:
        return arr

    alpha = arr[:, :, 3].astype(np.float32)

    for _ in range(radius):
        # 4-connected neighbour average (using numpy rolls — no scipy needed)
        neighbours = (
            np.roll(alpha, 1,  axis=0) + np.roll(alpha, -1, axis=0) +
            np.roll(alpha, 1,  axis=1) + np.roll(alpha, -1, axis=1)
        ) / 4.0
        # Only blur pixels that sit on the foreground edge (opaque next to transparent)
        on_edge = (alpha > 0) & (neighbours < alpha)
        alpha = np.where(on_edge, (alpha + neighbours) / 2.0, alpha)

    result = arr.copy()
    result[:, :, 3] = np.clip(alpha, 0, 255).astype(np.uint8)
    return result


def defringe_auto(arr: np.ndarray, bg_rgb: tuple[int, int, int]) -> np.ndarray:
    """
    For semi-transparent edge pixels contaminated by background colour bleed,
    replace their RGB with the weighted average of fully-opaque neighbours.
    Works for any background colour (white, grey, etc.).
    """
    result  = arr.copy()
    alpha   = result[:, :, 3].astype(np.float32)
    semi    = (alpha > 0) & (alpha < 240)

    if not semi.any():
        return result

    # Build a "background-like" mask: pixels whose colour is close to bg_rgb
    rgb  = result[:, :, :3].astype(np.float32)
    bg   = np.array(bg_rgb, dtype=np.float32)
    dist = np.sqrt(np.sum((rgb - bg) ** 2, axis=2))
    bg_like = dist < 60  # pixels that look like the background

    # For semi-transparent pixels that are also background-like, replace RGB
    # with the average of fully-opaque (alpha >= 240) 4-connected neighbours
    contaminated = semi & bg_like
    if not contaminated.any():
        return result

    opaque      = (alpha >= 240).astype(np.float32)
    for ch in range(3):
        chan       = result[:, :, ch].astype(np.float32)
        nbr_sum    = (
            np.roll(chan * opaque, 1,  axis=0) + np.roll(chan * opaque, -1, axis=0) +
            np.roll(chan * opaque, 1,  axis=1) + np.roll(chan * opaque, -1, axis=1)
        )
        nbr_count  = (
            np.roll(opaque, 1, axis=0) + np.roll(opaque, -1, axis=0) +
            np.roll(opaque, 1, axis=1) + np.roll(opaque, -1, axis=1)
        )
        has_opaque_nbr = nbr_count > 0
        replacement    = np.where(has_opaque_nbr, nbr_sum / np.maximum(nbr_count, 1), chan)
        result[:, :, ch] = np.where(contaminated, replacement, chan).clip(0, 255).astype(np.uint8)

    return result


# ── Auto mode (background removal) ────────────────────────────────────────────

def sample_bg_color(arr: np.ndarray, edge_width: int = 8) -> tuple[int, int, int]:
    """
    Sample the median RGB from the image border pixels.
    Skips pixels that are already transparent.
    """
    h, w  = arr.shape[:2]
    ew    = min(edge_width, h // 4, w // 4)

    top    = arr[:ew,    :,     :3]
    bottom = arr[-ew:,   :,     :3]
    left   = arr[:,      :ew,   :3]
    right  = arr[:,      -ew:,  :3]

    border = np.concatenate([
        top.reshape(-1, 3), bottom.reshape(-1, 3),
        left.reshape(-1, 3), right.reshape(-1, 3)
    ], axis=0)

    # Exclude pixels that are already transparent (if RGBA was passed)
    if arr.shape[2] == 4:
        top_a    = arr[:ew,   :,    3].reshape(-1)
        bottom_a = arr[-ew:,  :,    3].reshape(-1)
        left_a   = arr[:,     :ew,  3].reshape(-1)
        right_a  = arr[:,     -ew:, 3].reshape(-1)
        alphas   = np.concatenate([top_a, bottom_a, left_a, right_a])
        border   = border[alphas > 10]

    if len(border) == 0:
        return (255, 255, 255)

    return (
        int(np.median(border[:, 0])),
        int(np.median(border[:, 1])),
        int(np.median(border[:, 2])),
    )


def remove_background_auto(
    arr:       np.ndarray,
    tolerance: int = 30,
) -> np.ndarray:
    """
    Edge-connected flood-fill background removal with dynamic colour sampling.

    1. Samples the actual background colour from border pixels.
    2. Seeds a BFS from every edge pixel.
    3. Marks pixels transparent only when reachable from the edge AND within
       Euclidean colour-distance ≤ tolerance from the sampled bg colour.
    4. Interior pixels are never touched even if they match the bg colour
       (preserves eye glints, highlights, teeth, etc.).
    """
    result = ensure_rgba(arr)
    h, w   = result.shape[:2]
    bg_rgb = sample_bg_color(result)

    # BFS
    visited: np.ndarray = np.zeros((h, w), dtype=bool)
    queue:   deque      = deque()

    for x in range(w):
        queue.append((0,     x))
        queue.append((h - 1, x))
    for y in range(1, h - 1):
        queue.append((y, 0))
        queue.append((y, w - 1))

    bg = np.array(bg_rgb, dtype=np.float32)

    while queue:
        y, x = queue.popleft()
        if visited[y, x]:
            continue
        pix  = result[y, x, :3].astype(np.float32)
        dist = float(np.sqrt(np.sum((pix - bg) ** 2)))
        if dist > tolerance:
            continue
        visited[y, x] = True
        result[y, x, 3] = 0

        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                queue.append((ny, nx))

    return result, bg_rgb


def content_bbox(arr: np.ndarray, margin: int = 8) -> tuple[int, int, int, int]:
    """(x, y, w, h) tight bounding box of non-transparent pixels + margin."""
    if arr.shape[2] < 4:
        return 0, 0, arr.shape[1], arr.shape[0]
    alpha = arr[:, :, 3]
    rows  = np.any(alpha > 10, axis=1)
    cols  = np.any(alpha > 10, axis=0)
    if not rows.any():
        return 0, 0, arr.shape[1], arr.shape[0]
    rmin = max(0, int(np.where(rows)[0][0])  - margin)
    rmax = min(arr.shape[0] - 1, int(np.where(rows)[0][-1]) + margin)
    cmin = max(0, int(np.where(cols)[0][0])  - margin)
    cmax = min(arr.shape[1] - 1, int(np.where(cols)[0][-1]) + margin)
    return cmin, rmin, cmax - cmin + 1, rmax - rmin + 1


def place_on_canvas(content: "Image.Image", size: int, baseline: int) -> "Image.Image":
    """
    Fit content into a square transparent canvas, baseline-aligned.
    Never upscales.
    """
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cw, ch = content.size
    avail_w = size - 20
    avail_h = size - baseline - 10
    if cw > avail_w or ch > avail_h:
        scale  = min(avail_w / cw, avail_h / ch)
        new_w  = max(1, int(cw * scale))
        new_h  = max(1, int(ch * scale))
        content = content.resize((new_w, new_h), Image.LANCZOS)
        cw, ch = content.size
    px = (size - cw) // 2
    py = size - baseline - ch
    canvas.paste(content, (px, py), content)
    return canvas


# ── Chroma key mode ────────────────────────────────────────────────────────────

def remove_background_chroma(
    arr:       np.ndarray,
    key_color: tuple[int, int, int],
    tolerance: int = 35,
) -> np.ndarray:
    """
    Remove a chroma key background by global colour-distance thresholding.
    Pixels within Euclidean distance ≤ tolerance from key_color are erased.
    Canvas size is preserved; no cropping.
    """
    result = ensure_rgba(arr)
    pix    = result[:, :, :3].astype(np.float32)
    kv     = np.array(key_color, dtype=np.float32)
    dist   = np.sqrt(np.sum((pix - kv) ** 2, axis=2))
    result[dist <= tolerance, 3] = 0
    return result


def despill_chroma(
    arr:       np.ndarray,
    key_color: tuple[int, int, int],
) -> np.ndarray:
    """
    Remove chroma-colour contamination from semi-transparent edge pixels.

    For each semi-transparent pixel where the dominant key channel is inflated
    above the other two channels, the key channel is reduced to
    max(other_channels) to eliminate the halo.
    """
    result = arr.copy()
    kr, kg, kb = key_color

    # Identify the dominant channel of the key colour
    chans = [(kr, 0), (kg, 1), (kb, 2)]
    chans.sort(key=lambda x: -x[0])
    dom_val, dom_ch = chans[0]

    # Only act if the key colour actually has a dominant channel
    if dom_val <= 80:
        return result  # dark key colour — no despill needed

    semi = (result[:, :, 3] > 0) & (result[:, :, 3] < 240)
    if not semi.any():
        return result

    r = result[:, :, 0].astype(np.float32)
    g = result[:, :, 1].astype(np.float32)
    b = result[:, :, 2].astype(np.float32)

    if dom_ch == 1:    # green key
        max_other = np.maximum(r, b)
        contaminated = semi & (g > max_other + 12)
        result[:, :, 1] = np.where(contaminated, max_other, g).clip(0, 255).astype(np.uint8)
    elif dom_ch == 0:  # red key (magenta has high R)
        max_other = np.maximum(g, b)
        contaminated = semi & (r > max_other + 12)
        result[:, :, 0] = np.where(contaminated, max_other, r).clip(0, 255).astype(np.uint8)
    elif dom_ch == 2:  # blue key
        max_other = np.maximum(r, g)
        contaminated = semi & (b > max_other + 12)
        result[:, :, 2] = np.where(contaminated, max_other, b).clip(0, 255).astype(np.uint8)

    return result


# ── Folder processing pipeline ─────────────────────────────────────────────────

def process_folder(
    frames_dir:  str,
    out_dir:     str,
    mode:        str,
    key_color:   tuple[int, int, int],
    tolerance:   int,
    feather:     int,
    defringe:    bool,
    despill:     bool,
    canvas_size: int,
    baseline:    int,
    preview:     bool,
) -> None:
    if not os.path.isdir(frames_dir):
        sys.exit(f"ERROR: frames-dir not found: {frames_dir}")

    pngs = sorted(
        f for f in os.listdir(frames_dir)
        if f.lower().endswith('.png')
    )
    if not pngs:
        sys.exit(f"ERROR: no PNG files found in {frames_dir}")

    os.makedirs(out_dir, exist_ok=True)
    print(f"Mode         : {mode}")
    print(f"Input dir    : {frames_dir}  ({len(pngs)} PNGs)")
    print(f"Output dir   : {out_dir}")
    if mode == 'chroma':
        print(f"Key colour   : rgb{key_color}  tolerance={tolerance}")
    else:
        print(f"Tolerance    : {tolerance}  canvas={canvas_size}px  baseline={baseline}px")
    print(f"Feather      : {feather}px   defringe={defringe}   despill={despill}")
    print()

    preview_frames = []

    for fname in pngs:
        in_path  = os.path.join(frames_dir, fname)
        out_path = os.path.join(out_dir,    fname)
        img = Image.open(in_path).convert("RGBA")
        arr = np.array(img)

        if mode == 'chroma':
            # ── Chroma key pipeline ──────────────────────────────────────────
            arr = remove_background_chroma(arr, key_color, tolerance)
            if feather > 0:
                arr = feather_silhouette(arr, radius=feather)
            if despill:
                arr = despill_chroma(arr, key_color)
            result_img = Image.fromarray(arr, "RGBA")

        else:
            # ── Auto background removal pipeline ─────────────────────────────
            arr, bg_rgb = remove_background_auto(arr, tolerance=tolerance)
            if feather > 0:
                arr = feather_silhouette(arr, radius=feather)
            if defringe:
                arr = defringe_auto(arr, bg_rgb)

            # Crop to content and place on normalised canvas
            bx, by, bw, bh = content_bbox(arr, margin=8)
            if bw <= 0 or bh <= 0:
                print(f"  WARNING {fname}: no content found — skipping.")
                continue
            content     = Image.fromarray(arr, "RGBA").crop((bx, by, bx + bw, by + bh))
            result_img  = place_on_canvas(content, canvas_size, baseline)

        if preview:
            thumb = result_img.copy()
            thumb.thumbnail((200, 200), Image.LANCZOS)
            preview_frames.append(thumb)

        result_img.save(out_path, "PNG")
        print(f"  ✓ {fname}")

    if preview and preview_frames:
        cols_p     = min(5, len(preview_frames))
        rows_p     = (len(preview_frames) + cols_p - 1) // cols_p
        thumb_sz   = 200
        composite  = Image.new("RGBA", (cols_p * thumb_sz, rows_p * thumb_sz), (40, 40, 40, 255))
        for i, f in enumerate(preview_frames):
            fx = (i % cols_p) * thumb_sz
            fy = (i // cols_p) * thumb_sz
            composite.paste(f, (fx + (thumb_sz - f.width) // 2,
                                fy + (thumb_sz - f.height) // 2), f)
        prev_path = os.path.join(out_dir, "_preview_cleaned.png")
        composite.save(prev_path)
        print(f"\nPreview saved: {prev_path}")

    print(f"\nDone — {len(pngs)} frames processed → {out_dir}")


# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Remove sprite backgrounds.  "
            "Use --mode auto (default) for dynamic BG sampling, "
            "--mode chroma for green/magenta key colour removal."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--frames-dir", required=True,
        help="Directory containing input PNG frames.",
    )
    parser.add_argument(
        "--out-dir", required=True,
        help="Directory where output PNGs are written.",
    )
    parser.add_argument(
        "--mode", default="auto", choices=["auto", "chroma"],
        help="Background removal mode (default: auto).",
    )

    # Chroma key options
    parser.add_argument(
        "--key-color", default="#00ff00",
        help="Key colour for chroma mode, e.g. '#00ff00' (green) or '#ff00ff' (magenta). "
             "Default: #00ff00.",
    )
    parser.add_argument(
        "--despill", action="store_true",
        help="[chroma] Remove key-colour halo from semi-transparent edge pixels.",
    )

    # Shared options
    parser.add_argument(
        "--tolerance", type=int, default=30,
        help="Colour-distance threshold for background detection (default: 30). "
             "Raise if fringe remains; lower if character detail is erased.",
    )
    parser.add_argument(
        "--feather", type=int, default=0,
        help="Silhouette feather radius in pixels (default: 0 = sharp edge).",
    )
    parser.add_argument(
        "--defringe", action="store_true",
        help="[auto] Replace background-tainted RGB in semi-transparent edge pixels.",
    )
    parser.add_argument(
        "--preview", action="store_true",
        help="Save a _preview_cleaned.png composite in the output directory.",
    )

    # Auto-mode canvas options
    parser.add_argument(
        "--size", type=int, default=512,
        help="[auto] Output canvas side in pixels (default: 512).",
    )
    parser.add_argument(
        "--baseline", type=int, default=40,
        help="[auto] Transparent px below feet in normalised canvas (default: 40).",
    )

    # Convenience preset
    parser.add_argument(
        "--preset", choices=["preserve-details"],
        help="'preserve-details': sets tolerance=30, feather=1, defringe/despill on.",
    )

    args = parser.parse_args()

    # Apply preset before individual flags (flags override preset)
    if args.preset == "preserve-details":
        args.tolerance = 30
        args.feather   = 1
        args.defringe  = True
        args.despill   = True

    try:
        key_color = parse_hex_color(args.key_color)
    except ValueError as e:
        sys.exit(f"ERROR: {e}")

    process_folder(
        frames_dir  = args.frames_dir,
        out_dir     = args.out_dir,
        mode        = args.mode,
        key_color   = key_color,
        tolerance   = args.tolerance,
        feather     = args.feather,
        defringe    = args.defringe,
        despill     = args.despill,
        canvas_size = args.size,
        baseline    = args.baseline,
        preview     = args.preview,
    )


if __name__ == "__main__":
    main()
