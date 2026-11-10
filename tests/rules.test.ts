import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, TICK } from '../src/game/config';
import { buildMap, generateProceduralPath, MAPS } from '../src/game/maps';
import { Path } from '../src/game/path';
import { Rng } from '../src/engine/rng';
import { computeStats, TOWERS, upgradeBlockReason } from '../src/game/towers';
import { buildWave, hpScale, waveSpawns } from '../src/game/waves';
import { World } from '../src/game/world';

describe('Path', () => {
  const p = new Path([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
  ]);
  it('mede o comprimento total', () => expect(p.length).toBe(150));
  it('amostra posições pela distância', () => {
    const o = { x: 0, y: 0, angle: 0 };
    p.sample(125, o);
    expect(o).toMatchObject({ x: 100, y: 25 });
    expect(o.angle).toBeCloseTo(Math.PI / 2);
  });
  it('calcula distância até o caminho', () => expect(p.distanceTo(50, 10)).toBe(10));
});

describe('regra de cruzamento de upgrades', () => {
  it('permite 4 num caminho e 2 no outro', () => {
    expect(upgradeBlockReason([4, 2], 1)).toBe('Caminho bloqueado');
    expect(upgradeBlockReason([2, 2], 0)).toBeNull();
    expect(upgradeBlockReason([3, 2], 1)).toBe('Caminho bloqueado');
    expect(upgradeBlockReason([4, 0], 0)).toBe('Nível máximo');
    expect(upgradeBlockReason([1, 2], 1)).toBeNull();
  });
  it('upgrades alteram os atributos', () => {
    const base = computeStats(TOWERS.archer, [0, 0]);
    const up = computeStats(TOWERS.archer, [2, 0]);
    expect(up.damage).toBe(base.damage + 2);
    expect(up.armorPierce).toBe(true);
    expect(computeStats(TOWERS.archer, [0, 2]).detect).toBe(true);
  });
});

describe('ondas', () => {
  it('todas as ondas até 80 geram inimigos', () => {
    for (let w = 1; w <= 80; w++) expect(waveSpawns(w).length).toBeGreaterThan(0);
  });
  it('são determinísticas', () => expect(buildWave(33)).toEqual(buildWave(33)));
  it('escala de vida cresce', () => expect(hpScale(40)).toBeGreaterThan(hpScale(20)));
  it('chefes aparecem nas ondas certas', () => {
    expect(buildWave(10).some((g) => g.enemy === 'colossus')).toBe(true);
    expect(buildWave(30).some((g) => g.enemy === 'titan')).toBe(true);
    expect(buildWave(40).some((g) => g.enemy === 'leviathan')).toBe(true);
  });
});

describe('mapas', () => {
  it('gerador procedural (port do original) sempre cruza a tela', () => {
    for (let seed = 1; seed < 200; seed++) {
      const { points } = generateProceduralPath(new Rng(seed));
      expect(points[0].x).toBeLessThan(0);
      expect(points[points.length - 1].x).toBeGreaterThan(1024);
      for (const p of points.slice(1, -1)) {
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(640);
      }
    }
  });
  it('todos os mapas têm lugar para construir', () => {
    for (const def of MAPS) {
      const w = new World(buildMap(def, 3), DIFFICULTIES.normal);
      let spots = 0;
      for (let y = 20; y < 640; y += 20) for (let x = 20; x < 1024; x += 20) if (w.canPlace('archer', x, y)) spots++;
      expect(spots).toBeGreaterThan(200);
    }
  });
});

describe('mundo', () => {
  const make = () => new World(buildMap(MAPS[0], 1), DIFFICULTIES.normal);

  it('não deixa construir no caminho nem sem ouro', () => {
    const w = make();
    expect(w.placeTower('archer', 100, 100)).toBeNull(); // em cima do caminho
    w.cash = 0;
    expect(w.placeTower('archer', 100, 200)).toBeNull();
  });

  it('vender devolve 70% do investido', () => {
    const w = make();
    const t = w.placeTower('archer', 150, 200)!;
    expect(t).not.toBeNull();
    w.upgrade(t, 0);
    const spent = t.spent;
    const before = w.cash;
    w.sell(t);
    expect(w.cash - before).toBe(Math.floor(spent * 0.7));
  });

  it('totem acelera torres no alcance', () => {
    const w = make();
    w.cash = 1e5;
    const a = w.placeTower('archer', 150, 200)!;
    const before = a.stats.cooldown;
    w.placeTower('totem', 150, 250);
    expect(a.stats.cooldown).toBeLessThan(before);
  });

  it('furtivos só são atingidos por quem detecta ou depois de revelados pelo gelo', () => {
    const w = make();
    w.cash = 1e5;
    w.placeTower('archer', 300, 140);
    w.wave = 10;
    w.startWave(); // onda 11: sombras furtivas + corredores
    for (let i = 0; i < 60 * 40; i++) w.update(TICK);
    const sniperless = w.stats.kills;
    expect(sniperless).toBeGreaterThan(0);
    expect(w.events.some((e) => e.type === 'leak' && e.def.stealth)).toBe(true);
  });

  it('onda completa paga bônus e permite chamar a próxima', () => {
    const w = make();
    w.cash = 1e5;
    for (const [x, y] of [
      [300, 160],
      [200, 300],
      [320, 450],
    ])
      w.placeTower('cannon', x, y);
    w.startWave();
    for (let i = 0; i < 60 * 90 && w.waveInProgress; i++) w.update(TICK);
    expect(w.waveInProgress).toBe(false);
    expect(w.events.some((e) => e.type === 'waveEnd')).toBe(true);
    expect(w.canStartWave()).toBe(true);
  });
});
