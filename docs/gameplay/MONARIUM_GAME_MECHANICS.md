# MONARIUM: Soul Duel — Game Mechanics Bible

> **Source of truth for battle and progression systems.**
> Any AI agent or developer modifying battle, progression, or bonding systems
> **must read this document first.**

---

## Official Terminology

| Term | Definition |
|------|------------|
| **Monari** | The creature partners in MONARIUM. Singular and plural. **Never** use Minari, Manari, Monary, or Monarie in visible UI, dialogue, or text. |
| **Bonder** | The human player and NPC trainers who form soul bonds with Monari. |
| **Bond Lab** | The facility where new Bonders choose their first Monari. |
| **Soul Sync** | The live in-battle connection metric between Bonder and active Monari. |
| **True Soul Bond** | Deep, permanent bond state beyond normal partnership — unlocks advanced mechanics. |
| **Soul Burst** | Power surge available to True Soul Bond Monari at high Soul Sync. |
| **Ascension** | Rare temporary battle transformation, the "fourth state" of a Monari. |

---

## Core Progression Systems

### 1. Monari Level

Individual raw growth and combat strength of a single Monari.

**Controls:**
- Base HP, Aura, Attack, Special Attack, Defense, Special Defense, Speed
- Move learn threshold (certain moves unlock at specific levels)
- Evolution access (Monari must reach required level before evolution is possible)
- Battle stat scaling (each level multiplies base stats by a growth factor)

**XP:** Monari Level XP is earned from battles. It is **separate from Bond XP**. Soul Rank does **not** directly increase Monari Level XP gain by default.

**Level range:** 1–100.

---

### 2. Soul Rank

The Bonder's overall mastery across all bonding and battle experience.

**Soul Rank does NOT hard-lock basic catching or bonding.** Players can attempt to bond with common, rare, super rare, or ultra rare Monari at any Soul Rank. Soul Rank influences probability, speed, and eligibility — never a hard gate for normal encounters.

**Soul Rank tiers:**

| Tier | Rank Range |
|------|-----------|
| Novice | 1–10 |
| Seeker | 11–25 |
| Adept | 26–40 |
| Bonded | 41–55 |
| Expert | 56–70 |
| Master | 71–85 |
| Soul Master | 86–95 |
| True Soul | 96–100 |

**Soul Rank affects:**
- Rare encounter weight (see Encounter Boost section)
- Bond XP gain speed (see Bond XP Multiplier)
- Advanced shop and training unlocks
- True Soul Bond eligibility (minimum rank required)
- Ascension eligibility (minimum rank required)
- Story/tournament access in later content

#### Encounter Boost Rule

Higher Soul Rank slightly increases encounter weight of Super Rare and Ultra Rare Monari.

- Normal Ultra Rare encounter chance: ~0.5%
- Max Soul Rank (Rank 100) Ultra Rare chance: ~1.0%
- The boost is gradual — Ultra Rare should still feel rare at all ranks.
- In special event zones and rift zones, this boost can stack harder.

Keep the boost tasteful. Ultra Rare should never feel farmable through rank alone.

#### Bond XP Multiplier Rule

Higher Soul Rank increases Bond XP gain speed only — **not** Monari Level XP.

- Rank 1: 1.0× Bond XP
- Rank 50: ~1.25× Bond XP
- Rank 100: ~1.5× Bond XP

---

### 3. Bond Level

The permanent relationship level between a Bonder and one specific Monari.

**Bond Level never drops under normal gameplay.** Low Bond Level penalizes lightly (starting Sync is lower) but never makes the baseline battle feel unfair or punishing.

**Bond Level range:** 1–10.

**Bond Level affects:**

| Effect | Low Bond | High Bond |
|--------|----------|-----------|
| Starting Soul Sync | Lower (Bond 1 → 70 Sync) | Higher (Bond 10 → 100 Sync) |
| Sync recovery speed | Normal | Faster passive per-turn gain |
| Sync disruption resistance | Normal | More resilient |
| Crit bonus | None | Improved |
| Dodge/evasion bonus | None | Improved |
| Special move stability | Normal | Improved |
| Soul Burst access | Not eligible | Eligible at Bond 10 + True Soul Bond |
| True Soul Bond eligibility | Not eligible | Eligible at Bond 10+ |
| Ascension eligibility | Not eligible | Eligible at Bond 10 |
| Fear/corruption resistance | Normal | Improved |

---

### 4. Bond Momentum

Temporary usage streak multiplier for faster Bond XP gain.

**Rules:**
- Bond Momentum increases when the player uses the same Monari repeatedly across battles.
- Bond Momentum decays when the Monari sits out for several battles (after ~3 battles of disuse).
- Bond Momentum never reduces already-earned Bond XP. It only affects the gain rate going forward.
- Maximum Bond Momentum: 100 (provides up to +50% Bond XP gain on top of base).

**Purpose:** Reward consistent use of a Monari without permanently punishing a player who rotates their team.

---

### 5. Soul Sync

The live in-battle connection between the Bonder and their currently active Monari.

**Soul Sync is individual per active Monari in battle.** When the player swaps Monari, the Sync bar immediately reflects the incoming Monari's current Sync value.

**Soul Sync appears on the Monari battle status card alongside HP and Aura.**

#### Starting Soul Sync

Soul Sync starts at the highest value currently possible for that Monari based on Bond Level.

| Bond Level | Starting Sync |
|------------|--------------|
| 1 | 70 |
| 2 | 74 |
| 3 | 77 |
| 4 | 80 |
| 5 | 83 |
| 6 | 86 |
| 7 | 89 |
| 8 | 92 |
| 9 | 96 |
| 10 | 100 |
| True Soul Bond | 100 (also unlocks Soul Burst eligibility) |

#### Soul Sync Tiers

| Tier | Range | Effect |
|------|-------|--------|
| **Locked In** | 80–100 | Crit/dodge/accuracy bonuses active. Soul Burst available if requirements met. |
| **Stable** | 50–79 | Normal performance. No extra bonuses or penalties. |
| **Shaken** | 25–49 | Reduced crit/dodge/accuracy. Special moves slightly less stable. |
| **Broken Sync** | 0–24 | No Soul Burst. No Sync bonuses. Vulnerable to disruption moves. |

> **Important:** Low Sync should not make the player miss constantly or create unfair moments. It reduces bonuses and creates pressure — it does not make the game miserable.

#### Sync Decrease Events

- Missing attacks
- Being hit by crits or heavy attacks
- Enemy Sync Break moves
- Fear, confusion, or corruption status effects
- Swapping Monari out
- Low HP pressure (below 25% HP)
- Enemy intimidation or pressure abilities

#### Sync Increase Events

- Landing attacks
- Successfully guarding
- Successfully dodging
- Type advantage hits
- Winning clashes
- Using the same Monari for multiple turns consecutively
- Support/command actions
- Surviving a low HP moment
- High Bond Level passive per-turn bonus

---

### 6. Aura

The move resource for special attacks.

- Basic attacks typically cost **zero** Aura.
- Special moves cost Aura.
- Guarding may generate a small amount of Aura.
- Aura is **completely separate from Soul Sync**. Do not conflate them.
- Aura appears on the Monari battle card as a separate bar below HP.

---

### 7. True Soul Bond

A deep bond state beyond normal ownership/partnership.

- Can apply to up to **four** active team Monari.
- Active team maximum: **four Monari**.
- A Bonder can own many Monari in storage, but True Soul Bond should be grind-heavy and meaningful.
- True Soul Bond unlocks Soul Burst and Ascension eligibility.

**Requirements:**
- High Bond Level (Bond 10 required)
- Sufficient Soul Rank (minimum: Expert tier, Rank 56+)
- Required Monari Level and evolution stage
- Completion of a special bond trial or story/training condition
- Demonstrated Soul Sync mastery (sustained Locked In Sync performance)

---

### 8. Soul Burst

A universal power surge available to Monari with True Soul Bond.

- Not a full transformation — a temporary amplification.
- Requires high or full Soul Sync (must be in **Locked In** tier, 80+).
- Temporarily boosts: Aura output, damage power, reaction speed, or special move strength.
- Exact effect scales with current Sync value and Bond Level.
- Cannot be used while in **Broken Sync** or **Shaken** tier.

---

### 9. Ascension

A rare, temporary battle transformation — the Monari's secret higher form.

Ascension is the "fourth state" — a glimpse of a Monari's true power under perfect harmony. Not something a normal user will see casually.

**Requirements (all must be met simultaneously):**
- High Monari Level (Level 80+ recommended)
- Maximum or near-maximum Bond Level (Bond 10)
- High Soul Rank (Soul Master tier, Rank 86+)
- True Soul Bond established
- Full Soul Sync (100) at the moment of activation
- Completed a special Ascension trial or met a rare narrative condition

**Properties:**
- Separate from normal evolution — does not replace the Monari's evolution chain.
- Duration-limited. Returns to normal state after battle or after a set number of turns.
- Visually distinct: unique aura, altered silhouette or form.

---

### 10. Soul Strain / Bonder Condition

> **Do NOT implement Soul Strain in the regular battle HUD.**

Soul Strain is a story-mode mechanic intended for special narrative battles where the human Bonder is directly hurt, spiritually damaged, or under villain/corruption pressure.

**When to use Soul Strain (story mode only):**
- Villain battles where the Bonder is personally targeted
- Corruption events
- Rift/void zone battles with special rules
- Cutscene-driven special encounters

**Effects in story mode:**
- Temporarily reduces Sync gain rate
- May reduce accuracy bonus or crit bonus
- Can lower Soulbind chance in special battles

**The normal battle HUD does not have a Resolve bar or Bonder HP bar.** This is intentional.

---

## Normal Battle HUD Data

The following data must be exposed for every active battle:

| Field | Description |
|-------|-------------|
| `playerHp` / `playerMaxHp` | Player Monari's current and max HP |
| `playerAura` / `playerMaxAura` | Player Monari's current and max Aura |
| `playerSync` | Player Soul Sync value (0–100) |
| `playerSyncTier` | Current Sync tier: `locked_in`, `stable`, `shaken`, `broken` |
| `playerBondLevel` | Bond Level between Bonder and this Monari (1–10) |
| `playerBonderSoulRank` | Bonder's current Soul Rank level (1–100) |
| `enemyHp` / `enemyMaxHp` | Enemy Monari HP |
| `enemyAura` / `enemyMaxAura` | Enemy Monari Aura |
| `enemySync` | Enemy Soul Sync (0–100) |
| `enemySyncTier` | Enemy Sync tier |

> **No Resolve bar. No Bonder HP bar. No Soul Strain display in normal battles.**

---

## Rarity Tiers

| Tier | Wild Encounter Weight | Notes |
|------|----------------------|-------|
| `common` | ~50% | Plentiful everywhere |
| `uncommon` | ~25% | Found in most areas |
| `rare` | ~15% | Noticeably rarer |
| `super_rare` | ~8% | Rare find; affected by Soul Rank |
| `ultra_rare` | ~1.5% | Very rare; Soul Rank boosts to ~2% max |
| `legendary` | ~0.2% | Story/milestone or event unlock |
| `mythic` | ~0% | Near-unobtainable; special conditions only |

---

## Architecture Notes

### File Locations

| File | Purpose |
|------|---------|
| `src/types/progression.ts` | All progression types (SoulSync, BondLevel, SoulRank, etc.) |
| `src/config/progressionConfig.ts` | All tunable numeric values for progression systems |
| `src/systems/SoulSyncSystem.ts` | In-battle Sync state machine |
| `src/systems/BondProgressionSystem.ts` | Bond XP/Level/Momentum management |
| `src/systems/PlayerProgressionSystem.ts` | Soul Rank tracking and modifiers |
| `src/data/monariDex.ts` | Monari progression metadata (level scaling, evolution, encounter weight) |
| `src/data/characterData.ts` | Bonder/NPC character definitions |
| `src/data/moveDex.ts` | Extended move data with progression metadata |

### Integration Points

- **ClassicSoulDuelScene** creates `SoulSyncSystem` instances for player and enemy at battle start.
- `SoulSyncSystem` is initialized with `bondLevel` from the player's `PlayerProfile` (stored in Phaser registry as `player_profile`).
- Defaults to `bondLevel = 1` when no profile is present (prototype/dev mode).
- `ClassicSoulDuelScene.getHUDData()` returns a `BattleHUDData` object; the UI layer reads from this.
- `ClassicBattleEngine` remains unmodified — Sync events are driven by scene-level callbacks.
- `PlayerProfile` in registry is the handoff point between overworld progression and battle.

---

---

## Element Effectiveness System

### Terminology

| Term | Meaning |
|------|---------|
| **Effective** | The attacking element is **strong against** the defender → ×1.25 |
| **Resisted** | The defending element **resists** the attacking element → ×0.75 |
| **Neutral** | No special relationship → ×1.0 |

> Precise distinction: **"Resisted" is about the defender**, not the attacker.
> A Fire attack being resisted by Water does NOT mean Water is strong against Fire.
> Conversely, Water being strong against Fire is a separate (symmetric) fact: Fire is weak to Water.
> Both derive from the same table entry but are stated from opposite perspectives.
>
> Never display "weak against" when the correct term is "resisted."
> Never say "super effective" — the game uses "effective."

### Why ×1.25 / ×0.75 and not ×2?

MONARIUM has many compounding mechanics: Aura costs, Soul Sync tiers (×0.85–×1.10),
Bond Level, guard (×0.30), crits (×1.5), and future Soul Burst / Ascension.
With all of these stacking, ×2.0 type advantage would be too swingy for the MVP.
**×1.25 / ×0.75 is the locked MVP range.**

### Official MVP Element List

| Element | ID |
|---------|----|
| Fire | `fire` |
| Water | `water` |
| Flora | `flora` |
| Wind | `wind` |
| Thunder | `thunder` |
| Stone | `stone` |
| Steel | `steel` |
| Light | `light` |
| Dark | `dark` |
| Aether | `aether` |
| Ice | `ice` |
| Neutral | `neutral` |

### Starter Triangle

```
Water → Fire  : Water effective vs Fire   / Fire resisted by Water
Fire  → Flora : Fire effective vs Flora   / Flora resisted by Fire
Flora → Water : Flora effective vs Water  / Water resisted by Flora
```

### MVP Locked Type Chart

Keyed by the **attacking** element (`src/config/elementEffectivenessConfig.ts`).
Edit `ELEMENT_CHART` in that file only — all helpers derive from it.

```
fire:    strongAgainst: [flora, steel, ice]         resistedBy: [water, stone]
water:   strongAgainst: [fire, stone]               resistedBy: [flora, thunder]
flora:   strongAgainst: [water, stone]              resistedBy: [fire, wind, ice]
wind:    strongAgainst: [flora]                     resistedBy: [thunder, ice]
thunder: strongAgainst: [water, wind]               resistedBy: [stone]
stone:   strongAgainst: [fire, thunder, wind, ice]  resistedBy: [water, flora, steel]
steel:   strongAgainst: [stone, ice]                resistedBy: [fire]
light:   strongAgainst: [dark]                      resistedBy: [aether]
dark:    strongAgainst: [aether]                    resistedBy: [light]
aether:  strongAgainst: [light]                     resistedBy: [dark, steel]
ice:     strongAgainst: [flora, wind, aether]       resistedBy: [fire, stone, steel]
neutral: strongAgainst: []                          resistedBy: []
```

### Expected Starter Matchup Results (Lv 7, Stable Sync, no guard)

| Attack vs Defender | Modifier | Battle callout |
|--------------------|----------|----------------|
| Fire vs Water | ×0.75 | "It was resisted!" |
| Water vs Fire | ×1.25 | "It was effective!" |
| Fire vs Flora | ×1.25 | "It was effective!" |
| Flora vs Fire | ×0.75 | "It was resisted!" |
| Flora vs Water | ×1.25 | "It was effective!" |
| Water vs Flora | ×0.75 | "It was resisted!" |
| Neutral vs anything | ×1.0 | (no message) |

### Battle Callouts

```
Flarepaw used Flame Paw Barrage!
It was resisted!

Droplet used Aqua Ripple!
It was effective!

Sproutodon used Bark Guard!

Flarepaw used Blinding Flare!
Soul Sync was disrupted!
```

### Implementation

- `src/config/elementEffectivenessConfig.ts` — single source of truth
- `getElementModifier(attacking, defending)` — returns ×1.25, ×0.75, or ×1.0
- `getEffectivenessLabel(modifier)` — returns `'effective'`, `'resisted'`, or `'neutral'`
- `getEffectivenessMessage(modifier)` — returns `"It was effective!"`, `"It was resisted!"`, or `null`
- `getEffectivenessBattleLabLabel(modifier)` — returns `"1.25× Effective"` etc. for Battle Lab

---

*Last updated: 2026-06-09. All mechanic values are tunable via `src/config/progressionConfig.ts`.*
