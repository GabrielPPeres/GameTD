export type EnemyId =
  | 'slime'
  | 'runner'
  | 'swarm'
  | 'brute'
  | 'splitter'
  | 'baby'
  | 'shade'
  | 'regen'
  | 'healer'
  | 'golem'
  | 'wraith'
  | 'colossus'
  | 'titan'
  | 'leviathan';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  description: string;
  hp: number;
  /** pixels por segundo */
  speed: number;
  /** redução fixa de dano (ignorada por dano perfurante) */
  armor: number;
  reward: number;
  /** vidas perdidas ao vazar */
  leak: number;
  radius: number;
  color: string;
  dark: string;
  stealth?: boolean;
  /** % da vida máxima recuperada por segundo (após 1 s sem dano) */
  regen?: number;
  /** 0..1: quanto da lentidão é ignorada */
  slowResist?: number;
  stunImmune?: boolean;
  splitInto?: { id: EnemyId; count: number };
  heal?: { amount: number; radius: number; interval: number };
  /** invoca lacaios periodicamente */
  summon?: { id: EnemyId; count: number; interval: number };
  boss?: boolean;
  /** custo de "ameaça" usado pelo gerador de ondas */
  threat: number;
  /** primeira onda em que aparece no gerador */
  unlock: number;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  slime: {
    id: 'slime',
    name: 'Gosma',
    description: 'Inimigo básico.',
    hp: 14,
    speed: 58,
    armor: 0,
    reward: 2,
    leak: 1,
    radius: 11,
    color: '#7bd651',
    dark: '#3f8a2a',
    threat: 1,
    unlock: 1,
  },
  runner: {
    id: 'runner',
    name: 'Corredor',
    description: 'Rápido e frágil.',
    hp: 10,
    speed: 118,
    armor: 0,
    reward: 2,
    leak: 1,
    radius: 9,
    color: '#ffd23f',
    dark: '#b8860b',
    threat: 1.3,
    unlock: 3,
  },
  swarm: {
    id: 'swarm',
    name: 'Enxame',
    description: 'Pequenos, rápidos, sempre em bando.',
    hp: 6,
    speed: 135,
    armor: 0,
    reward: 1,
    leak: 1,
    radius: 6,
    color: '#ff9f43',
    dark: '#b3601b',
    threat: 0.6,
    unlock: 7,
  },
  brute: {
    id: 'brute',
    name: 'Brutamonte',
    description: 'Blindado: armadura 3 reduz cada golpe.',
    hp: 50,
    speed: 42,
    armor: 3,
    reward: 5,
    leak: 2,
    radius: 15,
    color: '#8395a7',
    dark: '#465566',
    threat: 6,
    unlock: 5,
  },
  splitter: {
    id: 'splitter',
    name: 'Mãe-Gosma',
    description: 'Ao morrer, se divide em 4 filhotes.',
    hp: 45,
    speed: 48,
    armor: 0,
    reward: 3,
    leak: 3,
    radius: 15,
    color: '#ff6b9d',
    dark: '#a3355b',
    splitInto: { id: 'baby', count: 4 },
    threat: 6,
    unlock: 8,
  },
  baby: {
    id: 'baby',
    name: 'Filhote',
    description: 'Cria da Mãe-Gosma.',
    hp: 9,
    speed: 80,
    armor: 0,
    reward: 1,
    leak: 1,
    radius: 7,
    color: '#ff9cc0',
    dark: '#a3355b',
    threat: 0.8,
    unlock: 999,
  },
  shade: {
    id: 'shade',
    name: 'Sombra',
    description: 'FURTIVA: só torres com detecção conseguem mirar.',
    hp: 24,
    speed: 72,
    armor: 0,
    reward: 4,
    leak: 1,
    radius: 11,
    color: '#a55eea',
    dark: '#5b2a8c',
    stealth: true,
    threat: 4,
    unlock: 10,
  },
  regen: {
    id: 'regen',
    name: 'Musgoso',
    description: 'Regenera 8% da vida por segundo se não tomar dano.',
    hp: 60,
    speed: 52,
    armor: 0,
    reward: 4,
    leak: 2,
    radius: 13,
    color: '#1dd1a1',
    dark: '#0b7a5c',
    regen: 0.08,
    threat: 5,
    unlock: 12,
  },
  healer: {
    id: 'healer',
    name: 'Xamã',
    description: 'Cura os inimigos próximos a cada 2 s.',
    hp: 55,
    speed: 46,
    armor: 1,
    reward: 6,
    leak: 2,
    radius: 13,
    color: '#48dbfb',
    dark: '#1a7f99',
    heal: { amount: 0.1, radius: 80, interval: 2 },
    threat: 7,
    unlock: 14,
  },
  golem: {
    id: 'golem',
    name: 'Golem',
    description: 'Armadura 8, resiste a lentidão e atordoamento.',
    hp: 320,
    speed: 32,
    armor: 8,
    reward: 14,
    leak: 6,
    radius: 19,
    color: '#a4826a',
    dark: '#5e4636',
    slowResist: 0.5,
    stunImmune: true,
    threat: 32,
    unlock: 17,
  },
  wraith: {
    id: 'wraith',
    name: 'Espectro',
    description: 'Furtivo, rápido e regenera.',
    hp: 90,
    speed: 88,
    armor: 1,
    reward: 8,
    leak: 4,
    radius: 13,
    color: '#dfe6e9',
    dark: '#636e72',
    stealth: true,
    regen: 0.05,
    threat: 16,
    unlock: 22,
  },
  colossus: {
    id: 'colossus',
    name: 'Colosso',
    description: 'CHEFE. Ao cair, libera 6 Brutamontes.',
    hp: 700,
    speed: 24,
    armor: 2,
    reward: 150,
    leak: 40,
    radius: 30,
    color: '#ee5253',
    dark: '#8e1f20',
    slowResist: 0.6,
    stunImmune: true,
    splitInto: { id: 'brute', count: 6 },
    boss: true,
    threat: 400,
    unlock: 999,
  },
  titan: {
    id: 'titan',
    name: 'Titã',
    description: 'CHEFE. Invoca Musgosos sem parar. Ao cair, libera 4 Golems.',
    hp: 14000,
    speed: 19,
    armor: 10,
    reward: 450,
    leak: 200,
    radius: 38,
    color: '#576574',
    dark: '#222f3e',
    slowResist: 0.75,
    stunImmune: true,
    splitInto: { id: 'golem', count: 4 },
    summon: { id: 'regen', count: 3, interval: 4 },
    boss: true,
    threat: 2400,
    unlock: 999,
  },
  leviathan: {
    id: 'leviathan',
    name: 'Leviatã',
    description: 'CHEFE FINAL. Furtivo, regenera e libera 2 Titãs.',
    hp: 70000,
    speed: 15,
    armor: 14,
    reward: 1500,
    leak: 9999,
    radius: 48,
    color: '#341f97',
    dark: '#130a45',
    stealth: true,
    regen: 0.004,
    slowResist: 0.85,
    stunImmune: true,
    splitInto: { id: 'titan', count: 2 },
    summon: { id: 'wraith', count: 2, interval: 5 },
    boss: true,
    threat: 12000,
    unlock: 999,
  },
};
