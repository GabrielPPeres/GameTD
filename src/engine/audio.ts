/**
 * Efeitos sonoros 100% sintetizados com WebAudio (sem arquivos de áudio).
 * Cada som tem um intervalo mínimo para não saturar quando 50 torres atiram juntas.
 */
export type SfxName =
  | 'arrow'
  | 'cannon'
  | 'explode'
  | 'frost'
  | 'zap'
  | 'snipe'
  | 'beam'
  | 'pop'
  | 'bigpop'
  | 'leak'
  | 'wave'
  | 'place'
  | 'upgrade'
  | 'sell'
  | 'error'
  | 'boss'
  | 'coin'
  | 'victory'
  | 'defeat'
  | 'click';

const MIN_INTERVAL: Partial<Record<SfxName, number>> = {
  arrow: 0.05,
  cannon: 0.08,
  explode: 0.07,
  frost: 0.12,
  zap: 0.06,
  snipe: 0.06,
  beam: 0.25,
  pop: 0.035,
  bigpop: 0.1,
  coin: 0.1,
};

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last = new Map<SfxName, number>();
  private _volume = 0.6;

  get volume(): number {
    return this._volume;
  }

  set volume(v: number) {
    this._volume = v;
    if (this.master) this.master.gain.value = v * 0.5;
  }

  /** Precisa ser chamado dentro de um gesto do usuário (política dos navegadores). */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._volume * 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  play(name: SfxName): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this._volume <= 0) return;
    const now = ctx.currentTime;
    const min = MIN_INTERVAL[name] ?? 0;
    if (now - (this.last.get(name) ?? -1) < min) return;
    this.last.set(name, now);

    switch (name) {
      case 'arrow':
        this.tone('triangle', 900, 500, 0.06, 0.12);
        break;
      case 'cannon':
        this.tone('sine', 140, 50, 0.18, 0.5);
        this.burst(0.08, 900, 0.25);
        break;
      case 'explode':
        this.burst(0.3, 600, 0.45);
        this.tone('sine', 90, 35, 0.3, 0.45);
        break;
      case 'frost':
        this.tone('sine', 1600, 900, 0.18, 0.08);
        this.burst(0.15, 5000, 0.08, 'highpass');
        break;
      case 'zap':
        this.tone('square', 220 + Math.random() * 200, 1200, 0.07, 0.09);
        this.burst(0.05, 3000, 0.1, 'highpass');
        break;
      case 'snipe':
        this.burst(0.05, 2500, 0.35);
        this.tone('sawtooth', 300, 80, 0.12, 0.15);
        break;
      case 'beam':
        this.tone('sawtooth', 520, 560, 0.2, 0.04);
        break;
      case 'pop':
        this.tone('sine', 380 + Math.random() * 160, 900, 0.05, 0.13);
        break;
      case 'bigpop':
        this.tone('sine', 160, 520, 0.12, 0.3);
        this.burst(0.12, 1200, 0.2);
        break;
      case 'leak':
        this.tone('sawtooth', 300, 90, 0.35, 0.18);
        break;
      case 'wave':
        this.tone('triangle', 523, 523, 0.12, 0.18);
        this.tone('triangle', 784, 784, 0.18, 0.18, 0.1);
        break;
      case 'place':
        this.tone('sine', 220, 110, 0.12, 0.35);
        this.burst(0.05, 1500, 0.15);
        break;
      case 'upgrade':
        [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.1, 0.15, i * 0.06));
        break;
      case 'sell':
      case 'coin':
        this.tone('square', 988, 988, 0.05, 0.06);
        this.tone('square', 1319, 1319, 0.12, 0.06, 0.05);
        break;
      case 'error':
        this.tone('square', 140, 120, 0.15, 0.1);
        break;
      case 'boss':
        this.tone('sawtooth', 70, 55, 1.2, 0.3);
        this.tone('sawtooth', 105, 82, 1.2, 0.2);
        break;
      case 'victory':
        [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.2, i * 0.13));
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, i) => this.tone('sawtooth', f, f * 0.97, 0.35, 0.14, i * 0.25));
        break;
      case 'click':
        this.tone('sine', 700, 600, 0.03, 0.08);
        break;
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(dur: number, freq: number, vol: number, filterType: BiquadFilterType = 'lowpass'): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
}
