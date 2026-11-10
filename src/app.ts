import { Audio, type SfxName } from './engine/audio';
import { loadSave, recordResult, writeSave } from './engine/storage';
import { DIFFICULTIES, type Difficulty, PATH_WIDTH, TICK, WORLD_H, WORLD_W } from './game/config';
import { buildMap, type MapDef, MAPS } from './game/maps';
import { TARGET_MODES, TOWER_ORDER, type TowerId } from './game/towers';
import { wavePreview } from './game/waves';
import { ENEMIES } from './game/enemies';
import { type GameEvent, World } from './game/world';
import { Renderer, type ViewState } from './render/renderer';
import { h } from './ui/dom';
import { Hud } from './ui/hud';
import { buildMapSelect, buildMenu, difficultyDialog, endDialog, howtoDialog, pauseDialog, settingsDialog } from './ui/screens';

type Screen = 'menu' | 'maps' | 'game';

const SPEEDS = [1, 2, 3];
const MAX_STEPS_PER_FRAME = 12;

export class App {
  private save = loadSave();
  private audio = new Audio();
  private screen: Screen = 'menu';

  private hud: Hud;
  private renderer: Renderer;
  private menu: { root: HTMLElement; canvas: HTMLCanvasElement };
  private menuRenderer: Renderer;
  private mapsRoot: HTMLElement | null = null;
  private modal: HTMLDivElement;
  private modalCard: HTMLDivElement;
  private modalOpen = false;

  private world: World | null = null;
  private mapDef: MapDef | null = null;
  private diff: Difficulty = DIFFICULTIES.normal;
  private demo: World | null = null;

  private view: ViewState = { hover: null, placing: null, placeValid: false, selected: null };
  private speedIdx = 0;
  private paused = false;
  private acc = 0;
  private time = 0;
  private last = 0;
  private endShown = false;
  private beamSfx = 0;

  constructor(private root: HTMLElement) {
    this.audio.volume = this.save.settings.volume;

    this.menu = buildMenu({
      play: () => this.showMaps(),
      howto: () => this.openModal(howtoDialog(() => this.closeModal())),
      settings: () => this.openSettings(),
    });
    this.menuRenderer = new Renderer(this.menu.canvas);

    this.hud = new Hud({
      pickTower: (id) => this.pickTower(id),
      upgrade: (p) => this.upgradeSelected(p),
      sell: () => this.sellSelected(),
      setTarget: (m) => {
        if (this.view.selected) this.view.selected.target = m;
        this.sfx('click');
      },
      deselect: () => this.select(null),
      startWave: () => this.startWave(),
      cycleSpeed: () => this.cycleSpeed(),
      togglePause: () => this.setPaused(!this.paused),
      toggleAuto: () => {
        if (!this.world) return;
        this.world.autoStart = !this.world.autoStart;
        this.save.settings.autoStart = this.world.autoStart;
        writeSave(this.save);
        this.sfx('click');
      },
      openMenu: () => this.openPause(),
    });
    this.renderer = new Renderer(this.hud.canvas);

    this.modalCard = h('div', { class: 'modal-card' });
    this.modal = h('div', { class: 'modal hidden' }, this.modalCard);
    this.modal.addEventListener('pointerdown', (e) => {
      if (e.target === this.modal && this.screen === 'game' && !this.endShown) this.closeModal(true);
    });

    root.append(this.menu.root, this.hud.root, this.modal);
    this.bindInput();
    new ResizeObserver(() => this.layout()).observe(this.hud.stage);
    window.addEventListener('resize', () => this.layout());
    // áudio só pode começar depois de um gesto do usuário
    window.addEventListener('pointerdown', () => this.audio.unlock(), { capture: true });
    window.addEventListener('keydown', () => this.audio.unlock(), { capture: true });

    this.startDemo();
    this.show('menu');
    requestAnimationFrame((t) => this.frame(t));
  }

  // ───────────────────────────── telas ─────────────────────────────

  private show(screen: Screen): void {
    this.screen = screen;
    this.menu.root.classList.toggle('active', screen === 'menu');
    this.hud.root.classList.toggle('active', screen === 'game');
    this.mapsRoot?.classList.toggle('active', screen === 'maps');
    this.hud.hideTip();
    this.layout();
  }

  private showMaps(): void {
    this.sfx('click');
    this.mapsRoot?.remove();
    this.mapsRoot = buildMapSelect(this.save, {
      back: () => this.show('menu'),
      choose: (def) =>
        this.openModal(
          difficultyDialog(
            def,
            this.save,
            (d) => {
              this.closeModal();
              this.startGame(def, d);
            },
            () => this.closeModal(),
          ),
        ),
    });
    this.root.insertBefore(this.mapsRoot, this.modal);
    this.show('maps');
  }

  private openModal(content: HTMLElement): void {
    this.modalCard.replaceChildren(content);
    this.modal.classList.remove('hidden');
    this.modalOpen = true;
  }

  private closeModal(resume = false): void {
    this.modal.classList.add('hidden');
    this.modalOpen = false;
    if (resume) this.setPaused(false);
  }

  private openSettings(): void {
    const back = this.screen === 'game' && !this.endShown ? () => this.openPause() : () => this.closeModal();
    this.openModal(
      settingsDialog(
        this.save,
        () => {
          this.audio.volume = this.save.settings.volume;
          if (this.world) this.world.autoStart = this.save.settings.autoStart;
          writeSave(this.save);
        },
        back,
        () => {
          this.save.bestWave = {};
          this.save.medals = {};
          writeSave(this.save);
        },
      ),
    );
  }

  private openPause(): void {
    if (this.screen !== 'game' || this.endShown) return;
    this.setPaused(true);
    this.openModal(
      pauseDialog({
        resume: () => this.closeModal(true),
        restart: () => {
          this.closeModal();
          if (this.mapDef) this.startGame(this.mapDef, this.diff);
        },
        settings: () => this.openSettings(),
        quit: () => {
          this.closeModal();
          this.world = null;
          this.show('menu');
        },
      }),
    );
  }

  // ───────────────────────────── partida ─────────────────────────────

  private startGame(def: MapDef, diff: Difficulty): void {
    this.mapDef = def;
    this.diff = diff;
    const seed = def.procedural ? (Date.now() % 2147483646) + 1 : 1;
    const map = buildMap(def, seed);
    this.world = new World(map, diff, seed);
    this.world.autoStart = this.save.settings.autoStart;
    this.view = { hover: null, placing: null, placeValid: false, selected: null };
    this.speedIdx = 0;
    this.paused = false;
    this.acc = 0;
    this.endShown = false;
    this.hud.resetCaches();
    this.show('game');
    this.renderer.setMap(map);
    this.hud.banner(def.name, `${diff.name} · ${diff.winWave} ondas`);
    this.sfx('wave');
  }

  private startWave(): void {
    const w = this.world;
    if (!w || this.endShown) return;
    if (!w.startWave()) {
      this.sfx('error');
      return;
    }
    if (this.paused) this.setPaused(false);
  }

  private cycleSpeed(): void {
    this.speedIdx = (this.speedIdx + 1) % SPEEDS.length;
    this.sfx('click');
  }

  private setPaused(p: boolean): void {
    this.paused = p;
  }

  private pickTower(id: TowerId): void {
    const w = this.world;
    if (!w || this.endShown) return;
    if (this.view.placing === id) {
      this.view.placing = null;
      return;
    }
    if (w.cash < w.towerCost(id)) {
      this.sfx('error');
      return;
    }
    this.view.placing = id;
    this.view.selected = null;
    this.sfx('click');
    this.refreshPlacement();
  }

  private select(t: World['towers'][number] | null): void {
    this.view.selected = t;
    if (t) this.view.placing = null;
  }

  private upgradeSelected(path: 0 | 1): void {
    const t = this.view.selected;
    if (!t || !this.world) return;
    if (!this.world.upgrade(t, path)) this.sfx('error');
  }

  private sellSelected(): void {
    const t = this.view.selected;
    if (!t || !this.world) return;
    this.world.sell(t);
    this.view.selected = null;
  }

  private refreshPlacement(): void {
    const w = this.world;
    const v = this.view;
    if (!w || !v.placing || !v.hover) {
      v.placeValid = false;
      return;
    }
    v.placeValid = w.cash >= w.towerCost(v.placing) && w.canPlace(v.placing, v.hover.x, v.hover.y);
  }

  // ───────────────────────────── entrada ─────────────────────────────

  private bindInput(): void {
    const canvas = this.hud.canvas;
    canvas.addEventListener('pointermove', (e) => {
      this.view.hover = this.renderer.toWorld(e.clientX, e.clientY);
      this.refreshPlacement();
    });
    canvas.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.view.hover = null;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      const w = this.world;
      if (!w || this.endShown) return;
      const p = this.renderer.toWorld(e.clientX, e.clientY);
      this.view.hover = p;
      if (e.button === 2) {
        this.view.placing = null;
        this.view.selected = null;
        return;
      }
      if (this.view.placing) {
        this.refreshPlacement();
        if (this.view.placeValid) {
          const id = this.view.placing;
          const t = w.placeTower(id, p.x, p.y);
          if (t && !e.shiftKey) this.view.placing = null;
          this.refreshPlacement();
        } else {
          this.sfx('error');
        }
        return;
      }
      this.select(w.towerAt(p.x, p.y));
    });

    window.addEventListener('keydown', (e) => {
      if (this.screen !== 'game' || !this.world) return;
      if (this.modalOpen) {
        if (e.key === 'Escape' && !this.endShown) this.closeModal(true);
        return;
      }
      const k = e.key.toLowerCase();
      const idx = '12345678'.indexOf(k);
      if (idx >= 0 && k.length === 1) {
        this.pickTower(TOWER_ORDER[idx]);
        return;
      }
      switch (k) {
        case 'escape':
          if (this.view.placing || this.view.selected) {
            this.view.placing = null;
            this.view.selected = null;
          } else this.openPause();
          break;
        case ' ':
          e.preventDefault();
          if (this.world.canStartWave()) this.startWave();
          else this.cycleSpeed();
          break;
        case 'f':
          this.cycleSpeed();
          break;
        case 'p':
          this.setPaused(!this.paused);
          break;
        case 'z':
        case ',':
          this.upgradeSelected(0);
          break;
        case 'x':
        case '.':
          this.upgradeSelected(1);
          break;
        case 'delete':
        case 'backspace':
          this.sellSelected();
          break;
        case 'tab': {
          e.preventDefault();
          const t = this.view.selected;
          if (t && t.def.kind !== 'income' && t.def.kind !== 'aura' && t.def.kind !== 'pulse') {
            const i = TARGET_MODES.findIndex((m) => m.id === t.target);
            t.target = TARGET_MODES[(i + 1) % TARGET_MODES.length].id;
            this.sfx('click');
          }
          break;
        }
      }
    });
  }

  // ───────────────────────────── loop ─────────────────────────────

  private layout(): void {
    if (this.screen === 'game') {
      const s = this.hud.stage;
      this.renderer.fit(s.clientWidth - 16, s.clientHeight - 16);
    } else if (this.screen === 'menu') {
      const k = Math.max(window.innerWidth / WORLD_W, window.innerHeight / WORLD_H);
      this.menuRenderer.fit(WORLD_W * k, WORLD_H * k);
    }
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    this.time += dt;

    if (this.screen === 'game' && this.world) this.tickGame(this.world, dt);
    else if (this.screen === 'menu' && this.demo) this.tickDemo(this.demo, dt);

    requestAnimationFrame((t) => this.frame(t));
  }

  private tickGame(w: World, dt: number): void {
    const speed = SPEEDS[this.speedIdx];
    const running = !this.paused && !this.modalOpen;
    if (running) {
      this.acc += dt * speed;
      let steps = 0;
      while (this.acc >= TICK && steps < MAX_STEPS_PER_FRAME) {
        w.update(TICK);
        this.acc -= TICK;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
    }
    for (const ev of w.events) this.handleEvent(w, ev);
    w.events.length = 0;

    if (running) {
      this.beamSfx -= dt;
      if (this.beamSfx <= 0 && w.towers.some((t) => t.beams.length)) {
        this.sfx('beam');
        this.beamSfx = 0.3;
      }
    }

    // seleção pode ter sido vendida
    if (this.view.selected && !w.towers.includes(this.view.selected)) this.view.selected = null;
    if (this.view.placing) this.refreshPlacement();

    this.renderer.draw(w, this.view, this.time, running ? dt * speed : 0);
    this.hud.update(w, { placing: this.view.placing, selected: this.view.selected, speed, paused: this.paused });
  }

  private handleEvent(w: World, ev: GameEvent): void {
    this.renderer.effects.handle(ev);
    switch (ev.type) {
      case 'shot':
        if (ev.tower.def.sfx) this.sfx(ev.tower.def.sfx);
        break;
      case 'kill':
        this.sfx(ev.def.boss ? 'bigpop' : 'pop');
        break;
      case 'leak':
        this.sfx('leak');
        break;
      case 'explode':
        this.sfx('explode');
        break;
      case 'place':
        this.sfx('place');
        break;
      case 'upgrade':
        this.sfx('upgrade');
        break;
      case 'sell':
        this.sfx('sell');
        break;
      case 'income':
        this.sfx('coin');
        break;
      case 'boss':
        this.sfx('boss');
        this.hud.banner(`${ev.def.name.toUpperCase()}`, 'Um chefe se aproxima!', true);
        break;
      case 'waveStart': {
        this.sfx('wave');
        const p = wavePreview(ev.wave);
        const hasBoss = p.some((x) => ENEMIES[x.enemy].boss);
        const stealth = p.some((x) => ENEMIES[x.enemy].stealth);
        if (!hasBoss) this.hud.banner(`ONDA ${ev.wave}`, stealth ? 'Inimigos furtivos à vista!' : '');
        break;
      }
      case 'waveEnd':
        this.renderer.effects.text(WORLD_W / 2, 70, `Onda ${ev.wave} concluída  +$${ev.bonus}`, '#feca57', 20, 1.8);
        break;
      case 'victory':
        this.finish(w, true);
        break;
      case 'defeat':
        this.finish(w, false);
        break;
      default:
        break;
    }
  }

  private finish(w: World, won: boolean): void {
    if (this.endShown || !this.mapDef) return;
    this.endShown = true;
    this.view.placing = null;
    recordResult(this.save, this.mapDef.id, this.diff.id, w.wave, won);
    this.sfx(won ? 'victory' : 'defeat');
    const def = this.mapDef;
    setTimeout(() => {
      if (this.world !== w) return;
      this.openModal(
        endDialog(w, won, {
          freeplay: () => {
            w.continueFreeplay();
            this.endShown = false;
            this.closeModal();
          },
          retry: () => {
            this.closeModal();
            this.startGame(def, this.diff);
          },
          menu: () => {
            this.closeModal();
            this.world = null;
            this.show('menu');
          },
        }),
      );
    }, won ? 900 : 1400);
  }

  private sfx(name: SfxName): void {
    this.audio.play(name);
  }

  // ─────────────────────── partida demo no menu ───────────────────────

  private startDemo(): void {
    const def = MAPS[0];
    const map = buildMap(def, 7);
    const w = new World(map, DIFFICULTIES.easy, 7);
    w.cash = 1e9;
    w.lives = 1e9;
    w.autoStart = true;
    const order: TowerId[] = ['archer', 'cannon', 'frost', 'tesla', 'archer', 'prism', 'sniper', 'cannon', 'tesla', 'totem', 'archer', 'prism'];
    // espalha as torres ao longo do caminho, alternando os lados
    const path = map.paths[0];
    const s = { x: 0, y: 0, angle: 0 };
    order.forEach((id, i) => {
      for (let tries = 0; tries < 40; tries++) {
        path.sample(path.length * ((i + 0.5 + tries * 0.07) / order.length), s);
        const side = (i + tries) % 2 ? 1 : -1;
        const x = s.x - Math.sin(s.angle) * side * (PATH_WIDTH / 2 + 30);
        const y = s.y + Math.cos(s.angle) * side * (PATH_WIDTH / 2 + 30);
        const t = w.canPlace(id, x, y) ? w.placeTower(id, x, y) : null;
        if (!t) continue;
        w.upgrade(t, (i % 2) as 0 | 1);
        w.upgrade(t, (i % 2) as 0 | 1);
        w.upgrade(t, ((i + 1) % 2) as 0 | 1);
        break;
      }
    });
    w.startWave();
    for (let k = 0; k < 60 * 20; k++) w.update(TICK);
    w.events.length = 0;
    this.demo = w;
    this.menuRenderer.setMap(map);
  }

  private tickDemo(w: World, dt: number): void {
    let steps = Math.round((dt * 1.5) / TICK);
    while (steps-- > 0) w.update(TICK);
    for (const ev of w.events) this.menuRenderer.effects.handle(ev);
    w.events.length = 0;
    if (w.wave > 25) this.startDemo();
    this.menuRenderer.draw(w, { hover: null, placing: null, placeValid: false, selected: null }, this.time, dt * 1.5);
  }
}

