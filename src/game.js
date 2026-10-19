import * as THREE from 'three'
import { Engine } from './core/engine.js'
import { Input } from './core/input.js'
import { AudioEngine } from './core/audio.js'
import { Effects } from './core/effects.js'
import { Arena } from './world/arena.js'
import { Player } from './entities/player.js'
import { Enemy } from './entities/enemy.js'
import { ProjectileManager } from './entities/projectile.js'
import { Combat } from './systems/combat.js'
import { WaveManager } from './systems/waves.js'
import { HUD, buildStandSelect } from './ui/hud.js'
import { createStand, STAND_METAS } from './stands/index.js'
import { clamp, rand, TAU } from './core/utils.js'

export class Game {
  constructor(canvas) {
    this.canvas = canvas
    this.engine = new Engine(canvas)
    this.scene = this.engine.scene
    this.camera = this.engine.camera
    this.audio = new AudioEngine()
    this.effects = new Effects(this.scene)
    this.arena = new Arena(this.scene)

    this.enemies = []
    this.projectiles = new ProjectileManager(this)
    this.combat = new Combat(this)
    this.waves = new WaveManager(this)
    this.hud = new HUD(this)

    this.player = new Player(this, { position: new THREE.Vector3(0, 0, 0) })
    this.input = new Input(canvas)

    this.state = 'title'
    this.time = 0
    this.dt = 0
    this.camYaw = Math.PI
    this.camPitch = 0.3
    this.score = 0
    this.wave = 0
    this.boss = null
    this.standIndex = 0
    this.bestRank = 'D'
    this.stats = { kills: 0 }

    this.hitstopTimer = 0
    this.timeStopTimer = 0
    this.timeStopActive = false
    this.updaters = []
    this._menuAngle = 0
    this._shakeOff = new THREE.Vector3()

    this._bindUI()
    this._bindWindow()
  }

  // ---------------------------------------------------------------- setup
  requestLock() {
    try {
      const p = this.canvas.requestPointerLock?.()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    } catch { /* pointer lock is optional; ignore failures */ }
  }

  _bindWindow() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'playing') this.pause()
        else if (this.state === 'paused') this.resume()
      }
      if (e.code === 'KeyM' && this.state === 'playing') {
        this.audio.setMuted(!this.audio.muted)
        this.hud.showBanner(this.audio.muted ? 'MUTED' : 'SOUND ON')
      }
      if (e.code === 'Tab' && this.state === 'playing') {
        e.preventDefault()
        this.cycleStand()
      }
    })
    this.canvas.addEventListener('click', () => {
      this.audio.resume()
      if (this.state === 'playing' && !this.input.locked) this.requestLock()
    })
  }

  _bindUI() {
    const $ = (id) => document.getElementById(id)
    this.screens = {
      loading: $('loading'), title: $('screen-title'), select: $('screen-select'),
      howto: $('screen-howto'), pause: $('screen-pause'), over: $('screen-over')
    }
    const click = (id, fn) => $(id).addEventListener('click', () => { this.audio.resume(); this.audio.uiClick(); fn() })

    click('btn-start', () => this.showSelect())
    click('btn-howto', () => this._showScreen('howto'))
    click('btn-howto-back', () => this._showScreen('title'))
    click('btn-back-title', () => this._showScreen('title'))
    click('btn-confirm', () => this.startRun(this._pendingIndex ?? this.standIndex))
    click('btn-resume', () => this.resume())
    click('btn-restart-pause', () => this.startRun(this.standIndex))
    click('btn-quit', () => this.showSelect())
    click('btn-retry', () => this.startRun(this.standIndex))
    click('btn-change', () => this.showSelect())

    this._pendingIndex = 0
    this._selectUI = buildStandSelect(
      $('stand-grid'),
      (i) => this._previewStand(i),
      (i) => this.startRun(i)
    )
  }

  // ---------------------------------------------------------------- menus
  _showScreen(name) {
    for (const k of Object.keys(this.screens)) {
      if (k === 'loading') continue
      this.screens[k].classList.toggle('hidden', k !== name)
    }
    this.hud.hide()
    this.input.exitPointerLock()
  }

  showSelect() {
    this.state = 'select'
    this._showScreen('select')
    this.audio.stopMusic()
    this.clearEnemies()
    this.projectiles.clear()
    document.getElementById('btn-confirm').disabled = true
    this._pendingIndex = null
    // showcase with first stand
    this._previewStand(this.standIndex)
  }

  _previewStand(index, silent = false) {
    this.standIndex = index
    this._pendingIndex = index
    const confirm = document.getElementById('btn-confirm')
    if (confirm) confirm.disabled = false
    if (!silent) this.audio.uiClick()
    const p = this.player
    p.resetBuffs()
    p.standManifested = true
    const stand = createStand(index, this)
    p.setStand(stand)
    p.position.set(0, 0, 0)
    p.hp = p.maxHp
    p.yaw = Math.PI
    p.root.rotation.y = Math.PI
    this.camYaw = Math.PI
    this._menuAngle = 0
  }

  // ---------------------------------------------------------------- run lifecycle
  startRun(index) {
    this.standIndex = index
    this.audio.resume()
    this.audio.stopMusic()
    this.audio.startMusic()

    this.clearEnemies()
    this.projectiles.clear()
    this.updaters.length = 0
    this.combat.reset()
    this.waves.reset()

    this.score = 0
    this.wave = 0
    this.boss = null
    this.bestRank = 'D'
    this.stats.kills = 0
    this.hitstopTimer = 0
    this.timeStopTimer = 0
    this.timeStopActive = false

    const p = this.player
    p.alive = true
    p.removed = false
    p.hp = p.maxHp
    p.energy = 100
    p.rush = 0
    p.velocity.set(0, 0, 0)
    p.knockback.set(0, 0, 0)
    p.position.set(0, 0, 0)
    p.yVel = 0
    p.yaw = Math.PI
    p.root.rotation.x = 0
    p.root.position.set(0, 0, 0)
    p.deathTimer = 0
    p.invuln = 1.5
    p.resetBuffs()
    p.standManifested = true
    this.camYaw = Math.PI
    this.camPitch = 0.3

    const stand = createStand(index, this)
    p.setStand(stand)

    this.state = 'playing'
    this._showScreen('none')
    this.hud.show()
    this.hud.hideBossBar()
    this.requestLock()
    this.waves.begin()
  }

  pause() {
    if (this.state !== 'playing') return
    this.state = 'paused'
    this._showScreen('pause')
    this.input.exitPointerLock()
  }

  resume() {
    if (this.state !== 'paused') return
    this.state = 'playing'
    for (const k of Object.keys(this.screens)) this.screens[k].classList.add('hidden')
    this.hud.show()
    this.requestLock()
  }

  cycleStand() {
    const next = (this.standIndex + 1) % STAND_METAS.length
    this.standIndex = next
    const stand = createStand(next, this)
    this.player.setStand(stand)
    this.player.standManifested = true
  }

  // ---------------------------------------------------------------- events
  onWaveStart(wave, isBoss) {
    this.audio.setMusicIntensity(wave % 5 === 0)
    if (isBoss) {
      this.audio.bossRoar()
      this.audio.alarm()
      this.hud.showBanner('⚠ BOSS APPROACHING ⚠')
    } else {
      this.hud.showBanner(`WAVE ${wave}`)
    }
  }

  onWaveClear(wave) {
    this.player.heal(30)
    this.player.addEnergy(40)
    this.addScore(300 + wave * 100)
    this.hud.showBanner(`WAVE ${wave} CLEAR!`)
    this.audio.rankUp(3)
    this.hud.floatText(this.player.position.clone().setY(2.4), 'AREA CLEAR', 'heal')
  }

  onUltimate(name) {
    this.audio.ult()
    this.engine.addShake(0.6)
    this.hud.showBanner(name)
    this.engine.setBloom({ strength: 1.35, threshold: 0.6 })
    setTimeout(() => this.engine.setBloom({ strength: 0.85, threshold: 0.72 }), 900)
  }

  onPlayerDeath() {
    if (this.state !== 'playing') return
    this.state = 'over'
    this.bestRank = this.combat.bestRank.name
    this.audio.stopMusic()
    this.hud.hide()
    document.getElementById('over-title').textContent = 'YOU DIED'
    document.getElementById('over-sub').textContent = 'Your Stand fades into the void…'
    document.getElementById('stat-wave').textContent = this.wave
    document.getElementById('stat-score').textContent = this.score.toLocaleString()
    document.getElementById('stat-kills').textContent = this.stats.kills
    document.getElementById('stat-best').textContent = this.bestRank
    this.screens.over.classList.remove('hidden')
    this.input.exitPointerLock()
  }

  addScore(n) { this.score += Math.max(0, Math.round(n)) }

  allActors() { return [this.player, ...this.enemies] }

  // ---------------------------------------------------------------- entities
  spawnEnemy(type, position, wave) {
    const enemy = new Enemy(this, type, position, wave || this.wave)
    this.enemies.push(enemy)
    const p = position.clone().setY(0.1)
    this.effects.ring(p, { color: enemy.cfg.palette.accent, flat: true, startScale: 0.4, endScale: 3.5, ttl: 0.5 })
    this.effects.burst(p.clone().setY(1), { count: 24, color: new THREE.Color(enemy.cfg.palette.accent), speed: 5, life: 0.6, size: 0.55, gravity: 6 })
    if (type === 'boss') {
      this.boss = enemy
      this.hud.showBossBar(enemy)
      this.engine.addShake(0.7)
    }
    return enemy
  }

  removeEnemy(enemy) {
    const i = this.enemies.indexOf(enemy)
    if (i >= 0) this.enemies.splice(i, 1)
    if (this.boss === enemy) { this.boss = null; this.hud.hideBossBar() }
    enemy.dispose()
  }

  clearEnemies() {
    for (const e of this.enemies) e.dispose()
    this.enemies.length = 0
    this.boss = null
    this.hud?.hideBossBar()
  }

  // ---------------------------------------------------------------- time stop
  startTimeStop(duration, label) {
    this.timeStopTimer = Math.max(this.timeStopTimer, duration)
    this.timeStopActive = true
    this.audio.timestop()
    this.engine.addShake(0.5)
    this.hud.showBanner(label)
    const overlay = document.getElementById('timestop-overlay')
    overlay.querySelector('span').textContent = label
    overlay.classList.remove('hidden')
    overlay.querySelector('span').style.animation = 'none'
    void overlay.offsetWidth
    overlay.querySelector('span').style.animation = 'tszoom 0.5s ease-out'
    this.engine.setBloom({ strength: 1.4, threshold: 0.55 })
    this._timeStopLabel = label
  }

  _endTimeStop() {
    this.timeStopActive = false
    document.getElementById('timestop-overlay').classList.add('hidden')
    this.engine.setBloom({ strength: 0.85, threshold: 0.72 })
    this.hud.showBanner('TIME MOVES AGAIN')
  }

  hitStop(d) { this.hitstopTimer = Math.max(this.hitstopTimer, d) }

  // ---------------------------------------------------------------- camera
  updateCamera(dt) {
    if (this.state === 'title' || this.state === 'select' || this.state === 'howto') {
      this._menuAngle += dt * 0.25
      const r = 8.5
      const target = this.player.position
      this.camera.position.set(
        target.x + Math.sin(this._menuAngle) * r,
        3.6 + Math.sin(this._menuAngle * 0.7) * 0.6,
        target.z + Math.cos(this._menuAngle) * r
      )
      this.camera.lookAt(target.x, 1.3, target.z)
      return
    }

    const p = this.player
    const dist = 8.2
    const height = 2.6
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw)
    const cosP = Math.cos(this.camPitch)
    const targetPos = new THREE.Vector3(
      p.position.x - fx * dist * cosP,
      p.position.y + height + dist * Math.sin(this.camPitch),
      p.position.z - fz * dist * cosP
    )
    const smooth = 1 - Math.exp(-14 * dt)
    this.camera.position.lerp(targetPos, smooth)

    const shake = this.engine.updateShake(dt)
    this._shakeOff.copy(shake)
    this.camera.position.add(shake)
    this.camera.lookAt(p.position.x + fx * 2.2, p.position.y + 1.45, p.position.z + fz * 2.2)
  }

  updateAim(dt) {
    if (this.state !== 'playing' || !this.input.locked) return
    const sens = 0.0023
    this.camYaw -= this.input.mouseDX * sens
    this.camPitch = clamp(this.camPitch + this.input.mouseDY * sens, -0.15, 1.0)
  }

  // ---------------------------------------------------------------- loop
  frame() {
    const raw = Math.min(this.engine._clockDelta ?? 0.016, 0.05)
    this.update(raw)
    this.engine.render(this.dt)
  }

  update(rawDt) {
    this.time += rawDt
    let dt = rawDt
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= rawDt
      dt = rawDt * 0.12
    }
    this.dt = dt

    // time stop countdown uses real time
    if (this.timeStopActive) {
      this.timeStopTimer -= rawDt
      if (this.timeStopTimer <= 0) this._endTimeStop()
    }

    this.updateAim(rawDt)

    if (this.state === 'playing' || this.state === 'over') {
      this.player.update(dt, this.input)
      for (const e of this.enemies) e.update(dt)
      this.projectiles.update(dt)
      this.combat.update(rawDt)
      if (this.state === 'playing') this.waves.update(rawDt)
    } else if (this.state === 'select' || this.state === 'title' || this.state === 'howto') {
      // showcase idle animation
      this.player.update(dt, { axis: () => ({ x: 0, y: 0 }), down: () => false, justPressed: () => false, mouse: () => false })
    }

    // updaters (transient stand effects) run on game time
    for (let i = this.updaters.length - 1; i >= 0; i--) {
      this.updaters[i]()
    }

    this.arena.update(dt, this.time)
    this.effects.update(dt)
    this.updateCamera(rawDt)

    if (this.state === 'playing' || this.state === 'over') this.hud.update(rawDt)

    // arena menace based on nearby enemies
    let threat = 0
    for (const e of this.enemies) {
      const d = e.position.distanceTo(this.player.position)
      threat = Math.max(threat, clamp(1 - d / 22, 0, 1))
    }
    this.arena.setMenace(clamp(threat * 0.7 + this.combat.combo * 0.02, 0, 1))

    this.input.endFrame()
  }

  start() {
    this.engine._clockDelta = 0
    this._clock = new THREE.Clock()
    const loop = () => {
      this._raf = requestAnimationFrame(loop)
      const d = this._clock.getDelta()
      this.engine._clockDelta = d
      this.frame()
    }
    loop()
    this.screens.loading.classList.add('hidden')
    this.state = 'title'
    this._previewStand(this.standIndex, true)
    this._showScreen('title')

    // Optional deep-link used by automated capture: ?autostart=1&stand=2&wave=3
    const params = new URLSearchParams(location.search)
    if (params.get('autostart') === '1') {
      const stand = clamp(parseInt(params.get('stand') || '0', 10) || 0, 0, STAND_METAS.length - 1)
      this.startRun(stand)
      const wave = parseInt(params.get('wave') || '0', 10)
      if (wave > 0) { this.waves.reset(); this.waves.wave = wave - 1; this.waves.nextWave() }
    }
  }
}
