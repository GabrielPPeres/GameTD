import type { SfxName } from '../engine/audio';

export type TowerId = 'archer' | 'cannon' | 'frost' | 'tesla' | 'sniper' | 'prism' | 'mine' | 'totem';

export type AttackKind = 'projectile' | 'lob' | 'pulse' | 'chain' | 'hitscan' | 'beam' | 'income' | 'aura';

export type TargetMode = 'first' | 'last' | 'strong' | 'close';

export const TARGET_MODES: { id: TargetMode; label: string }[] = [
  { id: 'first', label: 'Primeiro' },
  { id: 'last', label: 'Último' },
  { id: 'strong', label: 'Mais forte' },
  { id: 'close', label: 'Mais perto' },
];

/** Todos os atributos que upgrades podem mexer. Valores neutros em `baseStats()`. */
export interface TowerStats {
  range: number;
  /** segundos entre ataques (para o feixe: não usado) */
  cooldown: number;
  /** dano por golpe (para o feixe: dano por segundo) */
  damage: number;
  pierce: number;
  projectileSpeed: number;
  projectiles: number;
  spread: number;
  splash: number;
  slow: number;
  slowDuration: number;
  stunChance: number;
  stunDuration: number;
  burnDps: number;
  burnDuration: number;
  armorPierce: boolean;
  shred: number;
  brittle: number;
  detect: boolean;
  chains: number;
  chainRange: number;
  crit: number;
  critMul: number;
  bossMul: number;
  multiTarget: number;
  shrapnel: number;
  cluster: number;
  rampMax: number;
  rampRate: number;
  beamLine: boolean;
  income: number;
  bounty: number;
  discount: number;
  lifeRegen: number;
  interest: number;
  auraFireRate: number;
  auraDamage: number;
  auraRange: number;
  auraPierce: number;
  auraDetect: boolean;
  auraArmorPierce: boolean;
}

export const baseStats = (): TowerStats => ({
  range: 100,
  cooldown: 1,
  damage: 0,
  pierce: 1,
  projectileSpeed: 500,
  projectiles: 1,
  spread: 0,
  splash: 0,
  slow: 0,
  slowDuration: 0,
  stunChance: 0,
  stunDuration: 0,
  burnDps: 0,
  burnDuration: 0,
  armorPierce: false,
  shred: 0,
  brittle: 0,
  detect: false,
  chains: 0,
  chainRange: 0,
  crit: 0,
  critMul: 1,
  bossMul: 1,
  multiTarget: 1,
  shrapnel: 0,
  cluster: 0,
  rampMax: 1,
  rampRate: 0,
  beamLine: false,
  income: 0,
  bounty: 0,
  discount: 0,
  lifeRegen: 0,
  interest: 0,
  auraFireRate: 0,
  auraDamage: 0,
  auraRange: 0,
  auraPierce: 0,
  auraDetect: false,
  auraArmorPierce: false,
});

export interface Upgrade {
  name: string;
  description: string;
  cost: number;
  apply: (s: TowerStats) => void;
}

export interface UpgradePath {
  name: string;
  color: string;
  tiers: [Upgrade, Upgrade, Upgrade, Upgrade];
}

export interface TowerDef {
  id: TowerId;
  name: string;
  description: string;
  cost: number;
  kind: AttackKind;
  /** raio ocupado no chão */
  radius: number;
  color: string;
  accent: string;
  hotkey: string;
  sfx: SfxName | null;
  base: Partial<TowerStats>;
  paths: [UpgradePath, UpgradePath];
}

/** Regra de cruzamento: um caminho vai até o nível 4, o outro até o 2. */
export const MAX_TIER = 4;
export const CROSS_TIER = 2;

const up = (name: string, cost: number, description: string, apply: (s: TowerStats) => void): Upgrade => ({
  name,
  cost,
  description,
  apply,
});

export const TOWERS: Record<TowerId, TowerDef> = {
  archer: {
    id: 'archer',
    name: 'Arqueiro',
    description: 'Disparos rápidos que atravessam inimigos. Barato e versátil.',
    cost: 180,
    kind: 'projectile',
    radius: 16,
    color: '#b5763a',
    accent: '#f6d365',
    hotkey: '1',
    sfx: 'arrow',
    base: { range: 145, cooldown: 0.62, damage: 3, pierce: 2, projectileSpeed: 620 },
    paths: [
      {
        name: 'Precisão',
        color: '#ff9f43',
        tiers: [
          up('Flechas Afiadas', 140, '+1 dano e +1 perfuração.', (s) => {
            s.damage += 1;
            s.pierce += 1;
          }),
          up('Ponta de Aço', 260, 'Flechas ignoram armadura. +1 dano.', (s) => {
            s.armorPierce = true;
            s.damage += 1;
          }),
          up('Rajada Tripla', 650, 'Dispara 3 flechas em leque.', (s) => {
            s.projectiles = 3;
            s.spread = 0.22;
          }),
          up('Tempestade de Flechas', 2800, 'Ataca quase 3x mais rápido com 5 flechas.', (s) => {
            s.cooldown *= 0.35;
            s.projectiles = 5;
            s.spread = 0.3;
            s.pierce += 3;
            s.damage += 2;
          }),
        ],
      },
      {
        name: 'Vigia',
        color: '#48dbfb',
        tiers: [
          up('Arco Longo', 110, '+25% de alcance e flechas mais velozes.', (s) => {
            s.range *= 1.25;
            s.projectileSpeed *= 1.3;
          }),
          up('Olho de Lince', 220, 'Detecta inimigos FURTIVOS. +15 alcance.', (s) => {
            s.detect = true;
            s.range += 15;
          }),
          up('Flechas Flamejantes', 900, 'Incendeia o alvo: 8 de dano/s por 3 s.', (s) => {
            s.burnDps = Math.max(s.burnDps, 8);
            s.burnDuration = 3;
            s.damage += 1;
          }),
          up('Mestre Arqueiro', 3600, '30% de chance de crítico x4, atira mais rápido.', (s) => {
            s.crit = 0.3;
            s.critMul = 4;
            s.cooldown *= 0.6;
            s.damage += 4;
            s.range += 20;
          }),
        ],
      },
    ],
  },
  cannon: {
    id: 'cannon',
    name: 'Morteiro',
    description: 'Bombas em arco que explodem em área. Ótimo contra grupos.',
    cost: 420,
    kind: 'lob',
    radius: 18,
    color: '#576574',
    accent: '#222f3e',
    hotkey: '2',
    sfx: 'cannon',
    base: { range: 160, cooldown: 1.4, damage: 7, splash: 42, pierce: 40 },
    paths: [
      {
        name: 'Explosivos',
        color: '#ff6b6b',
        tiers: [
          up('Pólvora Extra', 220, 'Explosões 33% maiores.', (s) => {
            s.splash += 14;
          }),
          up('Bombas Pesadas', 420, '+6 dano e reduz armadura em 3.', (s) => {
            s.damage += 6;
            s.shred = Math.max(s.shred, 3);
          }),
          up('Fragmentação', 1100, 'Cada bomba solta 6 granadas extras.', (s) => {
            s.cluster = 6;
          }),
          up('Bombarda Real', 5200, 'Dano massivo, atordoa e causa 2x em chefes.', (s) => {
            s.damage = s.damage * 3 + 20;
            s.splash += 20;
            s.stunChance = 1;
            s.stunDuration = 0.5;
            s.bossMul = 2;
          }),
        ],
      },
      {
        name: 'Artilharia',
        color: '#feca57',
        tiers: [
          up('Recarga Rápida', 260, 'Dispara 25% mais rápido.', (s) => {
            s.cooldown *= 0.75;
          }),
          up('Cano Longo', 300, '+40 de alcance.', (s) => {
            s.range += 40;
          }),
          up('Napalm', 1300, 'Explosões incendeiam: 12 de dano/s por 3 s.', (s) => {
            s.burnDps = Math.max(s.burnDps, 12);
            s.burnDuration = 3;
          }),
          up('Bateria Dupla', 4200, 'Duas bombas por disparo, quase 2x mais rápido.', (s) => {
            s.projectiles = 2;
            s.cooldown *= 0.55;
            s.burnDps += 15;
          }),
        ],
      },
    ],
  },
  frost: {
    id: 'frost',
    name: 'Torre de Gelo',
    description: 'Pulso congelante: desacelera tudo em volta e REVELA furtivos para as outras torres.',
    cost: 300,
    kind: 'pulse',
    radius: 16,
    color: '#74b9ff',
    accent: '#dff9fb',
    hotkey: '3',
    sfx: 'frost',
    base: { range: 85, cooldown: 1.2, damage: 1, slow: 0.4, slowDuration: 1.5, armorPierce: true },
    paths: [
      {
        name: 'Inverno',
        color: '#c8d6e5',
        tiers: [
          up('Frio Intenso', 180, 'Lentidão de 55% e mais longa.', (s) => {
            s.slow = Math.max(s.slow, 0.55);
            s.slowDuration += 0.5;
          }),
          up('Congelamento', 380, '15% de chance de congelar por 0,9 s.', (s) => {
            s.stunChance = Math.max(s.stunChance, 0.15);
            s.stunDuration = Math.max(s.stunDuration, 0.9);
          }),
          up('Nevasca', 1100, '+30 alcance, pulsos mais rápidos, 65% de lentidão.', (s) => {
            s.range += 30;
            s.cooldown *= 0.8;
            s.slow = Math.max(s.slow, 0.65);
          }),
          up('Zero Absoluto', 3900, '40% de chance de congelar por 1,4 s. +6 dano.', (s) => {
            s.stunChance = 0.4;
            s.stunDuration = 1.4;
            s.damage += 6;
          }),
        ],
      },
      {
        name: 'Gelo Cortante',
        color: '#0abde3',
        tiers: [
          up('Cristais Afiados', 220, '+3 de dano por pulso.', (s) => {
            s.damage += 3;
          }),
          up('Fragilizar', 450, 'Reduz a armadura dos atingidos em 4.', (s) => {
            s.shred = Math.max(s.shred, 4);
          }),
          up('Estilhaçar', 1500, 'Atingidos sofrem +35% de dano de tudo.', (s) => {
            s.brittle = Math.max(s.brittle, 0.35);
          }),
          up('Era Glacial', 4500, '+18 dano, pulsos 40% mais rápidos, +60% de dano sofrido.', (s) => {
            s.damage += 18;
            s.cooldown *= 0.6;
            s.brittle = Math.max(s.brittle, 0.6);
          }),
        ],
      },
    ],
  },
  tesla: {
    id: 'tesla',
    name: 'Bobina Tesla',
    description: 'Raio que salta entre inimigos próximos.',
    cost: 550,
    kind: 'chain',
    radius: 17,
    color: '#5f27cd',
    accent: '#a29bfe',
    hotkey: '4',
    sfx: 'zap',
    base: { range: 125, cooldown: 1.1, damage: 8, chains: 3, chainRange: 70 },
    paths: [
      {
        name: 'Corrente',
        color: '#a29bfe',
        tiers: [
          up('Bobina Extra', 250, 'O raio salta +2 vezes.', (s) => {
            s.chains += 2;
          }),
          up('Alta Voltagem', 500, '+6 de dano.', (s) => {
            s.damage += 6;
          }),
          up('Tempestade Elétrica', 1700, '+4 saltos e saltos mais longos.', (s) => {
            s.chains += 4;
            s.chainRange += 30;
          }),
          up('Deus do Trovão', 6500, 'Lança 3 raios independentes. +14 dano.', (s) => {
            s.multiTarget = 3;
            s.damage += 14;
          }),
        ],
      },
      {
        name: 'Sobrecarga',
        color: '#feca57',
        tiers: [
          up('Capacitor', 300, 'Dispara 20% mais rápido.', (s) => {
            s.cooldown *= 0.8;
          }),
          up('Choque', 550, '12% de chance de atordoar por 0,5 s.', (s) => {
            s.stunChance = Math.max(s.stunChance, 0.12);
            s.stunDuration = Math.max(s.stunDuration, 0.5);
          }),
          up('Plasma', 1600, 'Ignora armadura, detecta furtivos, +6 dano.', (s) => {
            s.armorPierce = true;
            s.detect = true;
            s.damage += 6;
          }),
          up('Arco Voltaico', 5800, 'Dispara quase 3x mais rápido. +2 saltos.', (s) => {
            s.cooldown *= 0.35;
            s.chains += 2;
          }),
        ],
      },
    ],
  },
  sniper: {
    id: 'sniper',
    name: 'Atirador',
    description: 'Alcance infinito e golpes pesados. Não vê furtivos sem upgrade.',
    cost: 380,
    kind: 'hitscan',
    radius: 15,
    color: '#3b6e3b',
    accent: '#1e3d1e',
    hotkey: '5',
    sfx: 'snipe',
    base: { range: 2000, cooldown: 1.6, damage: 14 },
    paths: [
      {
        name: 'Calibre',
        color: '#ee5253',
        tiers: [
          up('Calibre Pesado', 300, '+8 dano e ignora armadura.', (s) => {
            s.damage += 8;
            s.armorPierce = true;
          }),
          up('Ponto Fraco', 600, '20% de chance de crítico x3.', (s) => {
            s.crit = Math.max(s.crit, 0.2);
            s.critMul = Math.max(s.critMul, 3);
          }),
          up('Matador de Gigantes', 2200, '3x de dano em chefes. +20 dano.', (s) => {
            s.bossMul = 3;
            s.damage += 20;
          }),
          up('Assassino', 7500, 'Dano x2,5. Críticos x6 com 30% de chance.', (s) => {
            s.damage *= 2.5;
            s.crit = 0.3;
            s.critMul = 6;
          }),
        ],
      },
      {
        name: 'Tática',
        color: '#48dbfb',
        tiers: [
          up('Mira Noturna', 220, 'Detecta inimigos FURTIVOS.', (s) => {
            s.detect = true;
          }),
          up('Ferrolho Rápido', 450, 'Atira 40% mais rápido.', (s) => {
            s.cooldown *= 0.6;
          }),
          up('Estilhaços', 1800, 'Cada tiro solta 5 estilhaços no impacto.', (s) => {
            s.shrapnel = 5;
          }),
          up('Elite Tática', 6000, 'Atira 2,5x mais rápido. +10 dano, +3 estilhaços.', (s) => {
            s.cooldown *= 0.4;
            s.damage += 10;
            s.shrapnel += 3;
          }),
        ],
      },
    ],
  },
  prism: {
    id: 'prism',
    name: 'Prisma',
    description: 'Feixe contínuo que esquenta: quanto mais tempo no alvo, mais dano.',
    cost: 700,
    kind: 'beam',
    radius: 17,
    color: '#ff9ff3',
    accent: '#f368e0',
    hotkey: '6',
    sfx: null,
    base: { range: 135, damage: 14, rampMax: 2, rampRate: 0.6 },
    paths: [
      {
        name: 'Foco',
        color: '#ff6b6b',
        tiers: [
          up('Lente Focal', 350, '+8 de dano por segundo.', (s) => {
            s.damage += 8;
          }),
          up('Superaquecimento', 700, 'Esquenta até 4x o dano.', (s) => {
            s.rampMax = 4;
            s.rampRate = 1.2;
          }),
          up('Feixe Fundente', 2400, 'Ignora armadura e incendeia.', (s) => {
            s.armorPierce = true;
            s.burnDps = Math.max(s.burnDps, 14);
            s.burnDuration = 2;
          }),
          up('Raio Solar', 9000, 'O feixe atravessa tudo em linha reta. +40 dano/s.', (s) => {
            s.beamLine = true;
            s.damage += 40;
          }),
        ],
      },
      {
        name: 'Refração',
        color: '#48dbfb',
        tiers: [
          up('Prisma Duplo', 450, 'Divide o feixe em 2 alvos.', (s) => {
            s.multiTarget = Math.max(s.multiTarget, 2);
          }),
          up('Refração', 400, '+30 alcance e detecta furtivos.', (s) => {
            s.range += 30;
            s.detect = true;
          }),
          up('Prisma Triplo', 2000, '3 feixes, +10 dano/s.', (s) => {
            s.multiTarget = Math.max(s.multiTarget, 3);
            s.damage += 10;
          }),
          up('Caleidoscópio', 7000, '6 feixes, +25 dano/s.', (s) => {
            s.multiTarget = 6;
            s.damage += 25;
          }),
        ],
      },
    ],
  },
  mine: {
    id: 'mine',
    name: 'Mina de Ouro',
    description: 'Gera ouro ao fim de cada onda. Não ataca.',
    cost: 800,
    kind: 'income',
    radius: 20,
    color: '#feca57',
    accent: '#8e6d2f',
    hotkey: '7',
    sfx: null,
    base: { range: 110, income: 80 },
    paths: [
      {
        name: 'Mineração',
        color: '#feca57',
        tiers: [
          up('Veio Rico', 500, '+40 de ouro por onda.', (s) => {
            s.income += 40;
          }),
          up('Filão', 900, '+70 de ouro por onda.', (s) => {
            s.income += 70;
          }),
          up('Mina Profunda', 2500, '+200 de ouro por onda.', (s) => {
            s.income += 200;
          }),
          up('Montanha de Ouro', 8000, '+700 de ouro por onda.', (s) => {
            s.income += 700;
          }),
        ],
      },
      {
        name: 'Comércio',
        color: '#1dd1a1',
        tiers: [
          up('Coletores', 400, 'Abates no alcance rendem +1 de ouro.', (s) => {
            s.bounty = 1;
          }),
          up('Mercado', 900, 'Upgrades de torres no alcance custam 10% menos.', (s) => {
            s.discount = 0.1;
          }),
          up('Seguros', 1800, '+3 vidas e +60 de ouro por onda.', (s) => {
            s.lifeRegen += 3;
            s.income += 60;
          }),
          up('Banco Central', 7000, 'Rende 5% de juros sobre o ouro guardado (máx. 2.000).', (s) => {
            s.interest = 0.05;
            s.bounty = 3;
          }),
        ],
      },
    ],
  },
  totem: {
    id: 'totem',
    name: 'Totem de Guerra',
    description: 'Fortalece as torres em volta. Não ataca.',
    cost: 650,
    kind: 'aura',
    radius: 17,
    color: '#a4826a',
    accent: '#ee5253',
    hotkey: '8',
    sfx: null,
    base: { range: 120, auraFireRate: 0.08 },
    paths: [
      {
        name: 'Fúria',
        color: '#ff6b6b',
        tiers: [
          up('Tambores', 400, 'Torres próximas atacam 15% mais rápido.', (s) => {
            s.auraFireRate = Math.max(s.auraFireRate, 0.15);
          }),
          up('Frenesi', 900, '+22% de velocidade e +1 perfuração.', (s) => {
            s.auraFireRate = Math.max(s.auraFireRate, 0.22);
            s.auraPierce = Math.max(s.auraPierce, 1);
          }),
          up('Grito de Guerra', 2600, '+30% de velocidade e +20% de dano.', (s) => {
            s.auraFireRate = Math.max(s.auraFireRate, 0.3);
            s.auraDamage = Math.max(s.auraDamage, 0.2);
          }),
          up('Avatar da Guerra', 9000, '+50% de velocidade, +45% de dano, +2 perfuração.', (s) => {
            s.auraFireRate = 0.5;
            s.auraDamage = Math.max(s.auraDamage, 0.45);
            s.auraPierce = 2;
          }),
        ],
      },
      {
        name: 'Sabedoria',
        color: '#48dbfb',
        tiers: [
          up('Olhos Espirituais', 350, 'Torres próximas detectam FURTIVOS.', (s) => {
            s.auraDetect = true;
          }),
          up('Horizonte', 500, 'Torres próximas ganham +15% de alcance.', (s) => {
            s.auraRange = Math.max(s.auraRange, 0.15);
            s.range += 20;
          }),
          up('Runas de Poder', 2200, 'Torres próximas causam +25% de dano.', (s) => {
            s.auraDamage = Math.max(s.auraDamage, 0.25);
          }),
          up('Santuário', 7500, 'Torres próximas ignoram armadura. +30% alcance, +40% dano.', (s) => {
            s.auraArmorPierce = true;
            s.auraRange = Math.max(s.auraRange, 0.3);
            s.auraDamage = Math.max(s.auraDamage, 0.4);
          }),
        ],
      },
    ],
  },
};

export const TOWER_ORDER: TowerId[] = ['archer', 'cannon', 'frost', 'tesla', 'sniper', 'prism', 'mine', 'totem'];

/** Stats de uma torre para um par de níveis (sem bônus de aura). */
export function computeStats(def: TowerDef, tiers: readonly [number, number]): TowerStats {
  const s = { ...baseStats(), ...def.base };
  for (let p = 0; p < 2; p++) {
    for (let t = 0; t < tiers[p]; t++) def.paths[p].tiers[t].apply(s);
  }
  return s;
}

/** Retorna o motivo do bloqueio, ou null se o upgrade é permitido pela regra de caminhos. */
export function upgradeBlockReason(tiers: readonly [number, number], path: 0 | 1): string | null {
  const next = tiers[path] + 1;
  if (next > MAX_TIER) return 'Nível máximo';
  const other = tiers[1 - path];
  if (next > CROSS_TIER && other > CROSS_TIER) return 'Caminho bloqueado';
  return null;
}
