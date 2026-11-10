import { formatNumber } from '../engine/math';
import { WORLD_H, WORLD_W } from '../game/config';
import type { GameMap } from '../game/maps';
import { TOWERS, type TowerId } from '../game/towers';
import type { Tower, World } from '../game/world';
import { renderBackground } from './background';
import { Effects } from './effects';
import { drawEnemy, drawTierPips, drawTower } from './sprites';

type Ctx = CanvasRenderingContext2D;

export interface ViewState {
  hover: { x: number; y: number } | null;
  placing: TowerId | null;
  placeValid: boolean;
  selected: Tower | null;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: Ctx;
  readonly effects = new Effects();
  private scale = 1;
  private dpr = 1;
  private bg: HTMLCanvasElement | null = null;
  private map: GameMap | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  /** Ajusta a canvas para caber no container mantendo a proporção do mundo. */
  fit(containerW: number, containerH: number): void {
    const scale = Math.max(0.1, Math.min(containerW / WORLD_W, containerH / WORLD_H));
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const cssW = Math.floor(WORLD_W * scale);
    const cssH = Math.floor(WORLD_H * scale);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    if (w === this.canvas.width && h === this.canvas.height && this.bg) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.scale = scale;
    this.dpr = dpr;
    if (this.map) this.bg = renderBackground(this.map, scale * dpr);
  }

  setMap(map: GameMap): void {
    this.map = map;
    this.bg = renderBackground(map, this.scale * this.dpr);
    this.effects.clear();
  }

  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * WORLD_W,
      y: ((clientY - rect.top) / rect.height) * WORLD_H,
    };
  }

  draw(world: World, view: ViewState, time: number, dt: number): void {
    const ctx = this.ctx;
    const fx = this.effects;
    fx.update(dt);

    const k = this.scale * this.dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
    if (this.bg) ctx.drawImage(this.bg, 0, 0, WORLD_W, WORLD_H);
    else ctx.clearRect(0, 0, WORLD_W, WORLD_H);

    fx.drawDecals(ctx);

    // auras de totem (sutil)
    for (const t of world.towers) {
      if (t.def.kind !== 'aura') continue;
      ctx.globalAlpha = 0.07 + Math.sin(time * 2) * 0.02;
      ctx.fillStyle = t.tiers[0] >= t.tiers[1] ? '#ff6b6b' : '#48dbfb';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.base.range, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // alcance da torre selecionada / em hover
    const sel = view.selected;
    if (sel) this.drawRange(sel.x, sel.y, sel.stats.range, true, sel.def.kind === 'aura' || sel.def.kind === 'income');
    if (!view.placing && view.hover && !sel) {
      const h = world.towerAt(view.hover.x, view.hover.y);
      if (h) this.drawRange(h.x, h.y, h.stats.range, true, false, 0.5);
    }
    if (sel?.def.kind === 'aura') {
      for (const t of world.towers) {
        if (t === sel || t.def.kind === 'aura' || t.def.kind === 'income') continue;
        if (Math.hypot(t.x - sel.x, t.y - sel.y) <= sel.base.range) {
          ctx.strokeStyle = '#feca57';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.def.radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // torres
    const towers = [...world.towers].sort((a, b) => a.y - b.y);
    for (const t of towers) {
      drawTower(ctx, t, t.x, t.y, time);
      drawTierPips(ctx, t, t.x, t.y);
      if (t === sel) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.def.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // inimigos
    const enemies = [...world.enemies].sort((a, b) => a.y - b.y);
    for (const e of enemies) {
      drawEnemy(ctx, e, e.x, e.y, time);
      if (e.burnTimer > 0 && Math.random() < 0.35) fx.flame(e.x, e.y - e.def.radius * 0.4);
    }

    this.drawBeams(world, time);
    this.drawProjectiles(world);
    fx.draw(ctx);

    // fantasma de posicionamento
    if (view.placing && view.hover) {
      const def = TOWERS[view.placing];
      const { x, y } = view.hover;
      this.drawRange(x, y, def.base.range ?? 100, view.placeValid, def.kind === 'aura' || def.kind === 'income');
      ctx.globalAlpha = 0.75;
      drawTower(ctx, { def, tiers: [0, 0], angle: -Math.PI / 2, recoil: 0, flash: 0 }, x, y, time);
      ctx.globalAlpha = 1;
      if (!view.placeValid) {
        ctx.strokeStyle = '#ff4757';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 8);
        ctx.lineTo(x + 8, y + 8);
        ctx.moveTo(x + 8, y - 8);
        ctx.lineTo(x - 8, y + 8);
        ctx.stroke();
      }
    }

    this.drawBossBar(world);
  }

  private drawRange(x: number, y: number, r: number, valid: boolean, aura: boolean, alpha = 1): void {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = valid ? (aura ? 'rgba(254,202,87,0.12)' : 'rgba(255,255,255,0.14)') : 'rgba(255,71,87,0.18)';
    ctx.strokeStyle = valid ? 'rgba(255,255,255,0.7)' : 'rgba(255,71,87,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, Math.min(r, 1400), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawBeams(world: World, time: number): void {
    const ctx = this.ctx;
    for (const t of world.towers) {
      if (t.def.kind !== 'beam' || !t.beams.length) continue;
      const heat = t.ramp / Math.max(1, t.stats.rampMax - 1);
      for (const e of t.beams) {
        if (!e.alive) continue;
        let ex = e.x;
        let ey = e.y;
        if (t.stats.beamLine) {
          const a = Math.atan2(e.y - t.y, e.x - t.x);
          ex = t.x + Math.cos(a) * t.stats.range * 1.6;
          ey = t.y + Math.sin(a) * t.stats.range * 1.6;
        }
        const hue = 300 - heat * 300 + Math.sin(time * 20) * 10;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `hsla(${hue},100%,60%,0.35)`;
        ctx.lineWidth = 7 + heat * 6;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.strokeStyle = `hsl(${hue},100%,75%)`;
        ctx.lineWidth = 2.5 + heat * 2;
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = `hsla(${hue},100%,80%,0.8)`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 4 + heat * 4 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawProjectiles(world: World): void {
    const ctx = this.ctx;
    for (const p of world.projectiles) {
      if (p.kind === 'arrow' || p.kind === 'shard') {
        const a = Math.atan2(p.vy, p.vx);
        const len = p.kind === 'arrow' ? 13 : 6;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(a);
        ctx.strokeStyle = p.kind === 'shard' ? '#feca57' : p.crit ? '#ff7675' : p.owner.stats.burnDps > 0 ? '#ff9f43' : '#5d3a1a';
        ctx.lineWidth = p.crit ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();
        if (p.kind === 'arrow') {
          ctx.fillStyle = p.crit ? '#ff7675' : '#dfe6e9';
          ctx.beginPath();
          ctx.moveTo(4, 0);
          ctx.lineTo(-2, -3);
          ctx.lineTo(-2, 3);
          ctx.fill();
          ctx.fillStyle = '#ecf0f1';
          ctx.fillRect(-len, -2, 3, 4);
        }
        ctx.restore();
      } else {
        const r = p.kind === 'bomb' ? 5.5 : 3.5;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        const g = ctx.createRadialGradient(p.x - 2, p.y - p.height - 2, 0.5, p.x, p.y - p.height, r);
        g.addColorStop(0, '#95a5a6');
        g.addColorStop(1, '#1e272e');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y - p.height, r, 0, Math.PI * 2);
        ctx.fill();
        if (p.kind === 'bomb') {
          ctx.fillStyle = Math.random() < 0.5 ? '#feca57' : '#ff6b1a';
          ctx.fillRect(p.x + 2, p.y - p.height - r - 2, 2, 2);
        }
      }
    }
  }

  private drawBossBar(world: World): void {
    let boss = null;
    for (const e of world.enemies) if (e.def.boss && (!boss || e.maxHp > boss.maxHp)) boss = e;
    if (!boss) return;
    const ctx = this.ctx;
    const w = 420;
    const x = (WORLD_W - w) / 2;
    const y = 14;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x - 4, y - 4, w + 8, 26);
    const frac = Math.max(0, boss.hp / boss.maxHp);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#d63031');
    g.addColorStop(1, '#ff7675');
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(x, y, w, 18);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w * frac, 18);
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${boss.def.name.toUpperCase()} — ${formatNumber(Math.max(0, boss.hp))} / ${formatNumber(boss.maxHp)}`, WORLD_W / 2, y + 9.5);
  }
}
