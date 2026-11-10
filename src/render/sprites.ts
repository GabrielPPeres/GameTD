import type { EnemyDef } from '../game/enemies';
import type { TowerDef } from '../game/towers';

type Ctx = CanvasRenderingContext2D;

export interface TowerLook {
  def: TowerDef;
  tiers: readonly [number, number];
  angle: number;
  recoil: number;
  flash: number;
}

export interface EnemyLook {
  def: EnemyDef;
  angle: number;
  bob: number;
  hp: number;
  maxHp: number;
  slow: number;
  stunTimer: number;
  burnTimer: number;
  flash: number;
  revealed?: number;
}

const circle = (ctx: Ctx, x: number, y: number, r: number) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
};

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

// ───────────────────────────── torres ─────────────────────────────

function stoneBase(ctx: Ctx, r: number, inner: string, gold: boolean) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(3, 5, r * 1.05, r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.2, 0, 0, r);
  g.addColorStop(0, '#b2bec3');
  g.addColorStop(1, '#636e72');
  ctx.fillStyle = g;
  circle(ctx, 0, 0, r);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = gold ? '#f9ca24' : '#3d4648';
  ctx.stroke();
  // pedras do anel
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.fillStyle = inner;
  circle(ctx, 0, 0, r * 0.72);
  ctx.fill();
}

function drawArcher(ctx: Ctx, t: TowerLook) {
  const [a, b] = t.tiers;
  stoneBase(ctx, t.def.radius, '#8d5a2b', a === 4 || b === 4);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-10, i * 4);
    ctx.lineTo(10, i * 4);
    ctx.stroke();
  }
  ctx.rotate(t.angle);
  const pull = t.recoil * 3;
  const bowColor = a === 4 ? '#f9ca24' : b === 4 ? '#ff7675' : '#5d3a1a';
  // arqueiro (capuz)
  ctx.fillStyle = b >= 2 ? '#2d6a4f' : '#6c4f3d';
  circle(ctx, -3, 0, 6.5);
  ctx.fill();
  ctx.fillStyle = '#f5cba7';
  circle(ctx, -1, 0, 3);
  ctx.fill();
  // arco
  ctx.strokeStyle = bowColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(2, 0, 11, -1.15, 1.15);
  ctx.stroke();
  ctx.strokeStyle = '#ecf0f1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(2 + Math.cos(-1.15) * 11, Math.sin(-1.15) * 11);
  ctx.lineTo(2 - pull, 0);
  ctx.lineTo(2 + Math.cos(1.15) * 11, Math.sin(1.15) * 11);
  ctx.stroke();
  const arrows = a >= 3 ? 3 : 1;
  for (let i = 0; i < arrows; i++) {
    const off = (i - (arrows - 1) / 2) * 3.5;
    ctx.strokeStyle = b >= 3 ? '#ff9f43' : '#dfe6e9';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-4 - pull, off);
    ctx.lineTo(15 - pull, off);
    ctx.stroke();
    ctx.fillStyle = b >= 3 ? '#ff6b1a' : '#b2bec3';
    ctx.beginPath();
    ctx.moveTo(18 - pull, off);
    ctx.lineTo(13 - pull, off - 2.5);
    ctx.lineTo(13 - pull, off + 2.5);
    ctx.fill();
  }
}

function drawCannon(ctx: Ctx, t: TowerLook) {
  const [a, b] = t.tiers;
  stoneBase(ctx, t.def.radius, '#2d3436', a === 4 || b === 4);
  ctx.rotate(t.angle);
  const back = t.recoil * 5;
  const barrels = b === 4 ? [-5, 5] : [0];
  const width = a >= 4 ? 13 : a >= 2 ? 11 : 9;
  for (const off of barrels) {
    const g = ctx.createLinearGradient(0, off - width / 2, 0, off + width / 2);
    g.addColorStop(0, '#636e72');
    g.addColorStop(0.5, '#b2bec3');
    g.addColorStop(1, '#2d3436');
    ctx.fillStyle = g;
    ctx.fillRect(-2 - back, off - width / 2, 24, width);
    ctx.fillStyle = a >= 4 ? '#d63031' : '#1e272e';
    ctx.fillRect(18 - back, off - width / 2 - 1.5, 5, width + 3);
    if (b >= 3) {
      ctx.fillStyle = '#e17055';
      ctx.fillRect(8 - back, off - width / 2, 3, width);
    }
  }
  const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 10);
  g.addColorStop(0, '#95a5a6');
  g.addColorStop(1, '#2d3436');
  ctx.fillStyle = g;
  circle(ctx, 0, 0, 9.5);
  ctx.fill();
  if (a >= 3) {
    ctx.fillStyle = '#fdcb6e';
    for (let i = 0; i < 3; i++) {
      circle(ctx, -4 + i * 4, 0, 1.6);
      ctx.fill();
    }
  }
}

function drawFrost(ctx: Ctx, t: TowerLook, time: number) {
  const [a, b] = t.tiers;
  stoneBase(ctx, t.def.radius, '#dff9fb', a === 4 || b === 4);
  const glow = 0.35 + t.flash * 2;
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
  g.addColorStop(0, `rgba(129,236,236,${Math.min(0.9, glow)})`);
  g.addColorStop(1, 'rgba(129,236,236,0)');
  ctx.fillStyle = g;
  circle(ctx, 0, 0, 22);
  ctx.fill();
  const shards = 3 + Math.max(a, b);
  ctx.rotate(time * 0.6);
  for (let i = 0; i < shards; i++) {
    ctx.save();
    ctx.rotate((i / shards) * Math.PI * 2);
    ctx.fillStyle = b >= 3 ? '#0abde3' : '#c7ecee';
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(3, -7);
    ctx.lineTo(0, -4);
    ctx.lineTo(-3, -7);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = a >= 4 ? '#ffffff' : '#74b9ff';
  ctx.strokeStyle = '#0984e3';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(7, 0);
  ctx.lineTo(0, 9);
  ctx.lineTo(-7, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(3, -1);
  ctx.lineTo(-2, -1);
  ctx.fill();
}

function drawTesla(ctx: Ctx, t: TowerLook, time: number) {
  const [a, b] = t.tiers;
  stoneBase(ctx, t.def.radius, '#2d3436', a === 4 || b === 4);
  const rings = 3 + (a >= 3 ? 1 : 0);
  for (let i = 0; i < rings; i++) {
    const rr = 11 - i * 2.2;
    ctx.fillStyle = i % 2 ? '#d35400' : '#e17055';
    ctx.strokeStyle = '#6e2c00';
    ctx.lineWidth = 1;
    circle(ctx, 0, -i * 3, rr);
    ctx.fill();
    ctx.stroke();
  }
  const top = -rings * 3 - 2;
  const pulse = 0.6 + Math.sin(time * 12) * 0.2 + t.flash * 3;
  const g = ctx.createRadialGradient(0, top, 1, 0, top, 14);
  g.addColorStop(0, b >= 3 ? `rgba(255,234,167,${Math.min(1, pulse)})` : `rgba(162,155,254,${Math.min(1, pulse)})`);
  g.addColorStop(1, 'rgba(108,92,231,0)');
  ctx.fillStyle = g;
  circle(ctx, 0, top, 14);
  ctx.fill();
  ctx.fillStyle = b >= 3 ? '#ffeaa7' : '#dcd6ff';
  circle(ctx, 0, top, 4.5);
  ctx.fill();
  if (t.flash > 0 || Math.random() < 0.08) {
    ctx.strokeStyle = '#dcd6ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const ang = Math.random() * Math.PI * 2;
    ctx.moveTo(0, top);
    ctx.lineTo(Math.cos(ang) * 7 + (Math.random() - 0.5) * 4, top + Math.sin(ang) * 7);
    ctx.lineTo(Math.cos(ang) * 12, top + Math.sin(ang) * 12);
    ctx.stroke();
  }
}

function drawSniper(ctx: Ctx, t: TowerLook) {
  const [a, b] = t.tiers;
  stoneBase(ctx, t.def.radius, '#3b6e3b', a === 4 || b === 4);
  // manchas de camuflagem
  ctx.fillStyle = 'rgba(30,61,30,0.6)';
  circle(ctx, -4, 3, 3);
  ctx.fill();
  circle(ctx, 4, -4, 2.5);
  ctx.fill();
  ctx.rotate(t.angle);
  const back = t.recoil * 3;
  ctx.fillStyle = '#1e272e';
  ctx.fillRect(0 - back, -2, a >= 3 ? 30 : 26, 4);
  ctx.fillStyle = a >= 4 ? '#f9ca24' : '#2d3436';
  ctx.fillRect((a >= 3 ? 27 : 23) - back, -3, 4, 6);
  ctx.fillStyle = b >= 1 ? '#00b894' : '#636e72';
  ctx.fillRect(4 - back, -5.5, 9, 3);
  ctx.fillStyle = '#556b2f';
  circle(ctx, -3, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#3d4f22';
  circle(ctx, -4, 0, 4);
  ctx.fill();
}

function drawPrism(ctx: Ctx, t: TowerLook, time: number) {
  const [a, b] = t.tiers;
  stoneBase(ctx, t.def.radius, '#341f97', a === 4 || b === 4);
  ctx.rotate(t.angle + Math.PI / 2);
  const size = 11 + Math.max(a, b);
  const g = ctx.createLinearGradient(-size, 0, size, 0);
  const hue = (time * 60) % 360;
  g.addColorStop(0, `hsl(${hue},90%,70%)`);
  g.addColorStop(0.5, '#ffffff');
  g.addColorStop(1, `hsl(${(hue + 120) % 360},90%,70%)`);
  ctx.fillStyle = g;
  ctx.strokeStyle = '#f368e0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.87, size * 0.5);
  ctx.lineTo(-size * 0.87, size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (b >= 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    circle(ctx, 0, 0, 2.5 + b * 0.5);
    ctx.fill();
  }
}

function drawMine(ctx: Ctx, t: TowerLook) {
  const [a, b] = t.tiers;
  const r = t.def.radius;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(3, 5, r * 1.05, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(-6, -8, 2, 0, 0, r);
  g.addColorStop(0, '#a1887f');
  g.addColorStop(1, '#5d4037');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = a === 4 || b === 4 ? '#f9ca24' : '#3e2723';
  ctx.lineWidth = 2;
  ctx.stroke();
  // entrada
  ctx.fillStyle = '#1b1b1b';
  ctx.beginPath();
  ctx.arc(0, 6, 8, Math.PI, 0);
  ctx.lineTo(8, 10);
  ctx.lineTo(-8, 10);
  ctx.fill();
  ctx.strokeStyle = '#8d6e63';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 6, 8.5, Math.PI, 0);
  ctx.stroke();
  // ouro
  const nuggets = 2 + a * 2 + b;
  ctx.fillStyle = '#feca57';
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 1;
  for (let i = 0; i < nuggets; i++) {
    const ang = -Math.PI * 0.9 + (i / Math.max(1, nuggets - 1)) * Math.PI * 0.8;
    const x = Math.cos(ang) * (r * 0.62);
    const y = Math.sin(ang) * (r * 0.62) - 1;
    circle(ctx, x, y, 2.6);
    ctx.fill();
    ctx.stroke();
  }
  if (b >= 2) {
    ctx.fillStyle = '#1dd1a1';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, -3);
  }
}

function drawTotem(ctx: Ctx, t: TowerLook, time: number) {
  const [a, b] = t.tiers;
  stoneBase(ctx, t.def.radius, '#4e342e', a === 4 || b === 4);
  const wing = a >= b ? '#ff6b6b' : '#48dbfb';
  const flap = Math.sin(time * 3) * 2;
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(-5, -12);
  ctx.lineTo(-16, -16 + flap);
  ctx.lineTo(-6, -6);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(5, -12);
  ctx.lineTo(16, -16 + flap);
  ctx.lineTo(6, -6);
  ctx.fill();
  ctx.fillStyle = '#a1887f';
  ctx.strokeStyle = '#3e2723';
  ctx.lineWidth = 1.5;
  ctx.fillRect(-6, -16, 12, 26);
  ctx.strokeRect(-6, -16, 12, 26);
  // rostos esculpidos
  for (const fy of [-10, 2]) {
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(-4, fy, 2.5, 2.5);
    ctx.fillRect(1.5, fy, 2.5, 2.5);
    ctx.fillStyle = fy < 0 ? '#ee5253' : '#feca57';
    ctx.fillRect(-3, fy + 4, 6, 2);
  }
  const tier = Math.max(a, b);
  if (tier >= 3) {
    ctx.fillStyle = '#f9ca24';
    ctx.beginPath();
    ctx.moveTo(-5, -16);
    ctx.lineTo(-3, -21);
    ctx.lineTo(0, -17);
    ctx.lineTo(3, -21);
    ctx.lineTo(5, -16);
    ctx.fill();
  }
}

export function drawTower(ctx: Ctx, t: TowerLook, x: number, y: number, time: number): void {
  ctx.save();
  ctx.translate(x, y);
  switch (t.def.id) {
    case 'archer':
      drawArcher(ctx, t);
      break;
    case 'cannon':
      drawCannon(ctx, t);
      break;
    case 'frost':
      drawFrost(ctx, t, time);
      break;
    case 'tesla':
      drawTesla(ctx, t, time);
      break;
    case 'sniper':
      drawSniper(ctx, t);
      break;
    case 'prism':
      drawPrism(ctx, t, time);
      break;
    case 'mine':
      drawMine(ctx, t);
      break;
    case 'totem':
      drawTotem(ctx, t, time);
      break;
  }
  ctx.restore();
}

export function drawTierPips(ctx: Ctx, t: TowerLook, x: number, y: number): void {
  const [a, b] = t.tiers;
  const total = a + b;
  if (!total) return;
  const cols = t.def.paths;
  let px = x - ((total - 1) * 5) / 2;
  const py = y + t.def.radius + 5;
  for (let p = 0; p < 2; p++) {
    for (let i = 0; i < t.tiers[p]; i++) {
      ctx.fillStyle = cols[p].color;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      circle(ctx, px, py, 2.2);
      ctx.fill();
      ctx.stroke();
      px += 5;
    }
  }
}

// ───────────────────────────── inimigos ─────────────────────────────

export function drawEnemy(ctx: Ctx, e: EnemyLook, x: number, y: number, time: number): void {
  const def = e.def;
  const r = def.radius;
  const squash = Math.sin(e.bob * 2) * 0.07;
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.75, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  const revealed = (e.revealed ?? 0) > 0;
  const stealthy = def.stealth && !revealed;
  if (stealthy) ctx.globalAlpha = 0.6 + Math.sin(time * 3 + e.bob) * 0.12;
  if (def.stealth && revealed) {
    ctx.strokeStyle = 'rgba(129,236,236,0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    circle(ctx, 0, 0, r + 4);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // rastro de fumaça para furtivos
  if (stealthy) {
    ctx.fillStyle = shade(def.color, -40);
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha *= 0.75;
      circle(ctx, -Math.cos(e.angle) * r * 0.6 * i, -Math.sin(e.angle) * r * 0.6 * i + Math.sin(e.bob + i) * 2, r * (0.7 - i * 0.12));
      ctx.fill();
    }
    ctx.globalAlpha = 0.6 + Math.sin(time * 3 + e.bob) * 0.12;
  }

  if (def.id === 'runner' || def.id === 'swarm') {
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      const bx = -Math.cos(e.angle) * (r + 3);
      const by = -Math.sin(e.angle) * (r + 3) + i * 4;
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - Math.cos(e.angle) * 7, by - Math.sin(e.angle) * 7);
      ctx.stroke();
    }
  }

  ctx.save();
  ctx.scale(1 - squash, 1 + squash);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.15, 0, 0, r * 1.05);
  g.addColorStop(0, shade(def.color, 45));
  g.addColorStop(0.7, def.color);
  g.addColorStop(1, def.dark);
  ctx.fillStyle = g;
  if (def.id === 'golem' || def.id === 'titan') {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = r * (i % 2 ? 0.92 : 1.02);
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
  } else {
    circle(ctx, 0, 0, r);
  }
  ctx.fill();
  ctx.lineWidth = def.boss ? 3 : 2;
  ctx.strokeStyle = def.dark;
  ctx.stroke();

  // detalhes por tipo
  switch (def.id) {
    case 'brute':
    case 'colossus':
      ctx.fillStyle = '#95a5a6';
      ctx.strokeStyle = '#2d3436';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.98, Math.PI * 1.1, Math.PI * 1.9);
      ctx.lineTo(0, -r * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#dfe6e9';
      for (const rx of [-0.45, 0, 0.45]) {
        circle(ctx, rx * r, -r * 0.62, 1.6);
        ctx.fill();
      }
      break;
    case 'golem':
    case 'titan':
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.2);
      ctx.lineTo(-r * 0.2, r * 0.1);
      ctx.lineTo(-r * 0.3, r * 0.5);
      ctx.moveTo(r * 0.5, -r * 0.5);
      ctx.lineTo(r * 0.3, -r * 0.1);
      ctx.stroke();
      if (def.id === 'titan') {
        ctx.fillStyle = '#1dd1a1';
        circle(ctx, 0, r * 0.45, r * 0.12);
        ctx.fill();
      }
      break;
    case 'splitter':
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + e.bob * 0.3;
        circle(ctx, Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45 + r * 0.15, r * 0.2);
        ctx.fill();
      }
      break;
    case 'regen':
      ctx.fillStyle = '#10ac84';
      ctx.beginPath();
      ctx.ellipse(r * 0.2, -r * 1.0, r * 0.25, r * 0.5, 0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'healer':
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-r * 0.12, -r * 0.95, r * 0.24, r * 0.6);
      ctx.fillRect(-r * 0.3, -r * 0.77, r * 0.6, r * 0.24);
      break;
    case 'swarm':
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.6, -r * 0.9, r * 0.5, r * 0.25, -0.6 + Math.sin(time * 40) * 0.4, 0, Math.PI * 2);
      ctx.ellipse(r * 0.6, -r * 0.9, r * 0.5, r * 0.25, 0.6 - Math.sin(time * 40) * 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  // olhos olhando para onde anda
  const dx = Math.cos(e.angle);
  const dy = Math.sin(e.angle);
  const eyeR = r * (def.boss ? 0.2 : 0.28);
  const ex = dx * r * 0.35;
  const ey = dy * r * 0.25 - r * 0.15;
  for (const side of [-1, 1]) {
    const ox = ex + side * r * 0.32;
    ctx.fillStyle = def.boss ? '#ffeaa7' : '#ffffff';
    circle(ctx, ox, ey, eyeR);
    ctx.fill();
    ctx.fillStyle = def.boss ? '#d63031' : '#1e272e';
    circle(ctx, ox + dx * eyeR * 0.4, ey + dy * eyeR * 0.4, eyeR * 0.5);
    ctx.fill();
  }
  if (def.boss || def.id === 'brute' || def.id === 'golem') {
    ctx.strokeStyle = '#1e272e';
    ctx.lineWidth = def.boss ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(ex - r * 0.55, ey - eyeR * 1.6);
    ctx.lineTo(ex - r * 0.12, ey - eyeR * 0.9);
    ctx.moveTo(ex + r * 0.55, ey - eyeR * 1.6);
    ctx.lineTo(ex + r * 0.12, ey - eyeR * 0.9);
    ctx.stroke();
  }
  if (def.boss) {
    // coroa / chifres
    ctx.fillStyle = def.id === 'leviathan' ? '#a29bfe' : '#f9ca24';
    ctx.strokeStyle = '#2d3436';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.82);
    ctx.lineTo(-r * 0.55, -r * 1.25);
    ctx.lineTo(-r * 0.25, -r * 1.0);
    ctx.lineTo(0, -r * 1.35);
    ctx.lineTo(r * 0.25, -r * 1.0);
    ctx.lineTo(r * 0.55, -r * 1.25);
    ctx.lineTo(r * 0.5, -r * 0.82);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // estados
  if (e.slow > 0) {
    ctx.fillStyle = `rgba(116,185,255,${0.18 + e.slow * 0.35})`;
    circle(ctx, 0, 0, r);
    ctx.fill();
  }
  if (e.stunTimer > 0) {
    ctx.fillStyle = 'rgba(223,249,251,0.55)';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-r * 1.05, -r * 1.05, r * 2.1, r * 2.1);
    ctx.strokeRect(-r * 1.05, -r * 1.05, r * 2.1, r * 2.1);
  }
  if (e.flash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    circle(ctx, 0, 0, r);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // barra de vida
  if (!def.boss && e.hp < e.maxHp) {
    const w = Math.max(16, r * 2);
    const top = -r - 9;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-w / 2 - 1, top - 1, w + 2, 5);
    const frac = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = frac > 0.5 ? '#2ecc71' : frac > 0.25 ? '#f1c40f' : '#e74c3c';
    ctx.fillRect(-w / 2, top, w * frac, 3);
  }
  ctx.restore();
}

/** Renderiza um ícone (usado pela loja e pela prévia de onda). */
export function iconCanvas(size: number, draw: (ctx: Ctx) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = size * dpr;
  c.height = size * dpr;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  draw(ctx);
  return c;
}

export function towerIcon(def: TowerDef, size = 56): string {
  return iconCanvas(size, (ctx) => {
    const s = size / (def.radius * 2 + 16);
    ctx.translate(size / 2, size / 2 + 2);
    ctx.scale(s, s);
    drawTower(ctx, { def, tiers: [0, 0], angle: -Math.PI / 4, recoil: 0, flash: 0 }, 0, 0, 0.5);
  }).toDataURL();
}

export function enemyIcon(def: EnemyDef, size = 28): string {
  return iconCanvas(size, (ctx) => {
    const s = size / (def.radius * 2 + 10);
    ctx.translate(size / 2, size / 2);
    ctx.scale(s, s);
    drawEnemy(
      ctx,
      { def, angle: 0, bob: 0, hp: 1, maxHp: 1, slow: 0, stunTimer: 0, burnTimer: 0, flash: 0 },
      0,
      0,
      0,
    );
  }).toDataURL();
}
