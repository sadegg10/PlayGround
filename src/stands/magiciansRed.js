import * as THREE from 'three'
import { Stand } from './baseStand.js'

export class MagiciansRed extends Stand {
  static meta = {
    id: 'magicians-red',
    name: "MAGICIAN'S RED",
    jp: 'マジシャンズレッド',
    type: 'Mid Range · Fire',
    emblem: '🜂',
    desc: 'Avdol\'s flame bird. Command fire itself — hurl Crossfire Hurricanes, bind foes in red flame, and ignite everything you touch.',
    palette: { color: 0xb02a1a, accent: 0xff8a2b, skin: 0xff6a2a, hair: 0xffd24a, emissive: 0xff5a1a, bulk: 1.08 },
    stats: { power: 4, speed: 3, range: 4, defense: 4 },
    cooldowns: { basic: 0.48, q: 6, e: 9, r: 32 },
    abilities: { q: { name: 'CROSSFIRE HURRICANE', cost: 25 }, e: { name: 'RED BIND', cost: 20 }, r: { name: 'HURRICANE SPECIAL' } }
  }

  _fireball(yaw, opts = {}) {
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
    const pos = new THREE.Vector3(this.player.position.x + dir.x * 1.3, 1.3, this.player.position.z + dir.z * 1.3)
    return this.game.projectiles.spawn({
      position: pos,
      velocity: dir.multiplyScalar(opts.speed ?? 26),
      damage: opts.damage ?? 12,
      radius: opts.radius ?? 0.6,
      color: opts.color ?? this.meta.palette.accent,
      owner: 'player',
      ttl: opts.ttl ?? 3,
      size: opts.size ?? 0.42,
      homing: opts.homing ?? 0,
      aoe: opts.aoe ?? 1.7,
      gravity: opts.gravity ?? 0,
      data: { crit: this.game.timeStopActive, burn: opts.burn },
      onHit: opts.onHit
    })
  }

  basic() {
    this._fireball(this.aimYaw, { burn: { dps: 4, duration: 2 } })
    this.game.audio.projectile()
    this.game.effects.burst(this.inFront(1.3, 1.3), { count: 12, color: new THREE.Color(0xff8a2b), speed: 4, life: 0.3, size: 0.45, gravity: -1 })
    return true
  }

  abilityQ() {
    const acc = 0xff8a2b
    for (let i = 0; i < 3; i++) {
      const yaw = this.aimYaw + (i - 1) * 0.35
      this._fireball(yaw, { damage: 22, homing: 4.5, speed: 22, size: 0.5, aoe: 1.9, burn: { dps: 6, duration: 3 } })
    }
    this.game.audio.heavy()
    this.game.engine.addShake(0.3)
    this.game.effects.burst(this.inFront(1.5, 1.3), { count: 30, color: new THREE.Color(acc), speed: 7, life: 0.5, size: 0.6, gravity: -2 })
    this.game.hud.showBanner('CROSSFIRE HURRICANE!')
    this.lunge = 0.8
    return true
  }

  abilityE() {
    const o = this.inFront(4.5, 0)
    this.game.projectiles.spawn({
      position: new THREE.Vector3(o.x, 0.6, o.z),
      velocity: new THREE.Vector3(),
      kind: 'net',
      damage: 5,
      radius: 3.2,
      slow: 4,
      color: 0xff5a1a,
      owner: 'player',
      ttl: 6,
      size: 0.4,
      data: { burn: true }
    })
    this.game.audio.summon()
    this.game.effects.ring(new THREE.Vector3(o.x, 0.1, o.z), { color: 0xff5a1a, flat: true, startScale: 0.5, endScale: 7, ttl: 0.6 })
    this.game.hud.showBanner('RED BIND')
    const hits = this.game.combat.sphere(o, 3.4, { damage: 8, knockback: 2, source: 'player', color: 0xff5a1a, wallSlam: false })
    return hits >= 0
  }

  ultimate() {
    const acc = 0xff7a2b
    this.game.audio.ult()
    this.game.hud.showBanner('CROSSFIRE HURRICANE SPECIAL!')
    const start = this.game.time
    const duration = 3.2
    const vortexMat = new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.4, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    const vortex = new THREE.Mesh(new THREE.ConeGeometry(4.5, 7, 24, 1, true), vortexMat)
    vortex.position.copy(this.player.position).setY(3.5)
    this.game.scene.add(vortex)
    let tick = 0
    const burn = () => {
      const t = this.game.time - start
      if (t >= duration) {
        this.game.scene.remove(vortex)
        vortex.geometry.dispose(); vortex.material.dispose()
        this.game.updaters = this.game.updaters.filter((u) => u !== burn)
        return
      }
      vortex.rotation.y += 0.2
      vortex.material.opacity = 0.5 * (1 - t / duration)
      vortex.position.set(this.player.position.x, 3.5, this.player.position.z)
      tick += this.game.dt
      if (tick > 0.3) {
        tick = 0
        this.game.combat.sphere(this.player.position, 4.8, { damage: 9, knockback: 1.5, source: 'player', color: acc, wallSlam: false })
        for (const e of this.game.enemies) {
          if (e.alive && e.position.distanceTo(this.player.position) < 5.2) {
            e.burnDps = 6; e.burnTimer = 2
          }
        }
      }
      this.game.effects.burst(new THREE.Vector3(this.player.position.x, 3.5, this.player.position.z), { count: 3, color: new THREE.Color(acc), speed: 6, life: 0.5, size: 0.5, gravity: -3 })
    }
    this.game.updaters.push(burn)
    return true
  }
}
