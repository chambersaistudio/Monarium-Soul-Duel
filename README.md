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
