import { Fighter, GameState, SPECIALS } from './model';

const W = 1280, H = 720;
const TAU = Math.PI * 2;
const rounded = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

export class Painter {
  constructor(private c: CanvasRenderingContext2D) {}
  text(text: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'left', weight = '700') {
    const c = this.c; c.font = `${weight} ${size}px 'Space Grotesk', sans-serif`; c.textAlign = align; c.fillStyle = color; c.fillText(text, x, y);
  }
  title(text: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center') {
    const c = this.c; c.font = `${size}px 'Black Han Sans', sans-serif`; c.textAlign = align; c.fillStyle = color; c.fillText(text, x, y);
  }
  pill(x: number, y: number, w: number, h: number, fill: string, stroke = '') {
    const c = this.c; rounded(c, x, y, w, h, h / 2); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
  }
  backdrop(top = '#1f1650', bottom = '#0b0922') {
    const g = this.c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bottom); this.c.fillStyle = g; this.c.fillRect(0, 0, W, H);
  }
  mote(x: number, y: number, r: number, color: string, alpha = 1) {
    const c = this.c, g = c.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, color); g.addColorStop(.22, `${color}${Math.floor(alpha * 160).toString(16).padStart(2, '0')}`); g.addColorStop(1, 'transparent'); c.fillStyle = g; c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6); c.fillStyle = color; c.globalAlpha = alpha; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.globalAlpha = 1;
  }

  render(s: GameState) {
    const c = this.c; c.save(); c.translate((Math.random() - .5) * s.shake, (Math.random() - .5) * s.shake);
    if (s.mode === 'title') this.drawTitle(s); else if (s.mode === 'field' || s.mode === 'conversation') this.drawField(s); else this.drawDuel(s);
    this.drawEffects(s); if (s.mode === 'conversation') this.drawConversation(s); if (s.mode === 'result') this.drawResult(s);
    if (s.transition > 0) { c.fillStyle = `rgba(8,5,24,${s.transition})`; c.fillRect(-20, -20, W + 40, H + 40); }
    c.restore();
  }

  drawTitle(s: GameState) {
    this.backdrop('#1f1552', '#080617'); const c = this.c;
    const sun = c.createRadialGradient(640, 310, 20, 640, 310, 300); sun.addColorStop(0, '#ffdb6d55'); sun.addColorStop(.5, '#9b4cff22'); sun.addColorStop(1, 'transparent'); c.fillStyle = sun; c.fillRect(250, 0, 780, 650);
    for (let i = 0; i < 38; i++) this.mote((i * 173 + 80) % W, (i * 97 + Math.sin(s.clock + i) * 20) % H, i % 4 === 0 ? 2 : 1, i % 3 === 0 ? '#ffcf67' : '#aa8cff', .6);
    c.save(); c.translate(640, 345); c.rotate(-.04); c.strokeStyle = '#ffcf66'; c.lineWidth = 3; c.globalAlpha = .65; c.beginPath(); c.arc(0, 0, 205 + Math.sin(s.clock * 2) * 4, 0, TAU); c.stroke(); c.setLineDash([5, 15]); c.beginPath(); c.arc(0, 0, 230, 0, TAU); c.stroke(); c.restore();
    this.title('MONARIUM', 640, 270, 104, '#fff4d0'); this.title('SOUL DUEL', 640, 352, 74, '#ffb74e');
    this.text('BOND  /  BATTLE  /  BECOME', 640, 395, 15, '#baa9e8', 'center', '700');
    this.pill(492, 490, 296, 58, '#ffcc58', '#fff1af'); this.text('PRESS ENTER TO AWAKEN', 640, 527, 16, '#21133f', 'center', '700');
    this.text('CODEX PROTOTYPE  ·  v1.0', 640, 675, 12, '#786b9c', 'center');
  }

  drawField(s: GameState) {
    this.backdrop('#37226c', '#171333'); const c = this.c;
    const moon = c.createRadialGradient(1030, 130, 5, 1030, 130, 100); moon.addColorStop(0, '#fff4bd'); moon.addColorStop(.4, '#f6cf77'); moon.addColorStop(1, 'transparent'); c.fillStyle = moon; c.fillRect(860, 0, 340, 300);
    for (let i = 0; i < 30; i++) { const x = (i * 53) % W; const h = 90 + (i * 31) % 150; c.fillStyle = i % 2 ? '#211842' : '#2a1c51'; c.beginPath(); c.moveTo(x - 90, 300); c.lineTo(x, 300 - h); c.lineTo(x + 100, 300); c.fill(); }
    const field = c.createLinearGradient(0, 260, 0, H); field.addColorStop(0, '#4b3976'); field.addColorStop(1, '#1a1739'); c.fillStyle = field; c.beginPath(); c.moveTo(0, 300); c.quadraticCurveTo(420, 235, 760, 315); c.quadraticCurveTo(1030, 370, 1280, 275); c.lineTo(1280, H); c.lineTo(0, H); c.fill();
    c.strokeStyle = '#8a67ba33'; c.lineWidth = 2; for (let i = 0; i < 8; i++) { c.beginPath(); c.ellipse(650, 500, 130 + i * 85, 35 + i * 28, 0, 0, TAU); c.stroke(); }
    for (let i = 0; i < 15; i++) this.mote((i * 151) % W, 300 + (i * 83) % 330, 2 + i % 3, i % 2 ? '#ffcc67' : '#b993ff', .6);
    this.drawTrainer(s.rival.x, s.rival.y, '#8edfff', '#46347e', true); this.drawTrainer(s.hero.x, s.hero.y, '#ffbd5a', '#e95563', false);
    this.pill(28, 24, 292, 54, '#100b2bcc', '#8d75c066'); this.text('THE CELESTIAL TRAINING FIELD', 50, 47, 11, '#b69ee6'); this.text('Find Kael and challenge him', 50, 67, 14, '#fff');
    const near = Math.hypot(s.hero.x - s.rival.x, s.hero.y - s.rival.y) < 150;
    if (near) { this.pill(s.rival.x - 82, s.rival.y - 162, 164, 38, '#ffcf59', '#fff0a8'); this.text('E  CHALLENGE', s.rival.x, s.rival.y - 137, 13, '#26133d', 'center'); }
    if (s.hint > 0 && !near) { this.pill(460, 648, 360, 38, '#0d0925bb'); this.text('ARROW KEYS TO MOVE  ·  E TO INTERACT', 640, 673, 12, '#d9cdf6', 'center'); }
  }

  drawTrainer(x: number, y: number, glow: string, coat: string, rival: boolean) {
    const c = this.c; c.save(); c.translate(x, y); c.fillStyle = '#09071955'; c.beginPath(); c.ellipse(0, 32, 48, 14, 0, 0, TAU); c.fill(); this.mote(0, -40, 16, glow, .5);
    c.strokeStyle = '#19102b'; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(-13, 5); c.lineTo(-17, 31); c.moveTo(13, 5); c.lineTo(18, 31); c.stroke();
    c.fillStyle = coat; c.beginPath(); c.moveTo(-30, -65); c.quadraticCurveTo(0, -82, 30, -65); c.lineTo(24, 14); c.lineTo(-24, 14); c.fill();
    c.fillStyle = '#f2b28e'; c.beginPath(); c.arc(0, -85, 23, 0, TAU); c.fill(); c.fillStyle = rival ? '#d9edff' : '#241a40'; c.beginPath(); c.arc(0, -94, 25, Math.PI, TAU); c.lineTo(rival ? 30 : 18, -102); c.lineTo(18, -75); c.fill();
    c.fillStyle = glow; c.beginPath(); c.arc(rival ? -8 : 8, -85, 3, 0, TAU); c.fill(); c.restore();
  }

  drawConversation(s: GameState) {
    const lines = [
      ['KAEL', 'Your soul light reached all the way across the field.'],
      ['AMARI', 'Flarepaw and I are ready. No holding back this time.'],
      ['KAEL', 'Then show Droplet what your bond can do!'],
    ][Math.min(s.dialogue, 2)];
    const c = this.c; c.fillStyle = '#09061999'; c.fillRect(0, 0, W, H); rounded(c, 110, 490, 1060, 158, 24); c.fillStyle = '#171039ee'; c.fill(); c.strokeStyle = '#a887ed'; c.lineWidth = 2; c.stroke();
    this.pill(145, 468, 120, 38, '#ffcc58'); this.text(lines[0], 205, 493, 14, '#25133e', 'center'); this.text(lines[1], 155, 557, 22, '#f8f2ff'); this.text('E / ENTER', 1115, 619, 11, '#a894d0', 'right');
  }

  drawDuel(s: GameState) {
    this.backdrop('#23154f', '#0a0920'); const c = this.c;
    const sun = c.createRadialGradient(640, 320, 20, 640, 320, 250); sun.addColorStop(0, '#fbbd5b44'); sun.addColorStop(1, 'transparent'); c.fillStyle = sun; c.fillRect(280, 0, 720, 650);
    for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? '#2d2058' : '#251a4a'; c.beginPath(); c.moveTo(i * 150 - 100, 500); c.lineTo(i * 150 + 30, 170 + (i % 3) * 55); c.lineTo(i * 150 + 190, 500); c.fill(); }
    c.fillStyle = '#261f4d'; c.fillRect(0, 500, W, 220); c.strokeStyle = '#685097'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 570); c.lineTo(W, 570); c.stroke();
    for (const b of s.bolts) { this.mote(b.x, b.y, b.radius, b.color, .8); c.strokeStyle = b.color; c.lineWidth = 5; c.beginPath(); c.arc(b.x, b.y, b.radius * .7, s.clock * 5, s.clock * 5 + 4); c.stroke(); }
    for (const f of s.fighters) this.drawCreature(f, s.clock);
    this.drawHud(s);
  }

  drawCreature(f: Fighter, time: number) {
    const c = this.c, fire = f.id === 'flarepaw', bob = Math.sin(time * 5 + (fire ? 0 : 2)) * (f.grounded ? 4 : 0), alpha = f.dodge > 0 ? .42 : 1; c.save(); c.globalAlpha = alpha; c.translate(f.x, f.y + bob); c.scale(f.facing, 1);
    if (f.form > 0) { c.strokeStyle = '#ffbf55'; c.lineWidth = 5; c.globalAlpha = .5 + Math.sin(time * 12) * .2; c.beginPath(); c.ellipse(0, -68, 65, 96, 0, 0, TAU); c.stroke(); c.globalAlpha = alpha; }
    c.fillStyle = '#07061766'; c.beginPath(); c.ellipse(0, 9, 66, 18, 0, 0, TAU); c.fill();
    if (fire) this.flarepaw(c, f, time); else this.droplet(c, f, time); c.restore();
  }

  flarepaw(c: CanvasRenderingContext2D, f: Fighter, time: number) {
    c.strokeStyle = '#5b1a36'; c.lineWidth = 23; c.lineCap = 'round'; c.beginPath(); c.moveTo(-22, -42); c.lineTo(-40, -4); c.moveTo(23, -42); c.lineTo(41, -4); c.stroke();
    c.fillStyle = '#f36b49'; c.beginPath(); c.ellipse(0, -67, 48, 58, 0, 0, TAU); c.fill(); c.fillStyle = '#ffc65e'; c.beginPath(); c.ellipse(7, -57, 25, 34, .2, 0, TAU); c.fill();
    c.fillStyle = '#f36b49'; c.beginPath(); c.arc(0, -119, 43, 0, TAU); c.fill(); c.beginPath(); c.moveTo(-34, -142); c.lineTo(-48, -181); c.lineTo(-10, -153); c.moveTo(27, -145); c.lineTo(46, -178); c.lineTo(45, -132); c.fill();
    c.fillStyle = '#3a1932'; c.beginPath(); c.moveTo(-26, -133); c.lineTo(-7, -128); c.lineTo(-24, -121); c.moveTo(25, -133); c.lineTo(7, -128); c.lineTo(24, -121); c.fill();
    c.fillStyle = '#ffe56d'; c.beginPath(); c.arc(-17, -129, 4, 0, TAU); c.arc(17, -129, 4, 0, TAU); c.fill();
    if (f.attack > 0) { const reach = f.attackKind === 'charge' ? 105 : 70; this.mote(reach, -58, f.attackKind === 'soulburst' ? 46 : 25, f.attackKind === 'soulburst' ? '#fff06b' : '#ff6f4d', .9); }
    if (f.guard) { c.strokeStyle = '#ffca64'; c.lineWidth = 7; c.beginPath(); c.arc(12, -75, 75, -1.2, 1.2); c.stroke(); }
  }

  droplet(c: CanvasRenderingContext2D, f: Fighter, time: number) {
    c.fillStyle = '#4dbbe8'; c.beginPath(); c.ellipse(0, -63, 50, 62, 0, 0, TAU); c.fill(); c.fillStyle = '#9cf0ff'; c.beginPath(); c.ellipse(-12, -76, 25, 38, -.4, 0, TAU); c.fill();
    c.fillStyle = '#55c9ef'; c.beginPath(); c.arc(0, -126, 44, 0, TAU); c.fill(); c.beginPath(); c.moveTo(-35, -146); c.quadraticCurveTo(-12, -190 + Math.sin(time * 3) * 6, 3, -160); c.quadraticCurveTo(27, -192, 36, -142); c.fill();
    c.fillStyle = '#15244c'; c.beginPath(); c.ellipse(-15, -128, 5, 8, 0, 0, TAU); c.ellipse(15, -128, 5, 8, 0, 0, TAU); c.fill();
    c.strokeStyle = '#d1f8ff'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(-25, -48); c.lineTo(-46, -13); c.moveTo(25, -48); c.lineTo(46, -13); c.stroke();
    if (f.guard) { c.strokeStyle = '#8ceaff'; c.lineWidth = 7; c.beginPath(); c.arc(12, -75, 75, -1.2, 1.2); c.stroke(); }
  }

  drawHud(s: GameState) {
    const c = this.c, p = s.fighters[0], e = s.fighters[1];
    c.fillStyle = '#09071dcc'; c.fillRect(0, 0, W, 112); this.text('FLAREPAW', 48, 35, 17, '#ffca67'); this.text('FIRE  ·  BOND LV. 12', 48, 55, 10, '#b8a6dc');
    this.text('DROPLET', 1232, 35, 17, '#81e4ff', 'right'); this.text('WATER  ·  BOND LV. 11', 1232, 55, 10, '#b8a6dc', 'right');
    this.bar(48, 69, 430, 17, p.hp, '#ff604d', false); this.bar(802, 69, 430, 17, e.hp, '#55cdeb', true);
    this.bar(1012, 94, 220, 7, e.aura, '#6f9fff', true); this.text(`AURA ${Math.ceil(e.aura)}`, 1232, 91, 8, '#a8caff', 'right');
    this.pill(555, 18, 170, 60, '#171039', '#6c55a5'); this.title('SOUL DUEL', 640, 55, 20, '#f9dc7a');
    this.pill(24, 628, 490, 68, '#0b0823dd', '#7253a5'); this.text(`${s.selected + 1}`, 52, 670, 24, '#ffcc64'); this.text(SPECIALS[s.selected].name, 88, 658, 15, '#fff'); this.text(`${SPECIALS[s.selected].cost} AURA  ·  ${SPECIALS[s.selected].note}`, 88, 678, 10, '#ab99cc');
    this.bar(540, 652, 285, 11, p.aura, '#8d6bff', false); this.text('AURA', 540, 641, 9, '#c0afe7'); this.bar(850, 652, 285, 11, p.soul, '#ffcf53', false); this.text('SOULBOND  ·  U', 850, 641, 9, '#e8c971');
    this.text('J ATTACK   K SPECIAL   L STEP   I MAGMAFORGE', 640, 708, 10, '#9786bd', 'center');
  }

  bar(x: number, y: number, w: number, h: number, amount: number, color: string, reverse: boolean) {
    this.pill(x, y, w, h, '#251c43'); const fill = Math.max(0, w * amount / 100); this.pill(reverse ? x + w - fill : x, y, fill, h, color);
  }

  drawEffects(s: GameState) {
    const c = this.c; for (const spark of s.sparks) { c.globalAlpha = Math.max(0, spark.life / spark.max); c.fillStyle = spark.color; c.beginPath(); c.arc(spark.x, spark.y, spark.size, 0, TAU); c.fill(); } c.globalAlpha = 1;
    for (const pop of s.pops) { c.globalAlpha = Math.min(1, pop.life * 3); this.title(pop.text, pop.x, pop.y, 22, pop.color); } c.globalAlpha = 1;
  }

  drawResult(s: GameState) {
    const c = this.c; c.fillStyle = '#09061caa'; c.fillRect(0, 0, W, H); const win = s.result === 'victory'; this.text(win ? 'SOUL RESONANCE COMPLETE' : 'THE BOND ENDURES', 640, 255, 15, win ? '#ffce5e' : '#89dcff', 'center'); this.title(win ? 'VICTORY' : 'DEFEAT', 640, 350, 92, win ? '#fff0a6' : '#d5f6ff'); this.text(win ? 'Flarepaw’s bond burns brighter.' : 'Train. Bond. Rise again.', 640, 395, 20, '#d6c9ef', 'center'); this.pill(530, 460, 220, 52, '#ffcc59'); this.text('ENTER  ·  RETURN', 640, 493, 14, '#25133d', 'center');
  }
}
