/** Tamanho lógico do mundo (o canvas escala para caber na tela). */
export const WORLD_W = 1024;
export const WORLD_H = 640;

/** Passo fixo da simulação: 60 ticks por segundo, independente do FPS. */
export const TICK = 1 / 60;

export const PATH_WIDTH = 44;
export const SELL_RATIO = 0.7;

export type DifficultyId = 'easy' | 'normal' | 'hard' | 'impossible';

export interface Difficulty {
  id: DifficultyId;
  name: string;
  lives: number;
  cash: number;
  priceMul: number;
  hpMul: number;
  winWave: number;
  description: string;
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  easy: {
    id: 'easy',
    name: 'Fácil',
    lives: 150,
    cash: 700,
    priceMul: 0.85,
    hpMul: 0.85,
    winWave: 30,
    description: '150 vidas, torres 15% mais baratas, 30 ondas.',
  },
  normal: {
    id: 'normal',
    name: 'Normal',
    lives: 100,
    cash: 650,
    priceMul: 1,
    hpMul: 1,
    winWave: 40,
    description: '100 vidas, preços padrão, 40 ondas.',
  },
  hard: {
    id: 'hard',
    name: 'Difícil',
    lives: 50,
    cash: 600,
    priceMul: 1.08,
    hpMul: 1.15,
    winWave: 50,
    description: '50 vidas, inimigos mais resistentes, 50 ondas.',
  },
  impossible: {
    id: 'impossible',
    name: 'Impossível',
    lives: 1,
    cash: 600,
    priceMul: 1.08,
    hpMul: 1.15,
    winWave: 50,
    description: 'Uma única vida. Qualquer vazamento é derrota.',
  },
};

/** Arredonda preço para múltiplos de 5, como em qualquer TD que se preze. */
export const price = (base: number, mul: number): number => Math.max(5, Math.round((base * mul) / 5) * 5);
