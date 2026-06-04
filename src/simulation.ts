import { Input } from './input';
import { Fighter, GameState, SPECIALS, freshFighter } from './model';

const FLOOR = 570;
const AQUA_KNUCKLE_COST = 25;
const AQUA_KNUCKLE_COOLDOWN = 1.5;
const AQUA_KNUCKLE_CHANCE = .4;
const AQUA_KNUCKLE_REGEN_DELAY = .5;
const DROPLET_AURA_REGEN = 6;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const other = (state: GameState, fighter: Fighter) => state.fighters[fighter.id === 'flarepaw' ? 1 : 0];

function burst(state: GameState, x: number, y: number, color: string, count = 12, force = 220) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = force * (.3 + Math.random() * .7);
    state.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .3 + Math.random() * .35, max: .65, color, size: 2 + Math.random() * 7 });
  }
}

function hit(state: GameState, attacker: Fighter, damage: number, range = 125, launch = 80) {
  const target = other(state, attacker);
  if (target.dodge > 0 || Math.abs(target.x - attacker.x) > range || Math.abs(target.y - attacker.y) > 100) return false;
  const guarded = target.guard;
  const actual = guarded ? damage * .25 : damage * (attacker.form > 0 ? 1.25 : 1);
  target.hp = clamp(target.hp - actual, 0, 100);
  target.vx = attacker.facing * (guarded ? launch * .35 : launch);
  target.vy = guarded ? -25 : -launch * .35;
  target.stagger = guarded ? .1 : .22;
  attacker.soul = clamp(attacker.soul + actual * 1.3, 0, 100);
  state.shake = guarded ? 3 : 8;
  burst(state, target.x, target.y - 70, guarded ? '#9deaff' : attacker.id === 'flarepaw' ? '#ff8b44' : '#74dcff', guarded ? 7 : 16);
  state.pops.push({ x: target.x, y: target.y - 130, text: `${Math.ceil(actual)}`, color: guarded ? '#9deaff' : '#fff3b0', life: .7 });
  return true;
}

function beginAttack(state: GameState, fighter: Fighter, kind: string, duration: number) {
  fighter.attackKind = kind; fighter.attack = duration; fighter.cooldown = duration + .08;
}

function updatePlayer(state: GameState, input: Input, dt: number) {
  const p = state.fighters[0];
  if (p.stagger > 0) return;
  p.guard = input.down('ArrowDown', 'KeyS') && p.grounded && p.attack <= 0;
  const movable = p.attack <= 0 && p.dodge <= 0 && !p.guard;
  if (movable) {
    const dir = Number(input.down('ArrowRight', 'KeyD')) - Number(input.down('ArrowLeft', 'KeyA'));
    p.vx += dir * 1350 * dt;
    if (dir) p.facing = dir;
    if (input.pressed('ArrowUp', 'KeyW') && p.grounded) { p.vy = -570; p.grounded = false; burst(state, p.x, FLOOR, '#ffc86b', 5, 90); }
  }
  if (input.pressed('Digit1', 'Numpad1')) state.selected = 0;
  if (input.pressed('Digit2', 'Numpad2')) state.selected = 1;
  if (input.pressed('Digit3', 'Numpad3')) state.selected = 2;
  if (input.pressed('Digit4', 'Numpad0', 'Numpad4')) state.selected = 3;
  if (p.cooldown <= 0 && input.pressed('KeyJ')) {
    p.combo = p.comboWindow > 0 ? (p.combo % 3) + 1 : 1; p.comboWindow = .52;
    beginAttack(state, p, `palm${p.combo}`, .28 + p.combo * .035);
    setTimeout(() => hit(state, p, 4 + p.combo * 2, 115 + p.combo * 8, 90 + p.combo * 45), 95);
  }
  if (p.cooldown <= 0 && input.pressed('KeyK')) useSpecial(state, p, state.selected);
  if (p.cooldown <= 0 && input.pressed('KeyL')) { p.dodge = .38; p.vx = p.facing * 680; p.cooldown = .5; burst(state, p.x, p.y - 60, '#ffe5a6', 14); }
  if (input.pressed('KeyI') && p.form <= 0 && p.aura >= 50) { p.aura -= 50; p.form = 8; burst(state, p.x, p.y - 70, '#ff4e64', 30, 330); }
  if (input.pressed('KeyU') && p.soul >= 100 && p.cooldown <= 0) {
    p.soul = 0; beginAttack(state, p, 'soulburst', 1.2); state.shake = 18;
    for (let i = 0; i < 6; i++) setTimeout(() => { hit(state, p, 7, 330, 60); burst(state, other(state, p).x, other(state, p).y - 70, '#ffe16b', 12, 300); }, 120 + i * 120);
  }
}

function useSpecial(state: GameState, p: Fighter, index: number) {
  const move = SPECIALS[index];
  if (p.aura < move.cost) { state.pops.push({ x: p.x, y: p.y - 140, text: 'LOW AURA', color: '#a9c8ff', life: .8 }); return; }
  p.aura -= move.cost;
  if (index === 0) { beginAttack(state, p, 'claws', .65); for (let i = 0; i < 3; i++) setTimeout(() => hit(state, p, 5, 145, 60), 100 + i * 135); }
  if (index === 1) { beginAttack(state, p, 'charge', .55); p.vx = p.facing * 900; setTimeout(() => hit(state, p, 15, 175, 330), 230); }
  if (index === 2) { beginAttack(state, p, 'vortex', .5); state.bolts.push({ x: p.x + p.facing * 60, y: p.y - 65, vx: p.facing * 500, owner: p.id, damage: 15, life: 1.7, color: move.color, radius: 34 }); }
  if (index === 3) { beginAttack(state, p, 'flameguard', .4); p.guard = true; p.aura = clamp(p.aura + 8, 0, 100); burst(state, p.x, p.y - 60, move.color, 24, 180); }
}

function updateAI(state: GameState, dt: number) {
  const ai = state.fighters[1], p = state.fighters[0];
  if (ai.stagger > 0) return;
  ai.guard = ai.attackKind === 'guard' && ai.attack > 0;
  ai.facing = p.x < ai.x ? -1 : 1;
  const distance = Math.abs(ai.x - p.x);
  if (ai.cooldown <= 0) {
    const roll = Math.random();
    const canAquaKnuckle = distance > 260 && ai.aquaCooldown <= 0 && ai.aura >= AQUA_KNUCKLE_COST;
    if (canAquaKnuckle && roll < AQUA_KNUCKLE_CHANCE) {
      beginAttack(state, ai, 'aquaKnuckle', .6); ai.cooldown = .75; ai.aquaCooldown = AQUA_KNUCKLE_COOLDOWN;
      ai.aura -= AQUA_KNUCKLE_COST; ai.auraRegenDelay = AQUA_KNUCKLE_REGEN_DELAY;
      state.bolts.push({ x: ai.x + ai.facing * 50, y: ai.y - 75, vx: ai.facing * 390, owner: ai.id, damage: 9, life: 2.2, color: '#66e0ff', radius: 23 });
      state.pops.push({ x: ai.x, y: ai.y - 170, text: 'AQUA KNUCKLE', color: '#9eeeff', life: .7 });
    } else if (distance < 150) {
      beginAttack(state, ai, roll < .45 ? 'pounce' : 'swipe', .5); ai.vx = ai.facing * (roll < .45 ? 540 : 130);
      setTimeout(() => hit(state, ai, roll < .45 ? 12 : 7, 145, 210), 180);
      ai.cooldown = .85 + Math.random() * .5;
    } else if (distance > 260 && roll < .62 && ai.grounded) {
      ai.vy = -500; ai.grounded = false; ai.vx += ai.facing * 210; ai.cooldown = .5;
    } else if (distance > 170) { ai.vx += ai.facing * 700 * dt; ai.cooldown = .25; }
    else { beginAttack(state, ai, 'guard', .35); ai.guard = true; ai.vx -= ai.facing * 180; }
  }
  if (p.attack > 0 && distance < 170 && ai.cooldown <= 0 && Math.random() < .08) { beginAttack(state, ai, 'guard', .35); ai.guard = true; }
}

function updateDuel(state: GameState, input: Input, dt: number) {
  updatePlayer(state, input, dt); updateAI(state, dt);
  for (const f of state.fighters) {
    f.cooldown -= dt; f.aquaCooldown -= dt; f.auraRegenDelay -= dt; f.stagger -= dt; f.dodge -= dt; f.attack -= dt; f.comboWindow -= dt; f.form -= dt;
    const auraRegen = f.id === 'droplet' ? DROPLET_AURA_REGEN : 4;
    if (f.auraRegenDelay <= 0) f.aura = clamp(f.aura + dt * auraRegen, 0, 100);
    f.vy += 1450 * dt; f.x += f.vx * dt; f.y += f.vy * dt;
    f.vx *= Math.pow(f.grounded ? .0005 : .08, dt); f.x = clamp(f.x, 85, 1195);
    if (f.y >= FLOOR) { f.y = FLOOR; f.vy = 0; f.grounded = true; } else f.grounded = false;
  }
  for (const b of state.bolts) {
    b.x += b.vx * dt; b.life -= dt;
    const target = state.fighters[b.owner === 'flarepaw' ? 1 : 0];
    if (b.life > 0 && Math.abs(b.x - target.x) < b.radius + 32 && Math.abs(b.y - (target.y - 65)) < b.radius + 50) {
      const owner = state.fighters[b.owner === 'flarepaw' ? 0 : 1]; hit(state, owner, b.damage, 9999, 170); b.life = 0; burst(state, b.x, b.y, b.color, 18, 260);
    }
  }
  state.bolts = state.bolts.filter((b) => b.life > 0 && b.x > -100 && b.x < 1380);
  const loser = state.fighters.find((f) => f.hp <= 0);
  if (loser) { state.result = loser.id === 'droplet' ? 'victory' : 'defeat'; state.mode = 'result'; state.transition = 1; }
}

function updateField(state: GameState, input: Input, dt: number) {
  const speed = 260;
  const dx = Number(input.down('ArrowRight', 'KeyD')) - Number(input.down('ArrowLeft', 'KeyA'));
  const dy = Number(input.down('ArrowDown', 'KeyS')) - Number(input.down('ArrowUp', 'KeyW'));
  const mag = Math.hypot(dx, dy) || 1; state.hero.x = clamp(state.hero.x + dx / mag * speed * dt, 80, 1200); state.hero.y = clamp(state.hero.y + dy / mag * speed * dt, 240, 610);
  const near = Math.hypot(state.hero.x - state.rival.x, state.hero.y - state.rival.y) < 150;
  if (near && input.pressed('KeyE', 'Enter', 'Space')) { state.mode = 'conversation'; state.dialogue = 0; }
  state.hint = near ? 1 : Math.max(0, state.hint - dt);
}

export function step(state: GameState, input: Input, rawDt: number) {
  const dt = Math.min(rawDt, .033); state.clock += dt; state.transition = Math.max(0, state.transition - dt * 2.2); state.shake *= Math.pow(.02, dt);
  if (state.mode === 'title' && input.pressed('Enter', 'Space', 'KeyE')) { state.mode = 'field'; state.transition = 1; }
  else if (state.mode === 'field') updateField(state, input, dt);
  else if (state.mode === 'conversation' && input.pressed('Enter', 'Space', 'KeyE')) {
    state.dialogue++; if (state.dialogue > 2) { state.mode = 'duel'; state.fighters = [freshFighter('flarepaw'), freshFighter('droplet')]; state.bolts = []; state.transition = 1; }
  } else if (state.mode === 'duel') updateDuel(state, input, dt);
  else if (state.mode === 'result' && input.pressed('Enter', 'Space', 'KeyE')) { state.mode = 'field'; state.hero = { x: 750, y: 470 }; state.transition = 1; }
  for (const s of state.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 400 * dt; s.life -= dt; }
  for (const p of state.pops) { p.y -= 45 * dt; p.life -= dt; }
  state.sparks = state.sparks.filter((s) => s.life > 0); state.pops = state.pops.filter((p) => p.life > 0); input.endFrame();
}
