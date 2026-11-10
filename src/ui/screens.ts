import { formatNumber } from '../engine/math';
import type { SaveData } from '../engine/storage';
import { DIFFICULTIES, type Difficulty, type DifficultyId, WORLD_H, WORLD_W } from '../game/config';
import { buildMap, type MapDef, MAPS } from '../game/maps';
import type { World } from '../game/world';
import { paintMap } from '../render/background';
import { h, icon } from './dom';
import { ICON } from './icons';

export function buildMenu(actions: { play(): void; howto(): void; settings(): void }): { root: HTMLElement; canvas: HTMLCanvasElement } {
  const canvas = h('canvas', { id: 'menu-canvas' });
  const root = h(
    'section',
    { id: 'screen-menu', class: 'screen' },
    canvas,
    h('div', { class: 'menu-shade' }),
    h('h1', { class: 'logo' }, 'MURALHA', h('small', {}, 'TOWER DEFENSE')),
    h(
      'div',
      { class: 'menu-buttons' },
      h('button', { class: 'btn primary big', onclick: actions.play }, icon(ICON.play), 'Jogar'),
      h('button', { class: 'btn', onclick: actions.howto }, 'Como jogar'),
      h('button', { class: 'btn', onclick: actions.settings }, icon(ICON.gear), 'Configurações'),
    ),
    h('p', { class: 'credit' }, 'Nascido de um jogo de 4,8 KB escondido numa URL. TypeScript + Canvas 2D, zero imagens.'),
  );
  return { root, canvas };
}

const DIFF_ORDER: DifficultyId[] = ['easy', 'normal', 'hard', 'impossible'];

export function buildMapSelect(save: SaveData, actions: { back(): void; choose(def: MapDef): void }): HTMLElement {
  const grid = h('div', { class: 'map-grid' });
  for (const def of MAPS) {
    const thumb = h('canvas');
    const w = 320;
    thumb.width = w * 2;
    thumb.height = Math.round((w * 2 * WORLD_H) / WORLD_W);
    const ctx = thumb.getContext('2d')!;
    ctx.scale((w * 2) / WORLD_W, (w * 2) / WORLD_W);
    paintMap(ctx, buildMap(def, def.procedural ? 4242 : 1));
    if (def.procedural) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      ctx.fillStyle = '#feca57';
      ctx.font = '900 200px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', WORLD_W / 2, WORLD_H / 2);
    }
    const medals = h('div', { class: 'medals' }, 'Medalhas:');
    const won = save.medals[def.id] ?? [];
    for (const d of DIFF_ORDER) {
      medals.append(h('span', { class: `medal ${d}${won.includes(d) ? ' won' : ''}`, title: DIFFICULTIES[d].name }));
    }
    const best = Math.max(0, ...DIFF_ORDER.map((d) => save.bestWave[`${def.id}:${d}`] ?? 0));
    if (best) medals.append(h('span', { style: { marginLeft: 'auto' } }, `Recorde: onda ${best}`));
    grid.append(
      h(
        'button',
        { class: 'map-card', onclick: () => actions.choose(def) },
        thumb,
        h('div', { class: 'info' }, h('h3', {}, def.name, h('span', { class: `tier tier-${def.tier}` }, def.tier)), h('p', {}, def.description), medals),
      ),
    );
  }
  return h(
    'section',
    { id: 'screen-maps', class: 'screen' },
    h('div', { class: 'screen-header' }, h('button', { class: 'btn', onclick: actions.back }, '← Voltar'), h('h2', {}, 'Escolha o campo de batalha')),
    grid,
  );
}

export function difficultyDialog(def: MapDef, save: SaveData, onPick: (d: Difficulty) => void, onCancel: () => void): HTMLElement {
  const list = h('div', { class: 'diff-list' });
  for (const id of DIFF_ORDER) {
    const d = DIFFICULTIES[id];
    const best = save.bestWave[`${def.id}:${id}`];
    list.append(
      h(
        'button',
        { class: 'diff', onclick: () => onPick(d) },
        h('span', { class: `medal ${id} won` }),
        h('div', {}, h('b', {}, d.name), h('span', {}, d.description)),
        best ? h('span', { class: 'best' }, `Recorde: ${best}`) : null,
      ),
    );
  }
  return h(
    'div',
    {},
    h('h2', {}, def.name),
    h('p', { class: 'lead' }, 'Escolha a dificuldade'),
    list,
    h('div', { class: 'modal-actions' }, h('button', { class: 'btn', onclick: onCancel }, 'Cancelar')),
  );
}

export function pauseDialog(actions: { resume(): void; restart(): void; settings(): void; quit(): void }): HTMLElement {
  return h(
    'div',
    {},
    h('h2', {}, 'Pausado'),
    h('p', { class: 'lead' }, 'A muralha aguarda suas ordens.'),
    h(
      'div',
      { class: 'modal-actions', style: { flexDirection: 'column', alignItems: 'center' } },
      h('button', { class: 'btn primary big', onclick: actions.resume }, icon(ICON.play), 'Continuar'),
      h('button', { class: 'btn', onclick: actions.settings }, icon(ICON.gear), 'Configurações'),
      h('button', { class: 'btn', onclick: actions.restart }, 'Reiniciar partida'),
      h('button', { class: 'btn danger', onclick: actions.quit }, 'Sair para o menu'),
    ),
  );
}

export function endDialog(world: World, won: boolean, actions: { freeplay(): void; retry(): void; menu(): void }): HTMLElement {
  const stat = (v: string, label: string) => h('div', {}, h('b', {}, v), h('span', {}, label));
  return h(
    'div',
    {},
    h('h2', { style: { color: won ? '#feca57' : '#ff7675' } }, won ? 'Vitória!' : 'A muralha caiu'),
    h('p', { class: 'lead' }, won ? `${world.map.def.name} defendido no modo ${world.diff.name}.` : `Você resistiu até a onda ${world.wave} em ${world.map.def.name}.`),
    h(
      'div',
      { class: 'end-stats' },
      stat(String(world.wave), 'ondas'),
      stat(formatNumber(world.stats.kills), 'inimigos derrotados'),
      stat(formatNumber(world.stats.earned), 'ouro ganho'),
      stat(String(world.stats.built), 'torres construídas'),
    ),
    h(
      'div',
      { class: 'modal-actions' },
      won ? h('button', { class: 'btn gold', onclick: actions.freeplay }, 'Modo livre (continuar)') : null,
      h('button', { class: 'btn primary', onclick: actions.retry }, won ? 'Jogar de novo' : 'Tentar de novo'),
      h('button', { class: 'btn', onclick: actions.menu }, 'Menu'),
    ),
  );
}

export function howtoDialog(onClose: () => void): HTMLElement {
  return h(
    'div',
    {},
    h('h2', {}, 'Como jogar'),
    h(
      'div',
      {
        class: 'howto',
        html: `
<p>Inimigos marcham pelo caminho até a <b>muralha</b>. Cada um que chega custa vidas. Construa torres ao lado do caminho, ganhe ouro abatendo inimigos e ao fim de cada onda, e invista em upgrades.</p>
<h4>Upgrades em dois caminhos</h4>
<p>Cada torre tem 2 caminhos com 4 níveis. Um caminho pode ir até o nível 4; o outro, só até o 2. Escolha a especialização certa para cada ameaça.</p>
<h4>Ameaças</h4>
<p><b>Blindados</b> reduzem o dano de cada golpe: use dano alto ou upgrades que ignoram armadura. <b>Furtivos</b> só podem ser mirados por torres com detecção, ou depois que o pulso da <b>Torre de Gelo</b> os revela. <b>Mães-Gosma</b> se dividem, <b>Xamãs</b> curam e os <b>chefes</b> chegam nas ondas 10, 20, 30, 40…</p>
<h4>Atalhos</h4>
<p><kbd>1</kbd>–<kbd>8</kbd> escolher torre · <kbd>Shift</kbd>+clique constrói várias · <kbd>Z</kbd>/<kbd>X</kbd> upgrade do caminho 1/2 · <kbd>Tab</kbd> trocar alvo · <kbd>Del</kbd> vender · <kbd>Espaço</kbd> iniciar onda · <kbd>F</kbd> velocidade · <kbd>P</kbd> pausar · <kbd>Esc</kbd> cancelar · clique direito cancela.</p>`,
      },
    ),
    h('div', { class: 'modal-actions' }, h('button', { class: 'btn primary', onclick: onClose }, 'Entendi')),
  );
}

export function settingsDialog(save: SaveData, onChange: () => void, onClose: () => void, onReset: () => void): HTMLElement {
  const vol = h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(save.settings.volume * 100)) });
  vol.addEventListener('input', () => {
    save.settings.volume = Number(vol.value) / 100;
    onChange();
  });
  const auto = h('input', { type: 'checkbox' });
  auto.checked = save.settings.autoStart;
  auto.addEventListener('change', () => {
    save.settings.autoStart = auto.checked;
    onChange();
  });
  return h(
    'div',
    {},
    h('h2', {}, 'Configurações'),
    h('label', { class: 'setting' }, h('span', {}, 'Volume dos efeitos'), vol),
    h('label', { class: 'setting' }, h('span', {}, 'Iniciar ondas automaticamente'), auto),
    h(
      'div',
      { class: 'setting' },
      h('span', {}, 'Apagar recordes e medalhas'),
      h(
        'button',
        {
          class: 'btn danger',
          onclick: () => {
            if (confirm('Apagar todo o progresso salvo?')) onReset();
          },
        },
        'Apagar',
      ),
    ),
    h('div', { class: 'modal-actions' }, h('button', { class: 'btn primary', onclick: onClose }, 'Fechar')),
  );
}
