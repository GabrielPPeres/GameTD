import { hashSeed, Rng } from '../engine/rng';
import { ENEMIES, type EnemyId } from './enemies';

export interface WaveGroup {
  enemy: EnemyId;
  count: number;
  /** segundos entre cada inimigo do grupo */
  interval: number;
  /** atraso do grupo a partir do início da onda */
  delay: number;
}

export interface Spawn {
  time: number;
  enemy: EnemyId;
  /** índice do caminho, ou -1 para alternar */
  path: number;
}

const g = (enemy: EnemyId, count: number, interval: number, delay = 0): WaveGroup => ({ enemy, count, interval, delay });

/** Ondas 1-15 desenhadas à mão para ensinar cada mecânica. */
const HANDMADE: WaveGroup[][] = [
  [g('slime', 12, 0.9)],
  [g('slime', 20, 0.65)],
  [g('slime', 14, 0.6), g('runner', 6, 0.8, 4)],
  [g('slime', 25, 0.45), g('runner', 10, 0.6, 3)],
  [g('brute', 2, 3), g('slime', 20, 0.4, 1)],
  [g('runner', 25, 0.35), g('brute', 4, 2, 4)],
  [g('swarm', 30, 0.15), g('slime', 30, 0.3, 2)],
  [g('splitter', 6, 1.6), g('runner', 20, 0.3, 3)],
  [g('brute', 10, 1.1), g('swarm', 25, 0.12, 5)],
  [g('colossus', 1, 0, 6), g('slime', 40, 0.25), g('brute', 6, 1.5, 4)],
  [g('shade', 6, 1.1), g('runner', 30, 0.25, 2)],
  [g('regen', 8, 1.2), g('splitter', 8, 1.3, 3)],
  [g('shade', 10, 0.7), g('brute', 12, 0.9, 2)],
  [g('healer', 4, 3), g('regen', 10, 0.9, 1), g('swarm', 40, 0.1, 4)],
  [g('splitter', 14, 0.7), g('shade', 12, 0.6, 3), g('brute', 12, 0.8, 6)],
];

/** Multiplicador de vida dos inimigos comuns por onda. */
export function hpScale(wave: number): number {
  if (wave <= 15) return 1;
  const w = wave - 15;
  let s = 1 + w * 0.045;
  if (wave > 35) s += (wave - 35) ** 2 * 0.006;
  if (wave > 55) s += (wave - 55) ** 3 * 0.0008;
  return s;
}

/** Chefes escalam em relação à onda em que estreiam. */
const BOSS_DEBUT: Partial<Record<EnemyId, number>> = { colossus: 10, titan: 30, leviathan: 40 };

export function enemyHpScale(id: EnemyId, wave: number): number {
  const debut = BOSS_DEBUT[id];
  if (debut !== undefined) {
    const w = Math.max(wave, debut);
    return (hpScale(w) / hpScale(debut)) * (1 + (w - debut) * 0.06);
  }
  return hpScale(wave);
}

export function rewardScale(wave: number): number {
  if (wave <= 20) return 1;
  if (wave <= 35) return 0.75;
  if (wave <= 50) return 0.5;
  return 0.3;
}

export function waveBonus(wave: number): number {
  return 120 + wave * 8;
}

function bossGroups(wave: number): WaveGroup[] {
  if (wave === 10) return [];
  if (wave === 20) return [g('colossus', 2, 8, 4)];
  if (wave === 30) return [g('titan', 1, 0, 6)];
  if (wave === 35) return [g('colossus', 6, 3, 2)];
  if (wave === 40) return [g('leviathan', 1, 0, 8)];
  if (wave === 45) return [g('titan', 3, 8, 4)];
  if (wave === 50) return [g('leviathan', 1, 0, 6), g('titan', 2, 10, 14)];
  if (wave > 50 && wave % 10 === 0) return [g('leviathan', Math.floor((wave - 40) / 10), 10, 6)];
  if (wave > 50 && wave % 5 === 0) return [g('titan', Math.floor((wave - 40) / 5), 6, 4)];
  return [];
}

export function buildWave(wave: number): WaveGroup[] {
  if (wave <= HANDMADE.length) return HANDMADE[wave - 1];

  const rng = new Rng(hashSeed(wave, 7919));
  const bosses = bossGroups(wave);
  let budget = 210 * 1.085 ** (wave - 15);
  if (bosses.length) budget *= 0.5;

  const pool = (Object.keys(ENEMIES) as EnemyId[]).filter((id) => {
    const d = ENEMIES[id];
    return !d.boss && d.unlock <= wave;
  });

  const groups: WaveGroup[] = [...bosses];
  const groupCount = Math.min(6, 2 + Math.floor(wave / 12));
  let delay = 0;
  for (let i = 0; i < groupCount; i++) {
    // favorece tipos mais recentes
    const weights = pool.map((id) => 1 + Math.max(0, ENEMIES[id].unlock - 1) / 14);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng.next() * total;
    let pick = pool[0];
    for (let k = 0; k < pool.length; k++) {
      roll -= weights[k];
      if (roll <= 0) {
        pick = pool[k];
        break;
      }
    }
    const share = budget / groupCount;
    const count = Math.max(1, Math.round(share / ENEMIES[pick].threat));
    const duration = Math.min(18, 5 + count * 0.15);
    const interval = Math.max(0.05, duration / count);
    groups.push(g(pick, count, interval, delay));
    delay += rng.range(1.5, 5);
  }
  return groups;
}

export function waveSpawns(wave: number): Spawn[] {
  const spawns: Spawn[] = [];
  for (const grp of buildWave(wave)) {
    for (let i = 0; i < grp.count; i++) {
      spawns.push({ time: grp.delay + i * grp.interval, enemy: grp.enemy, path: -1 });
    }
  }
  spawns.sort((a, b) => a.time - b.time);
  return spawns;
}

export function wavePreview(wave: number): { enemy: EnemyId; count: number }[] {
  const counts = new Map<EnemyId, number>();
  for (const grp of buildWave(wave)) counts.set(grp.enemy, (counts.get(grp.enemy) ?? 0) + grp.count);
  return [...counts.entries()]
    .map(([enemy, count]) => ({ enemy, count }))
    .sort((a, b) => ENEMIES[b.enemy].threat - ENEMIES[a.enemy].threat);
}
