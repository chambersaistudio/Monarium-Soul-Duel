# MONARIUM: Soul Duel — Prototype

A browser-playable 2.5D anime creature battle prototype built with **Phaser 3**, **TypeScript**, and **Vite**.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Build for Production

```bash
npm run build
npm run preview   # preview the production build locally
```

Output is in the `dist/` folder — serve it as a static site.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project on [vercel.com](https://vercel.com).
3. Vercel auto-detects `vercel.json`; no extra config needed.
4. Click **Deploy**.

## Game Flow

```
Title Screen → Overworld (Training Field) → Talk to Rival → Battle → Victory/Defeat → Overworld
```

## Controls

### Overworld
| Key | Action |
|-----|--------|
| Arrow Keys | Move Amari |
| E / Enter | Interact with Rival |
| Esc | Pause (placeholder) |

### Battle
| Key | Action |
|-----|--------|
| ← / → | Move left / right |
| ↑ | Jump |
| ↓ | Guard / Brace |
| **J** | Core Attack (combo: J → J → J) |
| **K** | Use Selected Special Move |
| **L** | Dodge / Aura Step |
| **I** | Activate Ability / Magmaforge Form |
| **U** | Ultimate / Soulburst |
| **1–4** | Select Special Slot (also Numpad 1–3, Numpad 0) |

## Fighters

### Flarepaw (Player)
- **Element:** Fire
- **Style:** Fast close-range palm-strike combo fighter
- **Core Attack:** Flaming Palm Strike (3-hit combo)
- **Specials:**
  1. Ember Claws — short-range fire combo (20 Aura)
  2. Blaze Charge — dash attack (35 Aura)
  3. Flame Vortex — projectile tornado (45 Aura)
  4. Flame Guard — defensive fire aura (25 Aura)
- **Ability:** Magmaforge Form (+25% damage, 8 seconds)
- **Ultimate:** Magma Palm Barrage (requires 100 Soulbond)

### Droplet (AI Enemy)
- **Element:** Water
- **Style:** Agile mid-range projectile/control fighter
- **Core Attack:** Aqua Swipe
- **AI Moves:** Aqua Splash, Bubble Dance, Frost Pounce

## Project Structure

```
src/
  main.ts               # Phaser game config & boot
  scenes/
    BootScene.ts        # Initial boot
    PreloadScene.ts     # Asset loading (placeholder)
    TitleScene.ts       # Title screen
    OverworldScene.ts   # Training field + NPC dialogue
    BattleScene.ts      # 2.5D side-view battle
  entities/
    MinariFighter.ts    # Core fighter entity (player & AI)
    Projectile.ts       # Pooled projectile entity
    OverworldPlayer.ts  # Amari overworld movement
    RivalNPC.ts         # Rival NPC with interaction
    SoulSpriteOrb.ts    # Floating ambient orbs
  systems/
    InputSystem.ts      # Keyboard input abstraction
    FormSystem.ts       # Ability/form mode logic
    UISystem.ts         # Battle HUD rendering
  data/
    minariData.ts       # Flarepaw & Droplet stat blocks
    moveData.ts         # Core attacks, specials, forms, ultimates
  types/
    minari.ts           # Minari/fighter type definitions
    combat.ts           # Combat system type definitions

public/assets/          # Drop sprite sheets & art here
  characters/
    amari/
    flarepaw/
    droplet/
  backgrounds/
  ui/
  vfx/
  cutscenes/
```

## Asset Replacement

All visuals are procedural placeholder graphics. To add real art:

1. Drop sprite sheets into `public/assets/characters/<name>/`
2. Load them in `PreloadScene.ts` with `this.load.spritesheet(...)`
3. Replace `body_gfx` drawing in `MinariFighter.ts` with `this.add.sprite(...)`
4. Add animation configs and swap `drawBody()` calls

## Not Yet Built (Planned)

- Multiplayer
- Full story mode / save system
- Full Minari roster (capture, bonding, evolution)
- Inventory, shops
- Mobile touch controls
- Cinematic QTE / cutscene sequences
- Online account system
