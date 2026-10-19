import * as THREE from 'three'
import { Stand } from './baseStand.js'

export class SilverChariot extends Stand {
  static meta = {
    id: 'silver-chariot',
    name: 'SILVER CHARIOT',
    jp: 'シルバーチャリオッツ',
    type: 'Close Range · Speed',
    emblem: '⚔',
    desc: 'Polnareff\'s armored knight. A rapier of impossible speed — shed the armor to double your striking power and carve through the arena.',
    palette: { color: 0xc8ccd6, accent: 0x9fd8ff, skin: 0xe6eaf2, hair: 0xf5c542, emissive: 0x9fd8ff, bulk: 0.92 },
    stats: { power: 4, speed: 5, range: 3, defense: 2 },
    cooldowns: { basic: 0.2, q: 16, e: 7, r: 30 },
    abilities: { q: { name: 'ARMOR OFF', cost: 20 }, e: { name: 'HUNDRED SLASHES', cost: 25 }, r: { name: 'BLINDING SPEED' } }
  }

  onEquip() {
    super.onEquip()
    this.player.baseSpeed = 8.8
  }

  onUnequip() {
    this.player.baseSpeed = 7.2
  }

  basic() {
    const acc = this.meta.palette.accent
    const thrust = this.inFront(1.5, 1.1)
    const hits = this.game.combat.line(this.hitOrigin(), this.aimYaw, {
      length: 5.2, width: 0.55, damage: 16, knockback: 5, color: acc,
      crit: this.game.timeStopActive, wallSlam: true, wallSlamDamage: 30
    })
    if (hits > 0) this.game.audio.punch(1.4)
    else this.game.audio.whoosh()
    this.game.effects.slash(thrust, undefined, { color: acc, startScale: 0.5, endScale: 1.1, ttl: 0.16 })
    this.game.effects.burst(thrust, { count: 5, color: new THREE.Color(acc), speed: 6, life: 0.2, size: 0.35, gravity: 2 })
    this.lunge = 0.5
    return hits > 0
  }

  abilityQ() {
    this.player.addBuff({ key: 'armor-off', duration: 7, speed: 1.55, damage: 1.6, taken: 1.45 })
    this.game.audio.summon()
    this.game.hud.showBanner('ARMOR OFF!')
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2
      this.game.effects.burst(new THREE.Vector3(this.player.position.x, 1.2, this.player.position.z), {
        count: 4, color: new THREE.Color(0xdfe6f2), speed: 8, life: 0.6, size: 0.5, gravity: 10
      })
    }
    this.game.effects.ring(this.player.position.clone().setY(1.1), { color: 0x9fd8ff, startScale: 0.4, endScale: 3.5, ttl: 0.5 })
    return true
  }

  abilityE() {
    const acc = this.meta.palette.accent
    const p = this.player.position
    this.game.audio.heavy()
    this.game.engine.addShake(0.45)
    // 360 degree flurry: 6 hits in sequence
    let n = 0
    const strike = () => {
      n++
      this.game.combat.sphere(p, 4.4, { damage: 9, knockback: 2, source: 'player', color: acc, wallSlam: false })
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + n * 0.7
        const at = new THREE.Vector3(p.x + Math.cos(a) * 2.4, 1.1, p.z + Math.sin(a) * 2.4)
        this.game.effects.slash(at, undefined, { color: acc, startScale: 0.4, endScale: 1.1, ttl: 0.2 })
      }
      this.game.effects.ring(p.clone().setY(0.1), { color: acc, flat: true, startScale: 0.4, endScale: 5, ttl: 0.35 })
      return n >= 6
    }
    let t = 0
    const loop = () => {
      t += this.game.dt
      if (t > 0.12) { t = 0; if (strike()) this.game.updaters = this.game.updaters.filter((u) => u !== loop) }
    }
    this.game.updaters.push(loop)
    this.game.hud.showBanner('HUNDRED SLASHES!')
    return true
  }

  ultimate() {
    const acc = this.meta.palette.accent
    const p = this.player.position
    const start = p.clone()
    const fx = Math.sin(this.aimYaw), fz = Math.cos(this.aimYaw)
    const end = new THREE.Vector3(
      Math.max(-this.game.arena.radius + 2, Math.min(this.game.arena.radius - 2, p.x + fx * 16)),
      0,
      Math.max(-this.game.arena.radius + 2, Math.min(this.game.arena.radius - 2, p.z + fz * 16))
    )
    this.game.audio.ult()
    this.player.channelLock = true
    this.game.hud.showBanner('BLINDING SPEED!')
    const startT = this.game.time
    const dashTtl = 0.35
    const dash = () => {
      const t = Math.min(1, (this.game.time - startT) / dashTtl)
      const cur = start.clone().lerp(end, t)
      this.player.position.set(cur.x, 0, cur.z)
      // slice everything along the path
      this.game.combat.sphere(new THREE.Vector3(cur.x, 0, cur.z), 3.2, { damage: 12, knockback: 6, source: 'player', color: acc, wallSlam: true, wallSlamDamage: 50 })
      this.game.effects.slash(new THREE.Vector3(cur.x, 1.1, cur.z), undefined, { color: acc, startScale: 0.6, endScale: 1.6, ttl: 0.18 })
      this.game.effects.burst(new THREE.Vector3(cur.x, 1, cur.z), { count: 10, color: new THREE.Color(acc), speed: 6, life: 0.4, size: 0.5, gravity: 2 })
      if (t >= 1) {
        this.player.channelLock = false
        this.game.engine.addShake(0.6)
        this.game.combat.sphere(this.player.position, 4.6, { damage: 40, knockback: 12, source: 'player', color: acc, wallSlam: true, wallSlamDamage: 60 })
        this.game.updaters = this.game.updaters.filter((u) => u !== dash)
      }
    }
    this.game.updaters.push(dash)
    return true
  }
}
