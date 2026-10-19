import * as THREE from 'three'
import { Stand } from './baseStand.js'

export class HierophantGreen extends Stand {
  static meta = {
    id: 'hierophant-green',
    name: 'HIEROPHANT GREEN',
    jp: 'ハイエロファントグリーン',
    type: 'Long Range · Volley',
    emblem: '❖',
    desc: 'Kakyoin\'s long-range Stand. Unravel its coils into emerald projectiles and unleash the Emerald Splash from any distance.',
    palette: { color: 0x1f8f5a, accent: 0x7bffb0, skin: 0x2fbf7a, hair: 0x0f5a38, emissive: 0x43ff8f, bulk: 0.95 },
    stats: { power: 3, speed: 4, range: 5, defense: 3 },
    cooldowns: { basic: 0.22, q: 5, e: 9, r: 30 },
    abilities: { q: { name: 'EMERALD SPLASH', cost: 25 }, e: { name: 'TRAP NET', cost: 20 }, r: { name: '20M SPLASH' } }
  }

  _shoot(yaw, opts = {}) {
    const dir = new THREE.Vector3(Math.sin(yaw), opts.vy ?? 0, Math.cos(yaw))
    const pos = new THREE.Vector3(
      this.player.position.x + dir.x * 1.2,
      1.15 + (opts.vy ?? 0),
      this.player.position.z + dir.z * 1.2
    )
    return this.game.projectiles.spawn({
      position: pos,
      velocity: dir.multiplyScalar(opts.speed ?? 34),
      damage: opts.damage ?? 9,
      radius: 0.5,
      color: this.meta.palette.accent,
      owner: 'player',
      ttl: 2.2,
      pierce: opts.pierce ?? 1,
      size: opts.size ?? 0.24,
      gravity: 0,
      data: { crit: this.game.timeStopActive },
      ...opts.extra
    })
  }

  basic() {
    this._shoot(this.aimYaw)
    this.game.audio.projectile()
    this.game.effects.burst(this.inFront(1.2, 1.15), { count: 6, color: new THREE.Color(this.meta.palette.accent), speed: 3, life: 0.25, size: 0.35, gravity: 0 })
    return true
  }

  abilityQ() {
    const acc = this.meta.palette.accent
    const n = 9
    for (let i = 0; i < n; i++) {
      const spread = (i / (n - 1) - 0.5) * 0.85
      this._shoot(this.aimYaw + spread, { damage: 13, speed: 38, size: 0.3, pierce: 1 })
    }
    this.game.audio.heavy()
    this.game.engine.addShake(0.25)
    this.game.effects.burst(this.inFront(1.4, 1.15), { count: 26, color: new THREE.Color(acc), speed: 8, life: 0.4, size: 0.5, gravity: 1 })
    this.game.hud.showBanner('EMERALD SPLASH!')
    this.lunge = 0.6
    return true
  }

  abilityE() {
    const acc = this.meta.palette.accent
    const o = this.inFront(5, 0)
    this.game.projectiles.spawn({
      position: new THREE.Vector3(o.x, 1.0, o.z),
      velocity: new THREE.Vector3(),
      kind: 'net',
      damage: 6,
      radius: 3.4,
      color: acc,
      owner: 'player',
      ttl: 7,
      size: 0.4
    })
    this.game.audio.summon()
    this.game.effects.ring(new THREE.Vector3(o.x, 0.1, o.z), { color: acc, flat: true, startScale: 0.5, endScale: 7, ttl: 0.6 })
    this.game.hud.showBanner('HIEROPHANT TRAP')
    return true
  }

  ultimate() {
    const acc = this.meta.palette.accent
    const n = 40
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * Math.PI * 2
      this._shoot(yaw, { damage: 15, speed: 30 + Math.random() * 10, size: 0.3, pierce: 2 })
    }
    this.game.audio.ult()
    this.game.engine.addShake(0.5)
    this.game.effects.ring(this.player.position.clone().setY(1.1), { color: acc, flat: true, startScale: 0.5, endScale: 12, ttl: 0.8 })
    this.game.effects.burst(this.player.position.clone().setY(1.1), { count: 60, color: new THREE.Color(acc), speed: 12, life: 0.8, size: 0.6, gravity: 0 })
    this.game.hud.showBanner('20M EMERALD SPLASH!')
    return true
  }
}
