import { Rng } from '../engine/rng';
import { PATH_WIDTH, WORLD_H, WORLD_W } from '../game/config';
import type { GameMap, Obstacle, Theme } from '../game/maps';

type Ctx = CanvasRenderingContext2D;

/** Pré-renderiza o terreno do mapa numa canvas (desenhada 1x por frame com drawImage). */
export function renderBackground(map: GameMap, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(WORLD_W * scale);
  canvas.height = Math.round(WORLD_H * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  paintMap(ctx, map);
  return canvas;
}

export function paintMap(ctx: Ctx, map: GameMap): void {
  const theme = map.def.theme;
  const rng = new Rng(map.seed + 99);

  ctx.fillStyle = theme.grass;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // manchas grandes e suaves
  for (let i = 0; i < 40; i++) {
    const x = rng.range(0, WORLD_W);
    const y = rng.range(0, WORLD_H);
    const r = rng.range(40, 120);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = rng.chance(0.5) ? theme.grassDark : theme.grassLight;
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;

  // textura de grama
  for (let i = 0; i < 2600; i++) {
    const x = rng.range(0, WORLD_W);
    const y = rng.range(0, WORLD_H);
    ctx.fillStyle = rng.chance(0.5) ? theme.grassDark : theme.grassLight;
    ctx.fillRect(x, y, 2, rng.range(2, 5));
  }

  for (const o of map.obstacles) if (o.kind === 'pool') drawPool(ctx, o, theme, rng);

  // caminho: borda, preenchimento, pedrinhas
  for (const pass of [0, 1]) {
    for (const path of map.paths) {
      ctx.beginPath();
      path.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = pass ? PATH_WIDTH : PATH_WIDTH + 10;
      ctx.strokeStyle = pass ? theme.path : theme.pathEdge;
      ctx.stroke();
    }
  }
  const sample = { x: 0, y: 0, angle: 0 };
  for (const path of map.paths) {
    for (let d = 0; d < path.length; d += 7) {
      path.sample(d, sample);
      const off = rng.range(-PATH_WIDTH / 2 + 4, PATH_WIDTH / 2 - 4);
      const nx = -Math.sin(sample.angle);
      const ny = Math.cos(sample.angle);
      ctx.fillStyle = theme.pathDots;
      ctx.fillRect(sample.x + nx * off, sample.y + ny * off, rng.range(1.5, 3.5), rng.range(1.5, 3));
    }
  }

  drawGate(ctx, map, theme);
  drawEntrance(ctx, map);

  // obstáculos de cima para baixo para sobreposição correta
  const solids = map.obstacles.filter((o) => o.kind !== 'pool').sort((a, b) => a.y - b.y);
  for (const o of solids) (o.kind === 'tree' ? drawTree : drawRock)(ctx, o, theme, rng);

  // flores decorativas
  for (let i = 0; i < 70; i++) {
    const x = rng.range(10, WORLD_W - 10);
    const y = rng.range(10, WORLD_H - 10);
    if (map.paths.some((p) => p.distanceTo(x, y) < PATH_WIDTH / 2 + 6)) continue;
    if (map.obstacles.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + 4)) continue;
    ctx.fillStyle = rng.pick(['#fff', '#ffeaa7', '#fd79a8', '#a29bfe']);
    ctx.globalAlpha = map.def.id === 'volcano' ? 0 : 0.85;
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // vinheta
  const v = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.45, WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
}

function drawPool(ctx: Ctx, o: Obstacle, theme: Theme, rng: Rng) {
  ctx.fillStyle = theme.poolEdge;
  blob(ctx, o.x, o.y, o.r + 5, rng.seed);
  ctx.fill();
  const g = ctx.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.3, 2, o.x, o.y, o.r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.15, theme.pool);
  g.addColorStop(1, theme.poolEdge);
  ctx.fillStyle = g;
  blob(ctx, o.x, o.y, o.r, rng.seed);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(o.x + rng.range(-o.r / 2, o.r / 2), o.y + rng.range(-o.r / 2, o.r / 2), rng.range(4, 10), 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
}

function blob(ctx: Ctx, x: number, y: number, r: number, seed: number) {
  ctx.beginPath();
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.9 + 0.1 * Math.sin(a * 3 + seed));
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * 0.85;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

function drawTree(ctx: Ctx, o: Obstacle, theme: Theme, rng: Rng) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(o.x + 5, o.y + o.r * 0.6, o.r, o.r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(o.x - 3, o.y, 6, o.r * 0.6);
  const parts = 4;
  for (let i = 0; i < parts; i++) {
    const a = (i / parts) * Math.PI * 2 + rng.next();
    const px = o.x + Math.cos(a) * o.r * 0.35;
    const py = o.y - o.r * 0.25 + Math.sin(a) * o.r * 0.3;
    ctx.fillStyle = theme.foliage[i % theme.foliage.length];
    ctx.beginPath();
    ctx.arc(px, py, o.r * 0.65, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(o.x - o.r * 0.3, o.y - o.r * 0.55, o.r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawRock(ctx: Ctx, o: Obstacle, _theme: Theme, rng: Rng) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(o.x + 3, o.y + o.r * 0.5, o.r, o.r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  const pts = 7;
  ctx.beginPath();
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const rr = o.r * rng.range(0.75, 1);
    ctx.lineTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr * 0.8);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(o.x - o.r, o.y - o.r, o.x + o.r, o.y + o.r);
  g.addColorStop(0, '#b2bec3');
  g.addColorStop(1, '#636e72');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#2d3436';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Portal de onde os inimigos saem. */
function drawEntrance(ctx: Ctx, map: GameMap) {
  const seen = new Set<string>();
  for (const path of map.paths) {
    const p = path.points[1];
    const p0 = path.points[0];
    const key = `${p0.x},${p0.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const a = Math.atan2(p.y - p0.y, p.x - p0.x);
    const x = Math.max(8, Math.min(WORLD_W - 8, p0.x + Math.cos(a) * 48));
    const y = Math.max(8, Math.min(WORLD_H - 8, p0.y + Math.sin(a) * 48));
    const g = ctx.createRadialGradient(x, y, 2, x, y, 34);
    g.addColorStop(0, 'rgba(108,92,231,0.75)');
    g.addColorStop(1, 'rgba(108,92,231,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 34, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A muralha: o que o jogador defende, no fim do caminho. */
function drawGate(ctx: Ctx, map: GameMap, _theme: Theme) {
  const path = map.paths[0];
  const n = path.points.length;
  const end = path.points[n - 1];
  const prev = path.points[n - 2];
  const a = Math.atan2(end.y - prev.y, end.x - prev.x);
  const gx = Math.max(24, Math.min(WORLD_W - 24, end.x - Math.cos(a) * 46));
  const gy = Math.max(24, Math.min(WORLD_H - 24, end.y - Math.sin(a) * 46));
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(a + Math.PI / 2);
  const w = PATH_WIDTH + 34;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-w / 2 + 4, -8, w, 22);
  ctx.fillStyle = '#7f8c8d';
  ctx.fillRect(-w / 2, -12, w, 22);
  ctx.strokeStyle = '#2d3436';
  ctx.lineWidth = 2;
  ctx.strokeRect(-w / 2, -12, w, 22);
  // ameias
  for (let i = 0; i < 5; i++) {
    const x = -w / 2 + i * (w / 5) + 2;
    ctx.fillStyle = '#95a5a6';
    ctx.fillRect(x, -18, w / 5 - 6, 7);
    ctx.strokeRect(x, -18, w / 5 - 6, 7);
  }
  // portão
  ctx.fillStyle = '#4e342e';
  ctx.fillRect(-11, -6, 22, 16);
  ctx.strokeStyle = '#2d1b13';
  ctx.strokeRect(-11, -6, 22, 16);
  ctx.fillStyle = '#d63031';
  ctx.fillRect(-2, -32, 2, 16);
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(13, -28);
  ctx.lineTo(0, -24);
  ctx.fill();
  ctx.restore();
}
