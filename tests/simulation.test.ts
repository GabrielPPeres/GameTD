import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, type DifficultyId, TICK } from '../src/game/config';
import { buildMap, MAPS } from '../src/game/maps';
import type { TowerId } from '../src/game/towers';
import { World } from '../src/game/world';

declare const process: { env: Record<string, string | undefined> };

/**
 * Bot simples: segue uma ordem de construção, posiciona torres nos pontos válidos
 * com maior cobertura de caminho e investe a sobra em upgrades. Serve para:
 *  - pegar exceções/NaN na simulação inteira
 *  - ter uma noção de balanceamento (até onde um jogador "médio" chega)
 */
const BUILD: TowerId[] = ['archer', 'archer', 'cannon', 'archer', 'frost', 'sniper', 'tesla', 'mine', 'cannon', 'totem', 'prism', 'tesla', 'archer', 'sniper', 'prism', 'cannon', 'tesla', 'prism', 'frost', 'tesla', 'prism', 'cannon', 'prism', 'tesla', 'sniper', 'prism'];

/** Caminho de upgrade preferido por torre: [principal, secundário]. */
const PLAN: Record<TowerId, [0 | 1, 0 | 1]> = {
  archer: [0, 1],
  cannon: [0, 1],
  frost: [1, 0],
  tesla: [0, 1],
  sniper: [1, 0],
  prism: [0, 1],
  mine: [0, 1],
  totem: [1, 0],
};

function candidateSpots(world: World): { x: number; y: number; score: number }[] {
  const spots: { x: number; y: number; score: number }[] = [];
  const s = { x: 0, y: 0, angle: 0 };
  for (let y = 24; y < 640; y += 16) {
    for (let x = 24; x < 1024; x += 16) {
      const d = Math.min(...world.map.paths.map((p) => p.distanceTo(x, y)));
      if (d > 90) continue;
      let cover = 0;
      for (const p of world.map.paths) {
        for (let k = 0; k < p.length; k += 20) {
          p.sample(k, s);
          if (Math.hypot(s.x - x, s.y - y) < 130) cover++;
        }
      }
      spots.push({ x, y, score: cover - d * 0.05 });
    }
  }
  return spots.sort((a, b) => b.score - a.score);
}

export function runBot(mapId: string, diffId: DifficultyId, maxWave: number, log = false) {
  const def = MAPS.find((m) => m.id === mapId)!;
  const world = new World(buildMap(def, 12345), DIFFICULTIES[diffId], 12345);
  const spots = candidateSpots(world);
  let buildIdx = 0;
  let guard = 0;
  const leaks = new Map<string, number>();
  world.startWave();
  while (!world.gameOver && guard++ < 60 * 60 * 180) {
    const wantTowers = 3 + world.wave * 0.6;
    const next = BUILD[buildIdx % BUILD.length];
    const needTower = world.towers.length < wantTowers;
    if (needTower && world.cash >= world.towerCost(next)) {
      for (const s of spots) {
        if (world.placeTower(next, s.x, s.y)) {
          const t = world.towers[world.towers.length - 1];
          if (next === 'sniper') t.target = 'strong';
          buildIdx++;
          break;
        }
      }
    }
    // detecção é prioridade a partir da onda 9 (furtivos chegam na 11)
    const hasDetect = world.towers.some((t) => t.stats.detect);
    const reserve = needTower ? world.towerCost(next) * 0.6 : 0;
    for (const t of world.towers) {
      const [main, side] = PLAN[t.def.id];
      let path: 0 | 1 = t.tiers[main] >= 2 && t.tiers[side] < 2 ? side : main;
      if (!hasDetect && world.wave >= 9 && (t.def.id === 'sniper' || t.def.id === 'archer')) path = 1;
      const info = world.upgradeInfo(t, path);
      if (!info.blocked && info.affordable && world.cash - info.cost >= reserve) world.upgrade(t, path);
    }
    const prevWave = world.wave;
    const prevLives = world.lives;
    world.update(TICK * 2);
    for (const e of world.events) {
      if (e.type === 'kill') expect(Number.isFinite(e.reward)).toBe(true);
      if (e.type === 'leak') leaks.set(e.def.id, (leaks.get(e.def.id) ?? 0) + 1);
    }
    world.events.length = 0;
    for (const e of world.enemies) expect(Number.isFinite(e.x) && Number.isFinite(e.hp)).toBe(true);
    if (log && world.lives < prevLives && world.wave === prevWave) {
      /* vazamentos agregados abaixo */
    }
    if (!world.waveOpen && world.canStartWave() && !world.victory) {
      if (log) {
        const spent = world.towers.reduce((a, t) => a + t.spent, 0);
        const lk = [...leaks.entries()].map(([k, v]) => `${k}x${v}`).join(' ');
        console.log(`  onda ${String(world.wave).padStart(2)} | vidas ${String(world.lives).padStart(3)} | ouro ${String(Math.floor(world.cash)).padStart(5)} | investido ${String(spent).padStart(6)} | torres ${world.towers.length} ${lk ? '| vazou ' + lk : ''}`);
        leaks.clear();
      }
      if (world.wave >= maxWave) break;
      world.startWave();
    }
    if (world.victory) break;
  }
  if (log && world.gameOver) console.log(`  DERROTA na onda ${world.wave}: ${[...leaks.entries()].map(([k, v]) => `${k}x${v}`).join(' ')}`);
  return world;
}

describe('simulação completa', () => {
  for (const mapId of ['meadow', 'canyon', 'swamp', 'volcano', 'random']) {
    it(`bot joga ${mapId} (normal) sem erros`, { timeout: 300_000 }, () => {
      const w = runBot(mapId, 'normal', 40, process.env.LOG === '1');
      console.log(
        `[${mapId}] onda ${w.wave} | vidas ${w.lives} | vitória ${w.victory} | torres ${w.towers.length} | abates ${w.stats.kills} | ouro ${Math.floor(w.cash)}`,
      );
      expect(w.wave).toBeGreaterThanOrEqual(15);
      expect(Number.isFinite(w.cash)).toBe(true);
    });
  }
});
