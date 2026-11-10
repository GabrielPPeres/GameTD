import type { Vec } from '../engine/math';
import { Rng } from '../engine/rng';
import { PATH_WIDTH, WORLD_H, WORLD_W } from './config';
import { Path } from './path';

export interface Theme {
  grass: string;
  grassDark: string;
  grassLight: string;
  path: string;
  pathEdge: string;
  pathDots: string;
  pool: string;
  poolEdge: string;
  foliage: string[];
}

export type ObstacleKind = 'tree' | 'rock' | 'pool';

export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  y: number;
  r: number;
}

export interface MapDef {
  id: string;
  name: string;
  tier: 'Iniciante' | 'Intermediário' | 'Avançado' | 'Especialista';
  description: string;
  theme: Theme;
  paths: Vec[][];
  pools?: Obstacle[];
  trees: number;
  rocks: number;
  /** gera caminho com o algoritmo do jogo original */
  procedural?: boolean;
}

export interface GameMap {
  def: MapDef;
  seed: number;
  paths: Path[];
  obstacles: Obstacle[];
}

const MEADOW: Theme = {
  grass: '#5fae4b',
  grassDark: '#4b9a3b',
  grassLight: '#7cc463',
  path: '#d8b77c',
  pathEdge: '#a58350',
  pathDots: '#c2a066',
  pool: '#3d9be9',
  poolEdge: '#2b6fae',
  foliage: ['#2e7d32', '#388e3c', '#43a047'],
};

const CANYON: Theme = {
  grass: '#c98d5a',
  grassDark: '#b07445',
  grassLight: '#dba273',
  path: '#efd9b4',
  pathEdge: '#9c6b3f',
  pathDots: '#dcc196',
  pool: '#6d4c41',
  poolEdge: '#4e342e',
  foliage: ['#6b8e23', '#7a9a2c', '#556b2f'],
};

const SWAMP: Theme = {
  grass: '#4e7a4a',
  grassDark: '#3e6a3a',
  grassLight: '#5f8c58',
  path: '#8d7b5a',
  pathEdge: '#5f513a',
  pathDots: '#7a6a4b',
  pool: '#2f6b5e',
  poolEdge: '#1f4a40',
  foliage: ['#1b5e20', '#2e5d32', '#33691e'],
};

const VOLCANO: Theme = {
  grass: '#4a3f45',
  grassDark: '#3a3036',
  grassLight: '#5a4d54',
  path: '#8a7f85',
  pathEdge: '#2b2327',
  pathDots: '#9d9298',
  pool: '#ff6b1a',
  poolEdge: '#b33600',
  foliage: ['#3b3135', '#4d3f45', '#2f272b'],
};

const NIGHT: Theme = {
  grass: '#2f5d50',
  grassDark: '#264d42',
  grassLight: '#3a6e5f',
  path: '#c9b98f',
  pathEdge: '#7d6e4a',
  pathDots: '#b3a37a',
  pool: '#3d6fe9',
  poolEdge: '#26489c',
  foliage: ['#1e4d3f', '#24594a', '#183f33'],
};

const v = (x: number, y: number): Vec => ({ x, y });

export const MAPS: MapDef[] = [
  {
    id: 'meadow',
    name: 'Prado Sereno',
    tier: 'Iniciante',
    description: 'Caminho longo e sinuoso. Bom para aprender.',
    theme: MEADOW,
    paths: [
      [v(-40, 100), v(260, 100), v(260, 520), v(500, 520), v(500, 180), v(740, 180), v(740, 460), v(900, 460), v(900, 260), v(1064, 260)],
    ],
    pools: [{ kind: 'pool', x: 380, y: 330, r: 46 }],
    trees: 16,
    rocks: 6,
  },
  {
    id: 'canyon',
    name: 'Desfiladeiro',
    tier: 'Intermediário',
    description: 'Trilha em diagonais pelo cânion. Menos tempo para reagir.',
    theme: CANYON,
    paths: [[v(-40, 320), v(180, 320), v(300, 140), v(520, 140), v(600, 480), v(800, 480), v(880, 260), v(1064, 260)]],
    pools: [
      { kind: 'pool', x: 400, y: 420, r: 60 },
      { kind: 'pool', x: 720, y: 160, r: 50 },
    ],
    trees: 8,
    rocks: 16,
  },
  {
    id: 'swamp',
    name: 'Pântano Duplo',
    tier: 'Avançado',
    description: 'Duas entradas que se juntam. Divida bem suas defesas.',
    theme: SWAMP,
    paths: [
      [v(-40, 110), v(240, 110), v(240, 320), v(640, 320), v(640, 120), v(880, 120), v(880, 520), v(1064, 520)],
      [v(-40, 530), v(240, 530), v(240, 320), v(640, 320), v(640, 120), v(880, 120), v(880, 520), v(1064, 520)],
    ],
    pools: [
      { kind: 'pool', x: 110, y: 320, r: 55 },
      { kind: 'pool', x: 470, y: 480, r: 70 },
      { kind: 'pool', x: 760, y: 300, r: 40 },
    ],
    trees: 14,
    rocks: 4,
  },
  {
    id: 'volcano',
    name: 'Boca do Vulcão',
    tier: 'Especialista',
    description: 'Trilha curta cercada de lava. Cada torre conta.',
    theme: VOLCANO,
    paths: [[v(-40, 320), v(260, 320), v(380, 190), v(640, 450), v(760, 320), v(1064, 320)]],
    pools: [
      { kind: 'pool', x: 130, y: 150, r: 70 },
      { kind: 'pool', x: 150, y: 500, r: 60 },
      { kind: 'pool', x: 520, y: 140, r: 55 },
      { kind: 'pool', x: 500, y: 560, r: 50 },
      { kind: 'pool', x: 900, y: 150, r: 65 },
      { kind: 'pool', x: 900, y: 500, r: 70 },
    ],
    trees: 0,
    rocks: 18,
  },
  {
    id: 'random',
    name: 'Terra Desconhecida',
    tier: 'Intermediário',
    description: 'Mapa novo a cada partida, gerado pelo algoritmo do jogo original.',
    theme: NIGHT,
    paths: [],
    trees: 12,
    rocks: 0,
    procedural: true,
  },
];

const CELL = 64;
const COLS = WORLD_W / CELL; // 16
const ROWS = WORLD_H / CELL; // 10

/**
 * Port do gerador de caminho do jogo original (que descia 3 casas e depois
 * andava na horizontal até uma coluna aleatória), girado para paisagem.
 */
export function generateProceduralPath(rng: Rng): { points: Vec[]; rocks: Obstacle[] } {
  const cells: Vec[] = [];
  let col = -1;
  let row = 1 + Math.floor(rng.next() * (ROWS - 2));
  cells.push(v(col, row));
  const step = (dc: number, dr: number) => {
    col += dc;
    row += dr;
    cells.push(v(col, row));
  };
  while (col < COLS) {
    for (let k = 3; k-- && col < COLS; ) step(1, 0);
    if (col >= COLS) break;
    const target = 1 + Math.floor((row + 2 + rng.next() * (ROWS - 4)) % (ROWS - 2));
    while (row !== target) step(0, target > row ? 1 : -1);
  }
  // mantém só os cantos
  const points: Vec[] = [];
  for (let i = 0; i < cells.length; i++) {
    const prev = cells[i - 1];
    const next = cells[i + 1];
    const c = cells[i];
    if (prev && next && (prev.x === c.x) === (c.x === next.x) && (prev.y === c.y) === (c.y === next.y)) continue;
    points.push(v(c.x * CELL + CELL / 2, c.y * CELL + CELL / 2));
  }
  points[0] = v(-40, points[0].y);
  points[points.length - 1] = v(WORLD_W + 40, points[points.length - 1].y);

  // pedras: 9% das casas livres, como no original
  const used = new Set(cells.map((c) => `${c.x},${c.y}`));
  const rocks: Obstacle[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (used.has(`${c},${r}`) || rng.next() > 0.09) continue;
      rocks.push({ kind: 'rock', x: c * CELL + CELL / 2 + rng.range(-10, 10), y: r * CELL + CELL / 2 + rng.range(-10, 10), r: rng.range(14, 22) });
    }
  }
  return { points, rocks };
}

export function buildMap(def: MapDef, seed: number): GameMap {
  const rng = new Rng(seed);
  let rawPaths = def.paths;
  const obstacles: Obstacle[] = [...(def.pools ?? [])];

  if (def.procedural) {
    const gen = generateProceduralPath(rng);
    rawPaths = [gen.points];
    obstacles.push(...gen.rocks);
  }
  const paths = rawPaths.map((p) => new Path(p));

  const clearOfPath = (x: number, y: number, r: number) =>
    paths.every((p) => p.distanceTo(x, y) > PATH_WIDTH / 2 + r + 6) &&
    obstacles.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r + 4);

  const scatter = (kind: ObstacleKind, count: number, rMin: number, rMax: number) => {
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 60; tries++) {
      const r = rng.range(rMin, rMax);
      const x = rng.range(r, WORLD_W - r);
      const y = rng.range(r, WORLD_H - r);
      if (!clearOfPath(x, y, r)) continue;
      obstacles.push({ kind, x, y, r });
      placed++;
    }
  };
  scatter('tree', def.trees, 16, 26);
  scatter('rock', def.rocks, 10, 20);

  return { def, seed, paths, obstacles };
}
