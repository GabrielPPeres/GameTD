import type { Vec } from '../engine/math';
import { formatNumber } from '../engine/math';
import type { GameEvent } from '../game/world';

type Ctx = CanvasRenderingContext2D;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  gravity: number;
  drag: number;
}

interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  color: string;
  width: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  max: number;
}

interface Line {
  points: Vec[];
  life: number;
  max: number;
  color: string;
  width: number;
}

interface Decal {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
}

const MAX_PARTICLES = 1800;

/** Efeitos puramente visuais. A simulação não depende de nada aqui. */
export class Effects {
  particles: Particle[] = [];
  rings: Ring[] = [];
  texts: FloatText[] = [];
  lines: Line[] = [];
  decals: Decal[] = [];
  shake = 0;

  clear(): void {
    this.particles.length = 0;
    this.rings.length = 0;
    this.texts.length = 0;
    this.lines.length = 0;
    this.decals.length = 0;
    this.shake = 0;
  }

  burst(x: number, y: number, colors: string[], count: number, speed: number, size = 2.5, gravity = 200): void {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      const life = 0.35 + Math.random() * 0.4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - speed * 0.3,
        life,
        max: life,
        color: colors[i % colors.length],
        size: size * (0.6 + Math.random() * 0.8),
        gravity,
        drag: 2,
      });
    }
  }

  ring(x: number, y: number, r0: number, r1: number, color: string, life = 0.35, width = 3): void {
    this.rings.push({ x, y, r0, r1, life, max: life, color, width });
  }

  text(x: number, y: number, text: string, color: string, size = 12, life = 0.9): void {
    if (this.texts.length > 80) return;
    this.texts.push({ x, y, text, color, size, life, max: life });
  }

  flame(x: number, y: number): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({
      x: x + (Math.random() - 0.5) * 8,
      y,
      vx: (Math.random() - 0.5) * 10,
      vy: -40 - Math.random() * 30,
      life: 0.35,
      max: 0.35,
      color: Math.random() < 0.5 ? '#ff9f43' : '#ee5253',
      size: 2.5,
      gravity: 0,
      drag: 1,
    });
  }

  handle(ev: GameEvent): void {
    switch (ev.type) {
      case 'kill': {
        const big = ev.def.boss;
        this.burst(ev.x, ev.y, [ev.def.color, ev.def.dark, '#ffffff'], big ? 60 : 9, big ? 260 : 120, big ? 4 : 2.5);
        if (big) {
          this.ring(ev.x, ev.y, 10, 140, '#ffffff', 0.6, 5);
          this.shake = Math.max(this.shake, 12);
          this.text(ev.x, ev.y - 30, `+${formatNumber(ev.reward)}`, '#feca57', 22, 1.6);
        } else if (ev.reward >= 5) {
          this.text(ev.x, ev.y - 10, `+${ev.reward}`, '#feca57', 11, 0.7);
        }
        break;
      }
      case 'leak':
        this.text(ev.x - 30, ev.y, `-${formatNumber(ev.def.leak)} ♥`, '#ff7675', 16, 1.2);
        this.shake = Math.max(this.shake, Math.min(14, 3 + ev.def.leak));
        break;
      case 'explode':
        this.ring(ev.x, ev.y, 4, ev.r, ev.fire ? '#ff6b1a' : '#ffeaa7', 0.28, 4);
        this.burst(ev.x, ev.y, ev.fire ? ['#ff6b1a', '#ee5253', '#feca57'] : ['#feca57', '#ff9f43', '#636e72'], Math.min(18, 6 + ev.r / 4), 160, 3);
        this.decals.push({ x: ev.x, y: ev.y, r: ev.r * 0.7, life: 4, max: 4 });
        if (this.decals.length > 60) this.decals.shift();
        this.shake = Math.max(this.shake, ev.r > 60 ? 4 : 1.5);
        break;
      case 'pulse':
        this.ring(ev.x, ev.y, 10, ev.r, 'rgba(199,236,238,0.9)', 0.45, 4);
        this.burst(ev.x, ev.y, ['#dff9fb', '#74b9ff'], 6, ev.r * 2, 2, 0);
        break;
      case 'bolt':
        this.lines.push({ points: jag(ev.points), life: 0.16, max: 0.16, color: '#dcd6ff', width: 2.5 });
        for (const p of ev.points.slice(1)) this.burst(p.x, p.y, ['#a29bfe', '#ffffff'], 3, 90, 1.8, 0);
        break;
      case 'tracer':
        this.lines.push({
          points: [
            { x: ev.x1, y: ev.y1 },
            { x: ev.x2, y: ev.y2 },
          ],
          life: 0.1,
          max: 0.1,
          color: ev.crit ? '#ff7675' : '#ffeaa7',
          width: ev.crit ? 3.5 : 2,
        });
        this.burst(ev.x2, ev.y2, ['#ffeaa7', '#ffffff'], 4, 100, 2);
        break;
      case 'crit':
        this.text(ev.x, ev.y, `${formatNumber(ev.amount)}!`, '#ff7675', 13, 0.6);
        break;
      case 'heal':
        this.ring(ev.x, ev.y, 6, ev.r, 'rgba(85,239,196,0.8)', 0.5, 3);
        this.text(ev.x, ev.y - 18, '+', '#55efc4', 16, 0.6);
        break;
      case 'income':
        this.text(ev.x, ev.y - 22, `+$${formatNumber(ev.amount)}`, '#feca57', 15, 1.4);
        this.burst(ev.x, ev.y - 10, ['#feca57', '#fff3b0'], 10, 90, 2.5);
        break;
      case 'place':
        this.ring(ev.tower.x, ev.tower.y, ev.tower.def.radius, ev.tower.def.radius + 22, 'rgba(255,255,255,0.8)', 0.3, 3);
        this.burst(ev.tower.x, ev.tower.y + 8, ['#b2bec3', '#dfe6e9'], 10, 80, 2.5, 60);
        break;
      case 'upgrade':
        this.ring(ev.tower.x, ev.tower.y, 6, 44, '#feca57', 0.45, 4);
        this.burst(ev.tower.x, ev.tower.y, ['#feca57', '#ffffff', '#fff3b0'], 22, 160, 2.5, 50);
        break;
      case 'sell':
        this.text(ev.tower.x, ev.tower.y - 20, `+$${formatNumber(ev.value)}`, '#feca57', 15, 1);
        this.burst(ev.tower.x, ev.tower.y, ['#feca57', '#b2bec3'], 16, 140, 3);
        break;
      case 'shot':
        if (ev.tower.def.kind === 'lob') {
          const a = ev.tower.angle;
          this.burst(ev.tower.x + Math.cos(a) * 22, ev.tower.y + Math.sin(a) * 22, ['#dfe6e9', '#b2bec3'], 4, 50, 3, -20);
        }
        break;
      case 'boss':
        this.shake = Math.max(this.shake, 8);
        break;
      default:
        break;
    }
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.vx -= p.vx * p.drag * dt;
      p.vy -= p.vy * p.drag * dt * 0.5;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 28 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const l of this.lines) l.life -= dt;
    this.lines = this.lines.filter((l) => l.life > 0);
    for (const d of this.decals) d.life -= dt;
    this.decals = this.decals.filter((d) => d.life > 0);
    this.shake *= Math.pow(0.0015, dt);
    if (this.shake < 0.1) this.shake = 0;
  }

  drawDecals(ctx: Ctx): void {
    for (const d of this.decals) {
      ctx.globalAlpha = 0.35 * (d.life / d.max);
      ctx.fillStyle = '#2d1b13';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r, d.r * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  draw(ctx: Ctx): void {
    for (const r of this.rings) {
      const u = 1 - r.life / r.max;
      ctx.globalAlpha = 1 - u;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - u * 0.5);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * easeOut(u), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const l of this.lines) {
      ctx.globalAlpha = l.life / l.max;
      ctx.strokeStyle = l.color;
      ctx.lineWidth = l.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      l.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.lineWidth = l.width * 0.4;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, (t.life / t.max) * 2);
      ctx.font = `900 ${t.size}px system-ui, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}

const easeOut = (u: number) => 1 - (1 - u) * (1 - u);

/** Transforma uma polilinha em raio irregular. */
function jag(points: Vec[]): Vec[] {
  const out: Vec[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const steps = Math.max(2, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 14));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      out.push({ x: a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 12, y: a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 12 });
    }
    out.push(b);
  }
  return out;
}
