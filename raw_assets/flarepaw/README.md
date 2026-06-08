# Flarepaw Raw Assets

Place raw frames here before processing.

**Sheet mode** — place a grid sprite sheet:
```
raw_assets/flarepaw/flarepaw_master_sheet.png
```

**Folder mode** — place individual extracted PNG files:
```
raw_assets/flarepaw/jump/jump_001.png
raw_assets/flarepaw/jump/jump_002.png
...
```

---

## Quick Start

Install dependencies (one-time):
```bash
pip install Pillow numpy
```

---

## Reprocessing the Jump Folder

Use folder mode with the `preserve-details` preset to keep eye glints and highlights:

```bash
python tools/process_sprites.py \
    --frames-dir raw_assets/flarepaw/jump \
    --out-dir public/assets/characters/flarepaw/jump \
    --preset preserve-details \
    --preview
```

After processing, regenerate the manifest so the game picks up the new frames:
```bash
npm run gen:manifest
```

---

## Reprocessing Other Animation Folders

Same pattern — swap the folder names:

```bash
# idle
python tools/process_sprites.py \
    --frames-dir raw_assets/flarepaw/idle \
    --out-dir public/assets/characters/flarepaw/idle \
    --preset preserve-details

# attack
python tools/process_sprites.py \
    --frames-dir raw_assets/flarepaw/attack \
    --out-dir public/assets/characters/flarepaw/attack \
    --preset preserve-details
```

---

## Reprocessing All Rows from a Sheet

```bash
# All rows (skip none)
python tools/process_sprites.py --skip-row "" --preset preserve-details

# Only the jump row (row 2), skip all others
python tools/process_sprites.py --skip-row "0,1,3" --preset preserve-details --preview
```

---

## Background Removal — What Changed

The old script used a hardcoded "is it near white?" check, which caused two
problems: gray backgrounds weren't removed (gray fails the near-white test),
and eye glints were erased (white passes the test if it's connected to the
border through the background).

The new script:
1. **Samples the actual background color** from the image borders (median of
   border pixels), so it works on any background color — white, gray, or tinted.
2. **Uses Euclidean color-distance** from that sampled color as the flood-fill
   condition. Eye whites (RGB ≈ 255,255,255) are far from a gray background
   (≈195,195,195 → distance ≈ 104) so they are never considered background,
   even if they would pass a "near white" test.
3. **Edge-connected fill only** — interior pixels are only removed if reachable
   from the border through background-colored pixels. Enclosed interior islands
   (eye glints, highlights, teeth) are unreachable through the character body.

---

## Tuning

| Flag | Default | Notes |
|------|---------|-------|
| `--tolerance N` | 30 | Color-distance threshold. Raise if background fringe remains; lower if character detail is being erased. |
| `--feather N` | 1 | Silhouette feather radius in pixels. 0 = sharp edge. |
| `--defringe` | off | Replace background-tainted RGB in semi-transparent edge pixels. |
| `--preset preserve-details` | — | Sets tolerance=30, feather=1, defringe. Recommended. |
| `--preview` | off | Saves `_preview_cleaned.png` composite for visual inspection. |

---

## Output

Folder mode output keeps the same filenames as input.
Sheet mode output:
```
public/assets/characters/flarepaw/frames/
  idle/   flarepaw_idle_01.png … flarepaw_idle_05.png
  run/    flarepaw_run_01.png  … flarepaw_run_05.png
  jump/   flarepaw_jump_01.png … flarepaw_jump_05.png
```

After any reprocess, always run:
```bash
npm run gen:manifest
```
