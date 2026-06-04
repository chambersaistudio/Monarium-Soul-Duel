# Flarepaw Raw Assets

Place the master sprite sheet here:

```
raw_assets/flarepaw/flarepaw_master_sheet.png
```

Then run the processor from the project root:

```bash
# Install dependencies (one-time)
pip install Pillow numpy

# Process with default settings (5 cols × 4 rows, 512×512 output, skip combat row)
python tools/process_flarepaw_sprites.py

# With preview (saves _preview_cleaned.png for inspection)
python tools/process_flarepaw_sprites.py --preview

# Include the combat row (row 3)
python tools/process_flarepaw_sprites.py --skip-row ""

# Adjust white background tolerance (higher = more aggressive removal)
python tools/process_flarepaw_sprites.py --tolerance 40
```

Output goes to:
```
public/assets/characters/flarepaw/frames/
  idle/  flarepaw_idle_01.png … flarepaw_idle_05.png
  run/   flarepaw_run_01.png  … flarepaw_run_05.png
  jump/  flarepaw_jump_01.png … flarepaw_jump_05.png
```

The game auto-detects these frames at startup and registers animations.
If frames are missing, it falls back to placeholder graphics.
