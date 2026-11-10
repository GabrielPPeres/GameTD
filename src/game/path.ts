import { distToSegment, type Vec } from '../engine/math';

/** Polilinha percorrida pelos inimigos, parametrizada por distância. */
export class Path {
  readonly points: Vec[];
  readonly length: number;
  private readonly cumulative: number[];

  constructor(points: Vec[]) {
    if (points.length < 2) throw new Error('Path precisa de ao menos 2 pontos');
    this.points = points;
    this.cumulative = [0];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      this.cumulative.push(total);
    }
    this.length = total;
  }

  /** Posição e ângulo após percorrer `d` unidades. */
  sample(d: number, out: { x: number; y: number; angle: number }): void {
    const pts = this.points;
    const cum = this.cumulative;
    if (d <= 0) {
      out.x = pts[0].x;
      out.y = pts[0].y;
      out.angle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      return;
    }
    if (d >= this.length) {
      const n = pts.length - 1;
      out.x = pts[n].x;
      out.y = pts[n].y;
      out.angle = Math.atan2(pts[n].y - pts[n - 1].y, pts[n].x - pts[n - 1].x);
      return;
    }
    // busca binária do segmento
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= d) lo = mid;
      else hi = mid;
    }
    const a = pts[lo];
    const b = pts[hi];
    const t = (d - cum[lo]) / (cum[hi] - cum[lo] || 1);
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.angle = Math.atan2(b.y - a.y, b.x - a.x);
  }

  distanceTo(x: number, y: number): number {
    let best = Infinity;
    const pts = this.points;
    for (let i = 1; i < pts.length; i++) {
      const d = distToSegment(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
      if (d < best) best = d;
    }
    return best;
  }
}
