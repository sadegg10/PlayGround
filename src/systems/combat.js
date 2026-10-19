import * as THREE from 'three'
import { clamp } from '../core/utils.js'

export const STYLE_RANKS = [
  { name: 'D', min: 0 },
  { name: 'C', min: 6 },
  { name: 'B', min: 14 },
  { name: 'A', min: 24 },
  { name: 'AA', min: 38 },
  { name: 'AAA', min: 56 }
]

export class Combat {
  constructor(game) {
    this.game = game
    this.enemies = game.enemies
    this.combo = 0
    this.comboTimer = 0
    this.bestRankIndex = 0
    this.rankIndex = 0
    this._hitIndex = 0
    this.kills = 0
  }

  reset() {
    this.combo = 0
    this.comboTimer = 0
    this.rankIndex = 0
    this.bestRankIndex = 0
    this.kills = 0
  }

  get rank() { return STYLE_RANKS[this.rankIndex] }
  get bestRank() { return STYLE_RANKS[this.bestRankIndex] }

  /** Central damage entry point. */
  damage(target, amount, opts = {}) {
    if (!target || !target.alive || amount <= 0) return 0
    let value = amount
    if (opts.source === 'player') {
      const p = this.game.player
      value *= p.damageMult
      if (this.game.timeStopActive && target.team === 'enemy') opts = { ...opts, crit: true }
    }
    const scaled = Math.round(value)
    const dealt = target.takeDamage(scaled, opts)
    if (dealt <= 0) return 0

    if (opts.source === 'player') {
      this.game.player.addRush(dealt * 0.45)
      this.game.player.addEnergy(dealt * 0.5)
    }

    const p = target.position
    const headPos = new THREE.Vector3(p.x, p.y + target.height * 0.75, p.z)

    if (opts.showNumber !== false) {
      this.game.hud.floatText(headPos, String(scaled), opts.crit ? 'crit' : 'dmg')
    }
    const fx = this.game.effects
    fx.hitSpark(headPos, opts.color ?? 0xffe28a)

    if (opts.source === 'player' && !opts.noCombo) {
      this.addHit()
      this.game.engine.addShake(opts.crit ? 0.28 : 0.14)
      this.game.hitStop(opts.crit ? 0.075 : 0.045)
      if (opts.crit) this.game.audio.heavy()
    }
    if (opts.burn && target.team === 'enemy') this.applyBurn(target, opts.burn)
    if (opts.source === 'enemy' && target.team === 'player') {
      this.game.engine.addShake(0.3)
    }
    opts.onHit?.(target, dealt)
    return dealt
  }

  applyBurn(target, burn) {
    if (!target || !target.alive || target.team !== 'enemy') return
    target.burnTimer = Math.max(target.burnTimer || 0, burn.duration)
    target.burnDps = Math.max(target.burnDps || 0, burn.dps)
  }

  knock(target, dir, force, opts = {}) {
    if (!target || !target.alive) return
    target.applyKnockback(dir, force, opts)
    if (opts.source === 'player' && opts.wallSlam) {
      target._slam = { damage: opts.wallSlamDamage ?? force * 2.4, timer: 1.1, color: opts.color }
      target.onWallHit = (nx, nz) => this.wallSlam(target, nx, nz)
    }
  }

  wallSlam(target, nx, nz) {
    const slam = target._slam
    if (!slam || !target.alive) return
    target._slam = null
    target.onWallHit = null
    target.knockback.set(-nx * 1.5, 0, -nz * 1.5)
    this.game.audio.heavy()
    this.game.engine.addShake(0.35)
    const p = new THREE.Vector3(target.position.x, 1.2, target.position.z)
    this.game.effects.burst(p, { count: 18, color: new THREE.Color(0xff2e88), speed: 7, life: 0.5, size: 0.6, gravity: 8 })
    this.game.effects.shockwave(new THREE.Vector3(target.position.x, 0.1, target.position.z), 0xff2e88, 0.45, 3.2)
    this.game.hud.floatText(new THREE.Vector3(target.position.x, target.height, target.position.z), 'WALL SLAM!', 'wall')
    this.game.addScore(60)
    this.damage(target, slam.damage, { source: 'player', color: slam.color, crit: true, noKnockback: true })
  }

  addHit() {
    this.combo++
    this.comboTimer = 2.2
    const newIdx = this._rankFor(this.combo)
    if (newIdx > this.rankIndex) {
      this.rankIndex = newIdx
      if (newIdx > this.bestRankIndex) this.bestRankIndex = newIdx
      this.game.audio.rankUp(newIdx)
      this.game.hud.flashRank(this.rank.name)
    }
    this.game.addScore(Math.round(8 * (1 + this.combo * 0.05) * (1 + this.rankIndex * 0.35)))
  }

  _rankFor(combo) {
    let idx = 0
    for (let i = 0; i < STYLE_RANKS.length; i++) if (combo >= STYLE_RANKS[i].min) idx = i
    return idx
  }

  /** Cone/arc melee strike from `origin` toward yaw. */
  meleeArc(origin, yaw, opts = {}) {
    const {
      range = 2.8, arc = Math.PI * 0.75, damage = 10, knockback = 6,
      stagger = 0.28, color = 0xfff2a8, maxTargets = Infinity, wallSlam = true,
      crit = false, source = 'player', onHit, vertical = false, verticalForce = 0,
      hitAll = false
    } = opts
    const fx = Math.sin(yaw)
    const fz = Math.cos(yaw)
    const half = arc / 2
    const results = []
    for (const e of this.enemies) {
      if (!e.alive) continue
      const dx = e.position.x - origin.x
      const dz = e.position.z - origin.z
      const dist = Math.hypot(dx, dz)
      if (dist > range + e.radius) continue
      const dot = (dx * fx + dz * fz) / (dist || 1)
      const ang = Math.acos(clamp(dot, -1, 1))
      if (ang > half) continue
      results.push({ e, dist })
    }
    results.sort((a, b) => a.dist - b.dist)
    const targets = hitAll ? results : results.slice(0, maxTargets)
    let hits = 0
    for (const { e } of targets) {
      const dir = new THREE.Vector3(e.position.x - origin.x, 0, e.position.z - origin.z)
      this.damage(e, damage, { source, color, crit, onHit })
      this.knock(e, dir, knockback, { source, wallSlam, color, stagger, vertical: vertical || verticalForce > 0, wallSlamDamage: opts.wallSlamDamage })
      if (verticalForce > 0) e.yVel = Math.max(e.yVel, verticalForce)
      hits++
    }
    return hits
  }

  /** Radial AoE. */
  sphere(center, radius, opts = {}) {
    const { damage = 12, knockback = 5, source = 'player', color = 0xff8844, crit = false, wallSlam = true, hitFriendly = false } = opts
    let hits = 0
    const targets = hitFriendly ? this.game.allActors() : this.enemies
    for (const e of targets) {
      if (!e.alive) continue
      if (!hitFriendly && e.team !== 'enemy') continue
      const d = Math.hypot(e.position.x - center.x, e.position.z - center.z)
      if (d > radius + e.radius) continue
      const dir = new THREE.Vector3(e.position.x - center.x, 0, e.position.z - center.z)
      this.damage(e, damage, { source, color, crit, onHit: opts.onHit })
      this.knock(e, dir, knockback * (1 - d / (radius * 1.6)), { source, wallSlam, color, stagger: 0.3, wallSlamDamage: opts.wallSlamDamage })
      hits++
    }
    return hits
  }

  /** Line/box sweep used by piercing attacks. */
  line(origin, yaw, opts = {}) {
    const { length = 12, width = 1.4, damage = 18, knockback = 4, source = 'player', color = 0xffffff, crit = false, maxTargets = Infinity } = opts
    const fx = Math.sin(yaw)
    const fz = Math.cos(yaw)
    const results = []
    for (const e of this.enemies) {
      if (!e.alive) continue
      const dx = e.position.x - origin.x
      const dz = e.position.z - origin.z
      const along = dx * fx + dz * fz
      if (along < -0.5 || along > length) continue
      const perp = Math.abs(dx * fz - dz * fx)
      if (perp > width + e.radius) continue
      results.push({ e, along })
    }
    results.sort((a, b) => a.along - b.along)
    let hits = 0
    for (const { e } of results.slice(0, maxTargets)) {
      const dir = new THREE.Vector3(e.position.x - origin.x, 0, e.position.z - origin.z)
      this.damage(e, damage, { source, color, crit })
      this.knock(e, dir, knockback, { source, wallSlam: opts.wallSlam, color })
      hits++
      if (opts.onHit) opts.onHit(e)
    }
    return hits
  }

  onEnemyKilled(enemy) {
    this.kills++
    this.game.addScore(Math.round(120 * (1 + this.rankIndex * 0.5)))
    this.game.stats.kills = this.kills
  }

  update(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt
      if (this.comboTimer <= 0 && this.combo > 0) {
        this.combo = 0
        this.rankIndex = 0
      }
    }
    for (const e of this.enemies) {
      if (e._slam) {
        e._slam.timer -= dt
        if (e._slam.timer <= 0) {
          e._slam = null
          e.onWallHit = null
        }
      }
    }
  }
}
