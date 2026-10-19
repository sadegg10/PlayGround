/**
 * Fully procedural audio - no external assets.
 * Creates a small synth + drum kit on the WebAudio API for combat, UI and music.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.musicGain = null
    this.sfxGain = null
    this.muted = false
    this.started = false
    this._musicTimer = null
    this._step = 0
  }

  init() {
    if (this.ctx) return
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(this.ctx.destination)

    this.sfxGain = this.ctx.createGain()
    this.sfxGain.gain.value = 0.85
    this.sfxGain.connect(this.master)

    this.musicGain = this.ctx.createGain()
    this.musicGain.gain.value = 0.32
    this.musicGain.connect(this.master)
    this.started = true
  }

  resume() {
    this.init()
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume()
  }

  setMuted(m) {
    this.muted = m
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02)
    }
  }

  get t() { return this.ctx.currentTime }

  _tone({ freq = 440, dur = 0.2, type = 'sine', gain = 0.3, sweepTo = null, delay = 0, detune = 0, dest = null }) {
    if (!this.started || this.muted) return
    const ctx = this.ctx
    const t0 = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    osc.detune.value = detune
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(dest || this.sfxGain)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  _noise({ dur = 0.2, gain = 0.3, freq = 1200, q = 1, type = 'lowpass', delay = 0, sweepTo = null }) {
    if (!this.started || this.muted) return
    const ctx = this.ctx
    const t0 = ctx.currentTime + delay
    const len = Math.floor(ctx.sampleRate * dur)
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.setValueAtTime(freq, t0)
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur)
    filter.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.sfxGain)
    src.start(t0)
    src.stop(t0 + dur)
  }

  punch(pitch = 1) {
    this._tone({ freq: 180 * pitch, sweepTo: 60, dur: 0.13, type: 'square', gain: 0.25 })
    this._noise({ dur: 0.09, gain: 0.28, freq: 900 * pitch, sweepTo: 200 })
  }

  heavy() {
    this._tone({ freq: 120, sweepTo: 40, dur: 0.28, type: 'sawtooth', gain: 0.32 })
    this._noise({ dur: 0.2, gain: 0.3, freq: 700, sweepTo: 120 })
  }

  hit() {
    this._tone({ freq: 320, sweepTo: 110, dur: 0.1, type: 'triangle', gain: 0.22 })
    this._noise({ dur: 0.07, gain: 0.2, freq: 2600, sweepTo: 600 })
  }

  ora(i = 0) {
    const base = 300 + (i % 4) * 40
    this._tone({ freq: base, sweepTo: base * 0.5, dur: 0.08, type: 'square', gain: 0.2 })
    this._noise({ dur: 0.06, gain: 0.16, freq: 1800, sweepTo: 500 })
  }

  whoosh() {
    this._noise({ dur: 0.22, gain: 0.22, freq: 300, sweepTo: 2200, type: 'bandpass', q: 1.2 })
  }

  projectile() {
    this._tone({ freq: 700, sweepTo: 220, dur: 0.18, type: 'sawtooth', gain: 0.18 })
  }

  explosion() {
    this._noise({ dur: 0.7, gain: 0.4, freq: 800, sweepTo: 60 })
    this._tone({ freq: 90, sweepTo: 35, dur: 0.6, type: 'sawtooth', gain: 0.3 })
  }

  heal() {
    ;[523, 659, 784, 1046].forEach((f, i) => this._tone({ freq: f, dur: 0.3, type: 'sine', gain: 0.18, delay: i * 0.06 }))
  }

  timestop() {
    this._tone({ freq: 1200, sweepTo: 60, dur: 1.2, type: 'sine', gain: 0.3 })
    this._tone({ freq: 60, dur: 1.4, type: 'sawtooth', gain: 0.25 })
    this._noise({ dur: 1.0, gain: 0.25, freq: 3000, sweepTo: 100, type: 'lowpass' })
  }

  summon() {
    this._tone({ freq: 160, sweepTo: 640, dur: 0.5, type: 'sawtooth', gain: 0.22 })
    this._noise({ dur: 0.4, gain: 0.18, freq: 400, sweepTo: 3000, type: 'bandpass' })
  }

  ult() {
    this._tone({ freq: 180, sweepTo: 720, dur: 0.8, type: 'sawtooth', gain: 0.3 })
    this._noise({ dur: 0.8, gain: 0.3, freq: 200, sweepTo: 4000, type: 'bandpass', q: 0.8 })
    this._tone({ freq: 90, sweepTo: 45, dur: 0.9, type: 'square', gain: 0.25 })
  }

  rankUp(step = 0) {
    const scale = [523, 587, 659, 784, 880, 1046]
    this._tone({ freq: scale[Math.min(step, scale.length - 1)], dur: 0.35, type: 'triangle', gain: 0.22 })
    this._tone({ freq: scale[Math.min(step, scale.length - 1)] * 2, dur: 0.25, type: 'sine', gain: 0.12, delay: 0.04 })
  }

  death() {
    this._tone({ freq: 400, sweepTo: 50, dur: 0.8, type: 'sawtooth', gain: 0.3 })
  }

  bossRoar() {
    this._tone({ freq: 90, sweepTo: 55, dur: 1.2, type: 'sawtooth', gain: 0.35 })
    this._noise({ dur: 1.2, gain: 0.3, freq: 250, sweepTo: 700, type: 'bandpass', q: 0.7 })
  }

  alarm() {
    ;[880, 660, 880, 660].forEach((f, i) => this._tone({ freq: f, dur: 0.18, type: 'square', gain: 0.16, delay: i * 0.2 }))
  }

  uiClick() {
    this._tone({ freq: 880, dur: 0.06, type: 'square', gain: 0.12 })
  }

  uiConfirm() {
    this._tone({ freq: 523, dur: 0.1, type: 'square', gain: 0.15 })
    this._tone({ freq: 784, dur: 0.14, type: 'square', gain: 0.15, delay: 0.08 })
    this._tone({ freq: 1046, dur: 0.2, type: 'square', gain: 0.15, delay: 0.16 })
  }

  // ---------- Music: a driving minor ostinato reminiscent of dramatic anime scores ----------
  startMusic() {
    this.init()
    if (!this.started || this._musicTimer) return
    const root = 110 // A2
    const pattern = [0, 0, 3, 0, 5, 3, 7, 5, 0, 0, 3, 0, 8, 7, 5, 3]
    const bassPattern = [0, 0, 0, 0, -2, -2, -2, -2, 3, 3, 3, 3, -5, -5, -5, -5]
    const stepTime = 0.19
    const semi = (n) => Math.pow(2, n / 12)
    const tick = () => {
      if (!this.started || this._musicTimer === null) return
      const s = this._step % 16
      const n = pattern[s]
      // lead pluck
      this._tone({ freq: root * 2 * semi(n), dur: 0.16, type: 'triangle', gain: 0.09, dest: this.musicGain })
      // bass
      this._tone({ freq: root * semi(bassPattern[s]) * 0.5, dur: 0.22, type: 'sawtooth', gain: 0.1, dest: this.musicGain })
      // percussion
      if (s % 4 === 0) this._noise({ dur: 0.12, gain: 0.14, freq: 120, sweepTo: 50 })
      if (s % 8 === 4) this._noise({ dur: 0.08, gain: 0.1, freq: 1800, sweepTo: 400, type: 'bandpass' })
      if (s % 2 === 0) this._noise({ dur: 0.03, gain: 0.05, freq: 6000, sweepTo: 3000, type: 'highpass' })
      this._step++
    }
    this._musicTimer = setInterval(tick, stepTime * 1000)
  }

  setMusicIntensity(on) {
    if (!this.musicGain) return
    this.musicGain.gain.setTargetAtTime(on ? 0.42 : 0.24, this.ctx.currentTime, 0.4)
  }

  stopMusic() {
    if (this._musicTimer) clearInterval(this._musicTimer)
    this._musicTimer = null
  }
}
