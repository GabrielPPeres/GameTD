/**
 * Gerador Park-Miller (mesmo do jogo original: F = 16807 * F % 2147483647).
 * Determinístico por seed: mapas procedurais e ondas são reproduzíveis.
 */
export class Rng {
  private state: number;

  constructor(seed: number = (Math.random() * 2147483646 + 1) | 0) {
    this.state = Math.abs(seed | 0) % 2147483647 || 1;
  }

  get seed(): number {
    return this.state;
  }

  next(): number {
    this.state = (this.state * 16807) % 2147483647;
    return this.state / 2147483647;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }
}

/** Hash simples para derivar seeds (ex.: seed do mapa + número da onda). */
export function hashSeed(...parts: number[]): number {
  let h = 2166136261;
  for (const p of parts) {
    h ^= p | 0;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 1) || 1;
}
