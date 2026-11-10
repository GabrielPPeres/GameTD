import { clamp, dist2, distToSegment, type Vec } from '../engine/math';
import { Rng } from '../engine/rng';
import { type Difficulty, PATH_WIDTH, price, SELL_RATIO, WORLD_H, WORLD_W } from './config';
import { ENEMIES, type EnemyDef, type EnemyId } from './enemies';
import type { GameMap } from './maps';
import { SpatialGrid } from './spatial';
import {
  computeStats,
  TOWERS,
  type TargetMode,
  type TowerDef,
  type TowerId,
  type TowerStats,
  upgradeBlockReason,
} from './towers';
import { enemyHpScale, rewardScale, type Spawn, waveBonus, waveSpawns } from './waves';

export interface Enemy {
  id: number;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  pathIndex: number;
  dist: number;
  x: number;
  y: number;
  angle: number;
  speedNow: number;
  slow: number;
  slowTimer: number;
  stunTimer: number;
  burnDps: number;
  burnTimer: number;
  burnTick: number;
  burnOwner: Tower | null;
  shred: number;
  shredTimer: number;
  brittle: number;
  brittleTimer: number;
  /** segundos restantes em que um furtivo fica visível (revelado pelo gelo) */
  revealed: number;
  sinceHit: number;
  healTimer: number;
  /** instante da última cura recebida (curas não acumulam) */
  healedAt: number;
  summonTimer: number;
  flash: number;
  bob: number;
  alive: boolean;
}

export interface Buff {
  fireRate: number;
  damage: number;
  range: number;
  pierce: number;
  detect: boolean;
  armorPierce: boolean;
}

export interface Tower {
  id: number;
  def: TowerDef;
  x: number;
  y: number;
  tiers: [number, number];
  /** stats sem bônus de totem */
  base: TowerStats;
  /** stats efetivos (com bônus) */
  stats: TowerStats;
  buff: Buff;
  discount: number;
  cooldown: number;
  angle: number;
  recoil: number;
  flash: number;
  target: TargetMode;
  spent: number;
  kills: number;
  damage: number;
  beams: Enemy[];
  ramp: number;
  rampTarget: number;
}

export type ProjectileKind = 'arrow' | 'bomb' | 'bomblet' | 'shard';

export interface Projectile {
  kind: ProjectileKind;
  owner: Tower;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  pierce: number;
  hit: number[];
  crit: boolean;
  // projéteis em arco
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t: number;
  duration: number;
  arc: number;
  height: number;
  splash: number;
  dead: boolean;
}

export type GameEvent =
  | { type: 'shot'; tower: Tower }
  | { type: 'kill'; x: number; y: number; def: EnemyDef; reward: number }
  | { type: 'leak'; def: EnemyDef; x: number; y: number }
  | { type: 'explode'; x: number; y: number; r: number; fire: boolean }
  | { type: 'pulse'; x: number; y: number; r: number }
  | { type: 'bolt'; points: Vec[] }
  | { type: 'tracer'; x1: number; y1: number; x2: number; y2: number; crit: boolean }
  | { type: 'crit'; x: number; y: number; amount: number }
  | { type: 'heal'; x: number; y: number; r: number }
  | { type: 'boss'; def: EnemyDef }
  | { type: 'waveStart'; wave: number }
  | { type: 'waveEnd'; wave: number; bonus: number }
  | { type: 'income'; x: number; y: number; amount: number }
  | { type: 'place'; tower: Tower }
  | { type: 'upgrade'; tower: Tower }
  | { type: 'sell'; tower: Tower; value: number }
  | { type: 'victory' }
  | { type: 'defeat' };

export interface UpgradeInfo {
  cost: number;
  blocked: string | null;
  affordable: boolean;
}

const NO_BUFF = (): Buff => ({ fireRate: 0, damage: 0, range: 0, pierce: 0, detect: false, armorPierce: false });

const BEAM_TICK = 0.1;

export class World {
  readonly map: GameMap;
  readonly diff: Difficulty;
  readonly rng: Rng;

  cash: number;
  lives: number;
  wave = 0;
  time = 0;
  waveTime = 0;
  waveOpen = false;
  gameOver = false;
  victory = false;
  freeplay = false;
  autoStart = false;
  private autoTimer = -1;

  towers: Tower[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  events: GameEvent[] = [];

  readonly stats = { kills: 0, earned: 0, leaked: 0, built: 0, bossesSlain: 0 };

  private spawnQueue: Spawn[] = [];
  private spawnIndex = 0;
  private pending: Enemy[] = [];
  private nextId = 1;
  private pathAlt = 0;
  private grid = new SpatialGrid<Enemy>(64, WORLD_W, WORLD_H);
  private tmp: Enemy[] = [];
  private tmp2: Enemy[] = [];
  private sampleOut = { x: 0, y: 0, angle: 0 };

  constructor(map: GameMap, diff: Difficulty, seed = map.seed) {
    this.map = map;
    this.diff = diff;
    this.rng = new Rng(seed ^ 0x5bd1e995);
    this.cash = diff.cash;
    this.lives = diff.lives;
  }

  // ───────────────────────── economia e construção ─────────────────────────

  towerCost(id: TowerId): number {
    return price(TOWERS[id].cost, this.diff.priceMul);
  }

  canPlace(id: TowerId, x: number, y: number): boolean {
    const r = TOWERS[id].radius;
    if (x - r < 0 || y - r < 0 || x + r > WORLD_W || y + r > WORLD_H) return false;
    for (const p of this.map.paths) if (p.distanceTo(x, y) < PATH_WIDTH / 2 + r - 2) return false;
    for (const o of this.map.obstacles) if (Math.hypot(o.x - x, o.y - y) < o.r + r * 0.7) return false;
    for (const t of this.towers) if (Math.hypot(t.x - x, t.y - y) < t.def.radius + r) return false;
    return true;
  }

  placeTower(id: TowerId, x: number, y: number): Tower | null {
    const cost = this.towerCost(id);
    if (this.cash < cost || !this.canPlace(id, x, y) || this.gameOver) return null;
    const def = TOWERS[id];
    const base = computeStats(def, [0, 0]);
    const tower: Tower = {
      id: this.nextId++,
      def,
      x,
      y,
      tiers: [0, 0],
      base,
      stats: { ...base },
      buff: NO_BUFF(),
      discount: 0,
      cooldown: 0,
      angle: -Math.PI / 2,
      recoil: 0,
      flash: 0,
      target: 'first',
      spent: cost,
      kills: 0,
      damage: 0,
      beams: [],
      ramp: 0,
      rampTarget: -1,
    };
    this.cash -= cost;
    this.towers.push(tower);
    this.stats.built++;
    this.recomputeTowers();
    this.events.push({ type: 'place', tower });
    return tower;
  }

  upgradeInfo(t: Tower, path: 0 | 1): UpgradeInfo {
    const blocked = upgradeBlockReason(t.tiers, path);
    if (blocked) return { cost: 0, blocked, affordable: false };
    const up = t.def.paths[path].tiers[t.tiers[path]];
    const cost = price(up.cost, this.diff.priceMul * (1 - t.discount));
    return { cost, blocked: null, affordable: this.cash >= cost };
  }

  upgrade(t: Tower, path: 0 | 1): boolean {
    const info = this.upgradeInfo(t, path);
    if (info.blocked || !info.affordable || this.gameOver) return false;
    this.cash -= info.cost;
    t.spent += info.cost;
    t.tiers[path]++;
    this.recomputeTowers();
    this.events.push({ type: 'upgrade', tower: t });
    return true;
  }

  sellValue(t: Tower): number {
    return Math.floor(t.spent * SELL_RATIO);
  }

  sell(t: Tower): void {
    const idx = this.towers.indexOf(t);
    if (idx < 0) return;
    const value = this.sellValue(t);
    this.towers.splice(idx, 1);
    this.cash += value;
    this.recomputeTowers();
    this.events.push({ type: 'sell', tower: t, value });
  }

  towerAt(x: number, y: number): Tower | null {
    let best: Tower | null = null;
    let bestD = Infinity;
    for (const t of this.towers) {
      const d = Math.hypot(t.x - x, t.y - y);
      if (d <= t.def.radius + 6 && d < bestD) {
        best = t;
        bestD = d;
      }
    }
    return best;
  }

  /** Recalcula stats de todas as torres (upgrades + auras de totem + descontos de mina). */
  recomputeTowers(): void {
    const totems = this.towers.filter((t) => t.def.kind === 'aura');
    const mines = this.towers.filter((t) => t.def.kind === 'income');
    for (const t of this.towers) {
      t.base = computeStats(t.def, t.tiers);
      const buff = NO_BUFF();
      if (t.def.kind !== 'aura' && t.def.kind !== 'income') {
        for (const tt of totems) {
          const a = tt.base;
          if (Math.hypot(tt.x - t.x, tt.y - t.y) > a.range) continue;
          buff.fireRate = Math.max(buff.fireRate, a.auraFireRate);
          buff.damage = Math.max(buff.damage, a.auraDamage);
          buff.range = Math.max(buff.range, a.auraRange);
          buff.pierce = Math.max(buff.pierce, a.auraPierce);
          buff.detect ||= a.auraDetect;
          buff.armorPierce ||= a.auraArmorPierce;
        }
      }
      t.buff = buff;
      const s = { ...t.base };
      s.range *= 1 + buff.range;
      s.cooldown /= 1 + buff.fireRate;
      s.damage *= 1 + buff.damage;
      s.burnDps *= 1 + buff.damage;
      if (t.def.kind === 'beam') s.damage *= 1 + buff.fireRate;
      s.pierce += buff.pierce;
      s.detect ||= buff.detect;
      s.armorPierce ||= buff.armorPierce;
      t.stats = s;
      t.discount = 0;
      for (const m of mines) {
        if (m !== t && Math.hypot(m.x - t.x, m.y - t.y) <= m.base.range) t.discount = Math.max(t.discount, m.base.discount);
      }
    }
  }

  // ───────────────────────────── ondas ─────────────────────────────

  canStartWave(): boolean {
    if (this.gameOver || (this.victory && !this.freeplay)) return false;
    return this.spawnIndex >= this.spawnQueue.length;
  }

  startWave(): boolean {
    if (!this.canStartWave()) return false;
    if (this.waveOpen) this.closeWave();
    if (this.victory && !this.freeplay) return false;
    this.wave++;
    this.spawnQueue = waveSpawns(this.wave);
    this.spawnIndex = 0;
    this.waveTime = 0;
    this.waveOpen = true;
    this.autoTimer = -1;
    this.events.push({ type: 'waveStart', wave: this.wave });
    return true;
  }

  continueFreeplay(): void {
    this.freeplay = true;
  }

  get waveInProgress(): boolean {
    return this.waveOpen;
  }

  private closeWave(): void {
    this.waveOpen = false;
    const bonus = waveBonus(this.wave);
    this.cash += bonus;
    this.stats.earned += bonus;
    for (const t of this.towers) {
      const s = t.base;
      if (s.income > 0) {
        this.cash += s.income;
        this.stats.earned += s.income;
        this.events.push({ type: 'income', x: t.x, y: t.y, amount: s.income });
      }
      if (s.lifeRegen > 0) this.lives += s.lifeRegen;
      if (s.interest > 0) {
        const gain = Math.min(2000, Math.floor(this.cash * s.interest));
        this.cash += gain;
        this.stats.earned += gain;
        this.events.push({ type: 'income', x: t.x, y: t.y - 16, amount: gain });
      }
    }
    this.events.push({ type: 'waveEnd', wave: this.wave, bonus });
    if (!this.freeplay && !this.victory && this.wave >= this.diff.winWave && this.lives > 0) {
      this.victory = true;
      this.events.push({ type: 'victory' });
    }
  }

  // ───────────────────────────── inimigos ─────────────────────────────

  private createEnemy(id: EnemyId, pathIndex: number, dist: number): Enemy {
    const def = ENEMIES[id];
    const hp = Math.max(1, Math.round(def.hp * enemyHpScale(id, Math.max(1, this.wave)) * this.diff.hpMul));
    const e: Enemy = {
      id: this.nextId++,
      def,
      hp,
      maxHp: hp,
      pathIndex,
      dist,
      x: 0,
      y: 0,
      angle: 0,
      speedNow: def.speed,
      slow: 0,
      slowTimer: 0,
      stunTimer: 0,
      burnDps: 0,
      burnTimer: 0,
      burnTick: 0,
      burnOwner: null,
      shred: 0,
      shredTimer: 0,
      brittle: 0,
      brittleTimer: 0,
      revealed: 0,
      sinceHit: 99,
      healTimer: def.heal ? def.heal.interval : 0,
      healedAt: -99,
      summonTimer: def.summon ? def.summon.interval : 0,
      flash: 0,
      bob: this.rng.next() * 10,
      alive: true,
    };
    this.map.paths[pathIndex].sample(dist, this.sampleOut);
    e.x = this.sampleOut.x;
    e.y = this.sampleOut.y;
    e.angle = this.sampleOut.angle;
    if (def.boss) this.events.push({ type: 'boss', def });
    return e;
  }

  private spawn(id: EnemyId, pathIndex: number, dist = 0): Enemy {
    const e = this.createEnemy(id, pathIndex, dist);
    this.pending.push(e);
    return e;
  }

  private damage(e: Enemy, amount: number, src: Tower | null, armorPierce: boolean): void {
    if (!e.alive || amount <= 0) return;
    let d = amount * (1 + e.brittle);
    if (!armorPierce) {
      const armor = Math.max(0, e.def.armor - e.shred);
      d = Math.max(d * 0.25, d - armor);
    }
    if (src) src.damage += Math.min(d, e.hp);
    e.hp -= d;
    e.sinceHit = 0;
    e.flash = 0.07;
    if (e.hp <= 0) this.kill(e, src);
  }

  private kill(e: Enemy, src: Tower | null): void {
    e.alive = false;
    let reward = Math.max(1, Math.round(e.def.reward * rewardScale(this.wave)));
    for (const t of this.towers) {
      if (t.base.bounty > 0 && dist2(t.x, t.y, e.x, e.y) <= t.base.range * t.base.range) reward += t.base.bounty;
    }
    this.cash += reward;
    this.stats.earned += reward;
    this.stats.kills++;
    if (e.def.boss) this.stats.bossesSlain++;
    if (src) src.kills++;
    this.events.push({ type: 'kill', x: e.x, y: e.y, def: e.def, reward });
    const split = e.def.splitInto;
    if (split) {
      for (let i = 0; i < split.count; i++) {
        const child = this.spawn(split.id, e.pathIndex, Math.max(0, e.dist - i * (ENEMIES[split.id].radius + 4)));
        child.slow = e.slow;
        child.slowTimer = e.slowTimer;
      }
    }
  }

  private applyHit(e: Enemy, amount: number, t: Tower, s: TowerStats): void {
    if (e.def.boss) amount *= s.bossMul;
    this.damage(e, amount, t, s.armorPierce);
    if (!e.alive) return;
    if (s.burnDps > 0 && s.burnDuration > 0) {
      if (s.burnDps >= e.burnDps) {
        e.burnDps = s.burnDps;
        e.burnOwner = t;
      }
      e.burnTimer = Math.max(e.burnTimer, s.burnDuration);
    }
    if (s.slow > 0) {
      if (e.def.stealth) e.revealed = Math.max(e.revealed, s.slowDuration + 1);
      const f = s.slow * (1 - (e.def.slowResist ?? 0));
      e.slow = Math.max(e.slow, f);
      e.slowTimer = Math.max(e.slowTimer, s.slowDuration);
    }
    if (s.stunChance > 0 && !e.def.stunImmune && this.rng.chance(s.stunChance)) {
      e.stunTimer = Math.max(e.stunTimer, s.stunDuration);
    }
    if (s.shred > 0) {
      e.shred = Math.max(e.shred, s.shred);
      e.shredTimer = 4;
    }
    if (s.brittle > 0) {
      e.brittle = Math.max(e.brittle, s.brittle);
      e.brittleTimer = 2;
    }
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const def = e.def;
      e.flash -= dt;
      if (e.slowTimer > 0 && (e.slowTimer -= dt) <= 0) e.slow = 0;
      if (e.shredTimer > 0 && (e.shredTimer -= dt) <= 0) e.shred = 0;
      if (e.brittleTimer > 0 && (e.brittleTimer -= dt) <= 0) e.brittle = 0;
      if (e.revealed > 0) e.revealed -= dt;
      if (e.burnTimer > 0) {
        e.burnTimer -= dt;
        e.burnTick += dt;
        if (e.burnTick >= 0.25) {
          e.burnTick -= 0.25;
          this.damage(e, e.burnDps * 0.25, e.burnOwner, true);
          if (!e.alive) continue;
        }
        if (e.burnTimer <= 0) e.burnDps = 0;
      }
      e.sinceHit += dt;
      if (def.regen && e.sinceHit > 1 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * def.regen * dt);

      if (def.heal && (e.healTimer -= dt) <= 0) {
        e.healTimer = def.heal.interval;
        const r2 = def.heal.radius ** 2;
        for (const o of this.enemies) {
          if (!o.alive || o === e || this.time - o.healedAt < 1.5 || dist2(o.x, o.y, e.x, e.y) > r2) continue;
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * def.heal.amount);
          o.healedAt = this.time;
        }
        this.events.push({ type: 'heal', x: e.x, y: e.y, r: def.heal.radius });
      }
      if (def.summon && (e.summonTimer -= dt) <= 0) {
        e.summonTimer = def.summon.interval;
        for (let i = 0; i < def.summon.count; i++) this.spawn(def.summon.id, e.pathIndex, Math.max(0, e.dist - def.radius - 10 - i * 18));
      }

      if (e.stunTimer > 0) {
        e.stunTimer -= dt;
        e.speedNow = 0;
      } else {
        e.speedNow = def.speed * (1 - e.slow);
        e.dist += e.speedNow * dt;
        e.bob += dt * (2 + e.speedNow / 15);
      }
      const path = this.map.paths[e.pathIndex];
      path.sample(e.dist, this.sampleOut);
      e.x = this.sampleOut.x;
      e.y = this.sampleOut.y;
      e.angle = this.sampleOut.angle;

      if (e.dist >= path.length) {
        e.alive = false;
        this.stats.leaked += Math.min(this.lives, def.leak);
        this.lives = Math.max(0, this.lives - def.leak);
        this.events.push({ type: 'leak', def, x: e.x, y: e.y });
        if (this.lives <= 0 && !this.gameOver) {
          this.lives = 0;
          this.gameOver = true;
          this.events.push({ type: 'defeat' });
        }
      }
    }
  }

  // ───────────────────────────── torres ─────────────────────────────

  private remaining(e: Enemy): number {
    return this.map.paths[e.pathIndex].length - e.dist;
  }

  private score(t: Tower, e: Enemy, mode: TargetMode): number {
    switch (mode) {
      case 'first':
        return -this.remaining(e);
      case 'last':
        return this.remaining(e);
      case 'strong':
        return e.maxHp * 1e4 + (e.def.boss ? 1e9 : 0) - this.remaining(e);
      case 'close':
        return -dist2(t.x, t.y, e.x, e.y);
    }
  }

  private candidates(t: Tower, range: number): Enemy[] {
    if (range > 1500) return this.enemies;
    return this.grid.query(t.x, t.y, range + 50, this.tmp);
  }

  private visible(e: Enemy, s: TowerStats): boolean {
    return !e.def.stealth || s.detect || e.revealed > 0;
  }

  private inRange(t: Tower, e: Enemy, range: number): boolean {
    const r = range + e.def.radius * 0.5;
    return dist2(t.x, t.y, e.x, e.y) <= r * r;
  }

  private findTargets(t: Tower, n: number): Enemy[] {
    const s = t.stats;
    const out: Enemy[] = [];
    const scores: number[] = [];
    for (const e of this.candidates(t, s.range)) {
      if (!e.alive || !this.visible(e, s) || !this.inRange(t, e, s.range)) continue;
      const sc = this.score(t, e, t.target);
      let i = out.length;
      while (i > 0 && scores[i - 1] < sc) i--;
      if (i >= n) continue;
      out.splice(i, 0, e);
      scores.splice(i, 0, sc);
      if (out.length > n) {
        out.pop();
        scores.pop();
      }
    }
    return out;
  }

  /** Posição prevista do inimigo daqui a `time` segundos. */
  private predict(e: Enemy, time: number): Vec {
    const path = this.map.paths[e.pathIndex];
    path.sample(Math.min(path.length, e.dist + e.speedNow * time), this.sampleOut);
    return { x: this.sampleOut.x, y: this.sampleOut.y };
  }

  private updateTowers(dt: number): void {
    for (const t of this.towers) {
      t.recoil = Math.max(0, t.recoil - dt * 5);
      t.flash = Math.max(0, t.flash - dt);
      const kind = t.def.kind;
      if (kind === 'income') continue;
      if (kind === 'aura') {
        t.angle += dt * 0.6;
        continue;
      }
      if (kind === 'beam') {
        this.updateBeam(t, dt);
        continue;
      }
      t.cooldown -= dt;
      for (let shots = 0; t.cooldown <= 0 && shots < 4; shots++) {
        if (!this.attack(t)) {
          t.cooldown = 0;
          break;
        }
        t.cooldown += t.stats.cooldown;
        t.recoil = 1;
        t.flash = 0.15;
        this.events.push({ type: 'shot', tower: t });
      }
    }
  }

  /** Executa um ataque; retorna false se não havia alvo. */
  private attack(t: Tower): boolean {
    const s = t.stats;
    switch (t.def.kind) {
      case 'projectile': {
        const [target] = this.findTargets(t, 1);
        if (!target) return false;
        const d = Math.sqrt(dist2(t.x, t.y, target.x, target.y));
        const aim = this.predict(target, d / s.projectileSpeed);
        const angle = Math.atan2(aim.y - t.y, aim.x - t.x);
        t.angle = angle;
        const crit = s.crit > 0 && this.rng.chance(s.crit);
        for (let i = 0; i < s.projectiles; i++) {
          const a = angle + (i - (s.projectiles - 1) / 2) * s.spread;
          this.shootStraight(t, 'arrow', t.x + Math.cos(a) * 14, t.y + Math.sin(a) * 14, a, s.projectileSpeed, s.range * 1.3, s.damage * (crit ? s.critMul : 1), s.pierce, crit);
        }
        if (crit) this.events.push({ type: 'crit', x: target.x, y: target.y - 14, amount: s.damage * s.critMul });
        return true;
      }
      case 'lob': {
        const targets = this.findTargets(t, s.projectiles);
        if (!targets.length) return false;
        for (let i = 0; i < s.projectiles; i++) {
          const target = targets[i % targets.length];
          const d = Math.sqrt(dist2(t.x, t.y, target.x, target.y));
          const flight = clamp(d / 380, 0.35, 1);
          const aim = this.predict(target, flight);
          if (i > 0 && targets.length === 1) {
            aim.x += this.rng.range(-20, 20);
            aim.y += this.rng.range(-20, 20);
          }
          t.angle = Math.atan2(aim.y - t.y, aim.x - t.x);
          this.lob(t, 'bomb', t.x, t.y - 10, aim.x, aim.y, flight, 40 + d * 0.3, s.damage, s.splash);
        }
        return true;
      }
      case 'pulse': {
        let any = false;
        const r = s.range;
        for (const e of this.grid.query(t.x, t.y, r + 50, this.tmp)) {
          if (!e.alive || !this.inRange(t, e, r)) continue;
          any = true;
          this.applyHit(e, s.damage, t, s);
        }
        if (any) this.events.push({ type: 'pulse', x: t.x, y: t.y, r });
        return any;
      }
      case 'chain': {
        const targets = this.findTargets(t, s.multiTarget);
        if (!targets.length) return false;
        for (const first of targets) {
          const points: Vec[] = [{ x: t.x, y: t.y - 20 }];
          const hit = new Set<number>();
          let cur: Enemy | null = first;
          let dmg = s.damage;
          for (let j = 0; j <= s.chains && cur; j++) {
            points.push({ x: cur.x, y: cur.y });
            hit.add(cur.id);
            const from: Enemy = cur;
            this.applyHit(from, dmg, t, s);
            dmg *= 0.85;
            cur = null;
            let best = s.chainRange * s.chainRange;
            for (const o of this.grid.query(from.x, from.y, s.chainRange, this.tmp2)) {
              if (!o.alive || hit.has(o.id) || !this.visible(o, s)) continue;
              const d2 = dist2(o.x, o.y, from.x, from.y);
              if (d2 < best) {
                best = d2;
                cur = o;
              }
            }
          }
          this.events.push({ type: 'bolt', points });
        }
        t.angle = Math.atan2(targets[0].y - t.y, targets[0].x - t.x);
        return true;
      }
      case 'hitscan': {
        const [target] = this.findTargets(t, 1);
        if (!target) return false;
        t.angle = Math.atan2(target.y - t.y, target.x - t.x);
        const crit = s.crit > 0 && this.rng.chance(s.crit);
        const dmg = s.damage * (crit ? s.critMul : 1);
        this.events.push({ type: 'tracer', x1: t.x + Math.cos(t.angle) * 22, y1: t.y + Math.sin(t.angle) * 22, x2: target.x, y2: target.y, crit });
        if (crit) this.events.push({ type: 'crit', x: target.x, y: target.y - 14, amount: dmg * (target.def.boss ? s.bossMul : 1) });
        const tx = target.x;
        const ty = target.y;
        this.applyHit(target, dmg, t, s);
        for (let i = 0; i < s.shrapnel; i++) {
          const a = this.rng.next() * Math.PI * 2;
          const p = this.shootStraight(t, 'shard', tx, ty, a, 430, 140, s.damage * 0.35, 2, false);
          p.hit.push(target.id);
        }
        return true;
      }
      default:
        return false;
    }
  }

  private updateBeam(t: Tower, dt: number): void {
    const s = t.stats;
    const targets = this.findTargets(t, s.multiTarget);
    t.beams = targets;
    if (!targets.length) {
      t.ramp = Math.max(0, t.ramp - dt * 2);
      t.rampTarget = -1;
      t.cooldown = 0;
      return;
    }
    if (targets[0].id === t.rampTarget) t.ramp = Math.min(s.rampMax - 1, t.ramp + s.rampRate * dt);
    else {
      t.rampTarget = targets[0].id;
      t.ramp = Math.min(t.ramp, 0.25);
    }
    t.angle = Math.atan2(targets[0].y - t.y, targets[0].x - t.x);
    t.cooldown += dt;
    while (t.cooldown >= BEAM_TICK) {
      t.cooldown -= BEAM_TICK;
      const dmg = s.damage * BEAM_TICK * (1 + t.ramp);
      for (const target of targets) {
        if (s.beamLine) {
          const a = Math.atan2(target.y - t.y, target.x - t.x);
          const len = s.range * 1.6;
          const ex = t.x + Math.cos(a) * len;
          const ey = t.y + Math.sin(a) * len;
          for (const e of this.grid.query((t.x + ex) / 2, (t.y + ey) / 2, len / 2 + 50, this.tmp2)) {
            if (e.alive && distToSegment(e.x, e.y, t.x, t.y, ex, ey) <= e.def.radius + 8) this.applyHit(e, dmg, t, s);
          }
        } else if (target.alive) {
          this.applyHit(target, dmg, t, s);
        }
      }
    }
  }

  // ───────────────────────────── projéteis ─────────────────────────────

  private newProjectile(kind: Projectile['kind'], owner: Tower, x: number, y: number): Projectile {
    return {
      kind,
      owner,
      x,
      y,
      px: x,
      py: y,
      vx: 0,
      vy: 0,
      life: 0,
      damage: 0,
      pierce: 1,
      hit: [],
      crit: false,
      sx: x,
      sy: y,
      tx: x,
      ty: y,
      t: 0,
      duration: 0,
      arc: 0,
      height: 0,
      splash: 0,
      dead: false,
    };
  }

  private shootStraight(owner: Tower, kind: 'arrow' | 'shard', x: number, y: number, angle: number, speed: number, range: number, damage: number, pierce: number, crit: boolean): Projectile {
    const p = this.newProjectile(kind, owner, x, y);
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = range / speed;
    p.damage = damage;
    p.pierce = pierce;
    p.crit = crit;
    this.projectiles.push(p);
    return p;
  }

  private lob(owner: Tower, kind: 'bomb' | 'bomblet', sx: number, sy: number, tx: number, ty: number, duration: number, arc: number, damage: number, splash: number): void {
    const p = this.newProjectile(kind, owner, sx, sy);
    p.sx = sx;
    p.sy = sy;
    p.tx = tx;
    p.ty = ty;
    p.duration = duration;
    p.arc = arc;
    p.damage = damage;
    p.splash = splash;
    this.projectiles.push(p);
  }

  private explode(p: Projectile): void {
    const s = p.owner.stats;
    const r = p.splash;
    for (const e of this.grid.query(p.tx, p.ty, r + 50, this.tmp)) {
      if (!e.alive) continue;
      const rr = r + e.def.radius;
      if (dist2(e.x, e.y, p.tx, p.ty) <= rr * rr) this.applyHit(e, p.damage, p.owner, s);
    }
    this.events.push({ type: 'explode', x: p.tx, y: p.ty, r, fire: s.burnDps > 0 });
    if (p.kind === 'bomb' && s.cluster > 0) {
      for (let i = 0; i < s.cluster; i++) {
        const a = (i / s.cluster) * Math.PI * 2 + this.rng.next();
        const d = this.rng.range(30, 65);
        this.lob(p.owner, 'bomblet', p.tx, p.ty, p.tx + Math.cos(a) * d, p.ty + Math.sin(a) * d, this.rng.range(0.25, 0.4), 30, p.damage * 0.5, 26);
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      if (p.kind === 'bomb' || p.kind === 'bomblet') {
        p.t += dt;
        const u = Math.min(1, p.t / p.duration);
        p.x = p.sx + (p.tx - p.sx) * u;
        p.y = p.sy + (p.ty - p.sy) * u;
        p.height = p.arc * 4 * u * (1 - u);
        if (u >= 1) {
          p.dead = true;
          this.explode(p);
        }
        continue;
      }
      p.px = p.x;
      p.py = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.x < -60 || p.y < -60 || p.x > WORLD_W + 60 || p.y > WORLD_H + 60) {
        p.dead = true;
        continue;
      }
      const mx = (p.x + p.px) / 2;
      const my = (p.y + p.py) / 2;
      const half = Math.hypot(p.x - p.px, p.y - p.py) / 2;
      for (const e of this.grid.query(mx, my, half + 50, this.tmp)) {
        if (!e.alive || p.hit.includes(e.id)) continue;
        if (distToSegment(e.x, e.y, p.px, p.py, p.x, p.y) > e.def.radius + 3) continue;
        p.hit.push(e.id);
        this.applyHit(e, p.damage, p.owner, p.owner.stats);
        if (--p.pierce <= 0) {
          p.dead = true;
          break;
        }
      }
    }
    let w = 0;
    for (const p of this.projectiles) if (!p.dead) this.projectiles[w++] = p;
    this.projectiles.length = w;
  }

  // ───────────────────────────── loop ─────────────────────────────

  update(dt: number): void {
    if (this.gameOver) return;
    this.time += dt;

    if (this.waveOpen) {
      this.waveTime += dt;
      while (this.spawnIndex < this.spawnQueue.length && this.spawnQueue[this.spawnIndex].time <= this.waveTime) {
        const sp = this.spawnQueue[this.spawnIndex++];
        const pathIndex = sp.path >= 0 ? sp.path : this.pathAlt++ % this.map.paths.length;
        this.spawn(sp.enemy, pathIndex);
      }
    }
    this.flushPending();

    this.updateEnemies(dt);
    this.grid.clear();
    for (const e of this.enemies) if (e.alive) this.grid.insert(e);

    this.updateTowers(dt);
    this.updateProjectiles(dt);

    let w = 0;
    for (const e of this.enemies) if (e.alive) this.enemies[w++] = e;
    this.enemies.length = w;
    this.flushPending();

    if (this.gameOver) return;
    if (this.waveOpen && this.spawnIndex >= this.spawnQueue.length && this.enemies.length === 0) {
      this.closeWave();
      if (this.autoStart) this.autoTimer = 1;
    }
    if (this.autoTimer > 0 && (this.autoTimer -= dt) <= 0) {
      this.autoTimer = -1;
      if (this.autoStart) this.startWave();
    }
  }

  private flushPending(): void {
    if (!this.pending.length) return;
    for (const e of this.pending) this.enemies.push(e);
    this.pending.length = 0;
  }
}
