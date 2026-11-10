import { formatNumber } from '../engine/math';
import { ENEMIES, type EnemyId } from '../game/enemies';
import { baseStats, TARGET_MODES, TOWER_ORDER, TOWERS, type TargetMode, type TowerDef, type TowerId, type TowerStats } from '../game/towers';
import { wavePreview } from '../game/waves';
import type { Tower, World } from '../game/world';
import { enemyIcon, towerIcon } from '../render/sprites';
import { h, icon, setText, toggleClass } from './dom';
import { ICON } from './icons';

export interface HudActions {
  pickTower(id: TowerId): void;
  upgrade(path: 0 | 1): void;
  sell(): void;
  setTarget(mode: TargetMode): void;
  deselect(): void;
  startWave(): void;
  cycleSpeed(): void;
  togglePause(): void;
  toggleAuto(): void;
  openMenu(): void;
}

export interface HudState {
  placing: TowerId | null;
  selected: Tower | null;
  speed: number;
  paused: boolean;
}

const towerIcons = new Map<TowerId, string>();
const enemyIcons = new Map<EnemyId, string>();
const tIcon = (def: TowerDef) => {
  let s = towerIcons.get(def.id);
  if (!s) towerIcons.set(def.id, (s = towerIcon(def)));
  return s;
};
const eIcon = (id: EnemyId) => {
  let s = enemyIcons.get(id);
  if (!s) enemyIcons.set(id, (s = enemyIcon(ENEMIES[id])));
  return s;
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
const num = (v: number) => (v >= 100 ? formatNumber(v) : v.toFixed(v % 1 ? 1 : 0).replace('.', ','));

/** Linhas de atributos relevantes por tipo de torre. */
export function statLines(def: TowerDef, s: TowerStats): [string, string][] {
  const rate = (1 / s.cooldown).toFixed(2).replace('.', ',') + '/s';
  const range = s.range > 1500 ? '∞' : num(s.range);
  switch (def.kind) {
    case 'projectile':
      return [['Dano', num(s.damage) + (s.projectiles > 1 ? ` ×${s.projectiles}` : '')], ['Perfuração', num(s.pierce)], ['Alcance', range], ['Ataques', rate]];
    case 'lob':
      return [['Dano', num(s.damage) + (s.projectiles > 1 ? ` ×${s.projectiles}` : '')], ['Explosão', num(s.splash)], ['Alcance', range], ['Ataques', rate]];
    case 'pulse':
      return [['Dano', num(s.damage)], ['Lentidão', pct(s.slow)], ['Alcance', range], ['Pulsos', rate]];
    case 'chain':
      return [['Dano', num(s.damage) + (s.multiTarget > 1 ? ` ×${s.multiTarget}` : '')], ['Saltos', num(s.chains)], ['Alcance', range], ['Ataques', rate]];
    case 'hitscan':
      return [['Dano', num(s.damage)], ['Crítico', s.crit ? `${pct(s.crit)} ×${s.critMul}` : '—'], ['Alcance', range], ['Ataques', rate]];
    case 'beam':
      return [['Dano/s', num(s.damage)], ['Feixes', num(s.multiTarget)], ['Alcance', range], ['Aquece até', `×${s.rampMax}`]];
    case 'income':
      return [['Ouro/onda', num(s.income)], ['Por abate', s.bounty ? `+${s.bounty}` : '—'], ['Desconto', s.discount ? pct(s.discount) : '—'], ['Vidas/onda', s.lifeRegen ? `+${s.lifeRegen}` : '—']];
    case 'aura':
      return [['Vel. ataque', `+${pct(s.auraFireRate)}`], ['Dano', s.auraDamage ? `+${pct(s.auraDamage)}` : '—'], ['Alcance', s.auraRange ? `+${pct(s.auraRange)}` : '—'], ['Detecção', s.auraDetect ? 'Sim' : 'Não']];
  }
}

export class Hud {
  readonly root: HTMLElement;
  readonly stage: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;

  private livesEl: HTMLSpanElement;
  private livesBox: HTMLDivElement;
  private cashEl: HTMLSpanElement;
  private waveEl: HTMLSpanElement;
  private speedBtn: HTMLButtonElement;
  private speedLabel: HTMLSpanElement;
  private autoBtn: HTMLButtonElement;
  private pauseBtn: HTMLButtonElement;
  private pausedTag: HTMLDivElement;
  private bannerEl: HTMLDivElement;
  private shopItems = new Map<TowerId, HTMLButtonElement>();
  private inspector: HTMLDivElement;
  private shopWrap: HTMLDivElement;
  private waveTitle: HTMLDivElement;
  private previewEl: HTMLDivElement;
  private warnEl: HTMLDivElement;
  private startBtn: HTMLButtonElement;
  private tooltip: HTMLDivElement;

  private inspKey = '';
  private inspRefs: {
    kills: HTMLElement;
    dmg: HTMLElement;
    sell: HTMLButtonElement;
    ups: { btn: HTMLButtonElement | null; path: 0 | 1 }[];
    targets: Map<TargetMode, HTMLButtonElement>;
  } | null = null;
  private previewWave = -1;
  private lastLives = -1;
  private lastCash = -1;

  constructor(private actions: HudActions) {
    this.livesEl = h('span');
    this.cashEl = h('span');
    this.waveEl = h('span');
    this.livesBox = h('div', { class: 'stat lives', title: 'Vidas da muralha' }, icon(ICON.heart), this.livesEl);
    this.speedLabel = h('span', { class: 'speed-label' }, '1x');
    this.speedBtn = h('button', { class: 'btn', title: 'Velocidade (F)', onclick: () => actions.cycleSpeed() }, icon(ICON.fast), this.speedLabel);
    this.autoBtn = h('button', { class: 'btn icon-btn', title: 'Iniciar ondas automaticamente', onclick: () => actions.toggleAuto() }, icon(ICON.auto));
    this.pauseBtn = h('button', { class: 'btn icon-btn', title: 'Pausar (P)', onclick: () => actions.togglePause() }, icon(ICON.pause));

    const top = h(
      'div',
      { class: 'hud-top' },
      this.livesBox,
      h('div', { class: 'stat cash', title: 'Ouro' }, icon(ICON.coin), this.cashEl),
      h('div', { class: 'stat wave', title: 'Onda' }, icon(ICON.flag), this.waveEl),
      h('div', { class: 'hud-spacer' }),
      this.speedBtn,
      this.autoBtn,
      this.pauseBtn,
      h('button', { class: 'btn icon-btn', title: 'Menu (Esc)', onclick: () => actions.openMenu() }, icon(ICON.gear)),
    );

    this.canvas = h('canvas', { id: 'game-canvas' });
    this.bannerEl = h('div', { class: 'banner' });
    this.pausedTag = h('div', { class: 'paused-tag' }, 'PAUSADO');
    this.pausedTag.hidden = true;
    this.stage = h('div', { id: 'stage' }, this.canvas, this.bannerEl, this.pausedTag);

    // loja
    const shop = h('div', { class: 'shop' });
    for (const id of TOWER_ORDER) {
      const def = TOWERS[id];
      const costEl = h('span', { class: 'cost' }, icon(ICON.coin), h('span', { class: 'v' }, String(def.cost)));
      const item = h(
        'button',
        { class: 'shop-item', onclick: () => actions.pickTower(id) },
        h('span', { class: 'key' }, def.hotkey),
        h('img', { src: tIcon(def), alt: def.name, draggable: 'false' }),
        h('span', { class: 'name' }, def.name),
        costEl,
      );
      item.addEventListener('mouseenter', (ev) => this.showTowerTip(def, ev));
      item.addEventListener('mousemove', (ev) => this.moveTip(ev));
      item.addEventListener('mouseleave', () => this.hideTip());
      this.shopItems.set(id, item);
      shop.append(item);
    }
    this.shopWrap = h('div', {}, h('div', { class: 'panel-title' }, 'Torres'), shop);

    this.inspector = h('div', { class: 'inspector' });
    this.inspector.hidden = true;

    this.waveTitle = h('div', { class: 'panel-title' }, 'Próxima onda');
    this.previewEl = h('div', { class: 'preview' });
    this.warnEl = h('div', { class: 'warn' });
    this.startBtn = h('button', { class: 'btn primary start-btn', onclick: () => actions.startWave() }, icon(ICON.play), h('span', {}, 'Iniciar onda'));
    const wavePanel = h('div', { class: 'wave-panel' }, this.waveTitle, this.previewEl, this.warnEl, this.startBtn);

    const sidebar = h('aside', { id: 'sidebar' }, h('div', { class: 'side-scroll' }, this.shopWrap, this.inspector), wavePanel);
    this.root = h('section', { id: 'screen-game', class: 'screen' }, top, h('div', { class: 'game-main' }, this.stage, sidebar));

    this.tooltip = h('div', { class: 'tooltip hidden' });
    document.body.append(this.tooltip);
  }

  banner(text: string, sub = '', boss = false): void {
    const b = this.bannerEl;
    b.className = 'banner';
    b.replaceChildren(text, ...(sub ? [h('small', {}, sub)] : []));
    void b.offsetWidth; // reinicia a animação
    b.className = `banner show${boss ? ' boss' : ''}`;
  }

  resetCaches(): void {
    this.inspKey = '';
    this.previewWave = -1;
    this.lastLives = -1;
    this.lastCash = -1;
  }

  update(world: World, st: HudState): void {
    // topo
    const lives = Math.max(0, Math.floor(world.lives));
    setText(this.livesEl, formatNumber(lives));
    if (this.lastLives >= 0 && lives < this.lastLives) {
      this.livesBox.classList.remove('hurt');
      void this.livesBox.offsetWidth;
      this.livesBox.classList.add('hurt');
    }
    this.lastLives = lives;
    const cash = Math.floor(world.cash);
    setText(this.cashEl, formatNumber(cash));
    const total = world.freeplay ? ' (livre)' : ` / ${world.diff.winWave}`;
    setText(this.waveEl, `${Math.max(1, world.wave)}${total}`);
    setText(this.speedLabel, `${st.speed}x`);
    toggleClass(this.speedBtn, 'on', st.speed > 1);
    toggleClass(this.autoBtn, 'on', world.autoStart);
    toggleClass(this.pauseBtn, 'on', st.paused);
    this.pausedTag.hidden = !st.paused;

    // loja
    if (cash !== this.lastCash) {
      for (const [id, el] of this.shopItems) {
        const cost = world.towerCost(id);
        toggleClass(el, 'poor', cost > cash);
        setText(el.querySelector('.v') as HTMLElement, formatNumber(cost));
      }
      this.lastCash = cash;
    }
    for (const [id, el] of this.shopItems) toggleClass(el, 'active', st.placing === id);

    // inspetor
    const t = st.selected;
    this.inspector.hidden = !t;
    this.shopWrap.hidden = !!t;
    if (t) this.updateInspector(world, t);
    else this.inspKey = '';

    // painel de onda
    this.updateWavePanel(world);
  }

  private updateWavePanel(world: World): void {
    const next = world.wave + 1;
    const canStart = world.canStartWave();
    if (this.previewWave !== next) {
      this.previewWave = next;
      const preview = wavePreview(next);
      this.previewEl.replaceChildren(
        ...preview.map((p) => {
          const d = ENEMIES[p.enemy];
          return h(
            'span',
            { class: `chip${d.stealth ? ' stealth' : ''}${d.boss ? ' boss' : ''}`, title: `${d.name}: ${d.description}` },
            h('img', { src: eIcon(p.enemy), alt: d.name }),
            `×${p.count}`,
          );
        }),
      );
      const stealth = preview.some((p) => ENEMIES[p.enemy].stealth);
      const boss = preview.find((p) => ENEMIES[p.enemy].boss);
      const warns: (Node | string)[] = [];
      if (boss) warns.push(icon(ICON.skull), `Chefe: ${ENEMIES[boss.enemy].name}! `);
      if (stealth) warns.push(icon(ICON.eye), 'Furtivos: use detecção ou a Torre de Gelo.');
      this.warnEl.replaceChildren(...warns);
      this.warnEl.hidden = !warns.length;
    }
    setText(this.waveTitle, world.victory && !world.freeplay ? 'Vitória!' : `Próxima onda: ${next}`);
    this.startBtn.disabled = !canStart;
    const label = this.startBtn.querySelector('span:last-child') as HTMLElement;
    setText(label, !canStart ? 'Onda em andamento…' : world.waveInProgress ? `Chamar onda ${next}` : `Iniciar onda ${next}`);
  }

  private updateInspector(world: World, t: Tower): void {
    const key = `${t.id}|${t.tiers.join(',')}|${t.target}|${t.discount}|${t.stats.range}|${t.stats.damage}|${t.stats.cooldown}`;
    if (key !== this.inspKey) {
      this.inspKey = key;
      this.buildInspector(world, t);
    }
    const r = this.inspRefs!;
    setText(r.kills, formatNumber(t.kills));
    setText(r.dmg, formatNumber(t.damage));
    setText(r.sell.querySelector('.v') as HTMLElement, formatNumber(world.sellValue(t)));
    for (const u of r.ups) {
      if (!u.btn) continue;
      const info = world.upgradeInfo(t, u.path);
      u.btn.disabled = !info.affordable;
      setText(u.btn.querySelector('.v') as HTMLElement, formatNumber(info.cost));
    }
  }

  private buildInspector(world: World, t: Tower): void {
    const def = t.def;
    const s = t.stats;
    const attack = def.kind !== 'income' && def.kind !== 'aura';
    const kills = h('b');
    const dmg = h('b');

    const stats = h('div', { class: 'insp-stats' });
    for (const [k, v] of statLines(def, s)) stats.append(h('div', {}, `${k}: `, h('b', {}, v)));
    if (attack) {
      stats.append(h('div', {}, 'Abates: ', kills), h('div', {}, 'Dano total: ', dmg));
      if (s.detect) stats.append(h('div', { style: { color: '#d6a2ff' } }, icon(ICON.eye), ' Detecta furtivos'));
      if (s.armorPierce) stats.append(h('div', { style: { color: '#ffeaa7' } }, 'Ignora armadura'));
    }

    const targets = new Map<TargetMode, HTMLButtonElement>();
    let targetRow: HTMLElement | null = null;
    if (attack && def.kind !== 'pulse') {
      targetRow = h('div', { class: 'targets' });
      for (const m of TARGET_MODES) {
        const b = h('button', { class: t.target === m.id ? 'on' : '', onclick: () => this.actions.setTarget(m.id) }, m.label);
        targets.set(m.id, b);
        targetRow.append(b);
      }
    }

    const ups: { btn: HTMLButtonElement | null; path: 0 | 1 }[] = [];
    const paths = h('div', { class: 'paths' });
    for (const p of [0, 1] as const) {
      const path = def.paths[p];
      const pips = h('div', { class: 'pips' });
      for (let i = 0; i < 4; i++) pips.append(h('span', { class: `pip${i < t.tiers[p] ? ' on' : ''}` }));
      const info = world.upgradeInfo(t, p);
      const card = h('div', { class: 'up-card' });
      let btn: HTMLButtonElement | null = null;
      if (info.blocked === 'Nível máximo') {
        card.append(h('div', { class: 'done' }, 'MÁXIMO'));
      } else if (info.blocked) {
        const up = path.tiers[t.tiers[p]];
        card.append(h('div', { class: 'up-name' }, up.name), h('div', { class: 'locked' }, '🔒 Caminho bloqueado'));
      } else {
        const up = path.tiers[t.tiers[p]];
        btn = h('button', { class: 'btn gold', onclick: () => this.actions.upgrade(p), title: `Atalho: ${p === 0 ? 'Z' : 'X'}` }, icon(ICON.coin), h('span', { class: 'v' }, formatNumber(info.cost)));
        card.append(h('div', { class: 'up-name' }, up.name), h('div', { class: 'up-desc' }, up.description), btn);
      }
      ups.push({ btn, path: p });
      const col = h('div', { class: 'path-col' }, h('div', { class: 'path-name' }, path.name), pips, card);
      col.style.setProperty('--c', path.color);
      paths.append(col);
    }

    const sell = h('button', { class: 'btn danger sell', onclick: () => this.actions.sell(), title: 'Atalho: Delete' }, 'Vender por ', icon(ICON.coin), h('span', { class: 'v' }, formatNumber(world.sellValue(t))));

    this.inspector.replaceChildren(
      h(
        'div',
        { class: 'insp-head' },
        h('img', { src: tIcon(def), alt: def.name }),
        h('div', {}, h('h3', {}, def.name), h('div', { class: 'sub' }, `Níveis ${t.tiers[0]}-${t.tiers[1]}${t.discount ? ` · desconto ${pct(t.discount)}` : ''}`)),
        h('button', { class: 'btn', title: 'Fechar (Esc)', onclick: () => this.actions.deselect() }, icon(ICON.close)),
      ),
      stats,
      ...(targetRow ? [targetRow] : []),
      paths,
      sell,
    );
    this.inspRefs = { kills, dmg, sell, ups, targets };
  }

  private showTowerTip(def: TowerDef, ev: MouseEvent): void {
    const lines = statLines(def, { ...baseStats(), ...def.base });
    this.tooltip.replaceChildren(
      h('b', {}, `${def.name}  ·  ${def.hotkey}`),
      def.description,
      h('div', { class: 'tt-stats' }, lines.map(([k, v]) => `${k}: ${v}`).join('  ·  ')),
    );
    this.tooltip.classList.remove('hidden');
    this.moveTip(ev);
  }

  private moveTip(ev: MouseEvent): void {
    const tt = this.tooltip;
    const w = tt.offsetWidth;
    tt.style.left = `${Math.max(8, ev.clientX - w - 16)}px`;
    tt.style.top = `${Math.min(window.innerHeight - tt.offsetHeight - 8, ev.clientY - 10)}px`;
  }

  hideTip(): void {
    this.tooltip.classList.add('hidden');
  }
}
