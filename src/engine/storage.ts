import type { DifficultyId } from '../game/config';

const KEY = 'muralha-td-v1';

export interface SaveData {
  bestWave: Record<string, number>;
  medals: Record<string, DifficultyId[]>;
  settings: {
    volume: number;
    autoStart: boolean;
    showDamage: boolean;
  };
}

const defaults = (): SaveData => ({
  bestWave: {},
  medals: {},
  settings: { volume: 0.6, autoStart: false, showDamage: false },
});

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const d = defaults();
    return {
      bestWave: { ...d.bestWave, ...parsed.bestWave },
      medals: { ...d.medals, ...parsed.medals },
      settings: { ...d.settings, ...parsed.settings },
    };
  } catch {
    return defaults();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* modo privado / sem storage: ignora */
  }
}

export function recordResult(data: SaveData, mapId: string, diff: DifficultyId, wave: number, won: boolean): void {
  const key = `${mapId}:${diff}`;
  data.bestWave[key] = Math.max(data.bestWave[key] ?? 0, wave);
  if (won) {
    const list = data.medals[mapId] ?? [];
    if (!list.includes(diff)) list.push(diff);
    data.medals[mapId] = list;
  }
  writeSave(data);
}
