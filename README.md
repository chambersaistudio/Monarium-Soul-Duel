# MONARIUM: Soul Duel — Codex Prototype

An independent, clean-room browser prototype built from the MONARIUM Soul Duel brief. This implementation uses TypeScript and the native Canvas 2D API with a data-oriented simulation and a separate painter; it does not use the source branch's Phaser scenes, entities, or systems.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Flow

**Title → Celestial Training Field → Rival dialogue → Soul Duel → Result → Field**

## Controls

### Training Field
- **Arrow keys / WASD:** move Amari
- **E / Enter / Space:** interact and advance dialogue

### Soul Duel
- **← / →:** move
- **↑:** jump
- **↓:** guard
- **J:** Flaming Palm combo
- **K:** selected special
- **L:** Aura Step
- **I:** Magmaforge Form
- **U:** Soulburst ultimate at full Soulbond
- **1–4:** select Ember Claws, Blaze Charge, Flame Vortex, or Flame Guard
## Architecture

- `src/model.ts` — serializable game state and move data
- `src/simulation.ts` — functional gameplay rules and state transitions
- `src/painter.ts` — procedural Canvas presentation and HUD
- `src/input.ts` — small keyboard state adapter
- `src/main.ts` — browser loop and composition root

## Flarepaw sprite-sheet background removal

The existing Flarepaw source sheet is stored at:

- Repository path: `public/assets/characters/flarepaw/flarepaw_sheet.png`
- Browser/public URL (and the URL Phaser should load later): `/assets/characters/flarepaw/flarepaw_sheet.png`

Browser-facing source and transparent-sheet paths are centralized in
`src/assetPaths.ts`. Battle rendering loads the transparent runtime path and
slices it as a five-column by four-row sheet: idle, run, jump, then action. It
draws one cropped frame at a time with smooth Canvas scaling and mirrors the
existing fighter transform when Flarepaw changes facing direction. If the
transparent sheet is unavailable, the procedural Flarepaw drawing remains as a
non-breaking fallback.

Add `?frames` to the game URL to display the temporary sheet/frame-dimension
debug readout during a duel.

To create the transparent version locally, install Pillow and run the reusable
background-removal utility:

```bash
python -m pip install Pillow
python tools/remove_white_background.py \
  public/assets/characters/flarepaw/flarepaw_sheet.png \
  public/assets/characters/flarepaw/flarepaw_sheet_transparent.png
```

The script preserves the original dimensions and only removes near-white pixels
connected to the image's outer edges. Enclosed white details such as highlights,
eyeshine, and glow remain intact. The source file is never overwritten. Use
`--threshold 240` to explicitly set the default near-white cutoff, or adjust the
value when processing a different sheet.
