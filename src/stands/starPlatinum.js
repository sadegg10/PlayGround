import * as THREE from 'three'
import { Stand } from './baseStand.js'

export class StarPlatinum extends Stand {
  static meta = {
    id: 'star-platinum',
    name: 'STAR PLATINUM',
    jp: 'スタープラチナ',
    type: 'Close Range · Power',
    emblem: '★',
    desc: "Jotaro's indomitable Stand. Blistering punches, a piercing Star Finger, and the power to stop time itself.",
    palette: { color: 0x2b3f8f, accent: 0x9b6cff, skin: 0x4a63c8, hair: 0x120f2a, emissive: 0x7b2ff7, bulk: 1.18 },
    stats: { power: 5, speed: 4, range: 2, defense: 4 },
    cooldowns: { basic: 0.26, q: 5, e: 9, r: 34 },
    abilities: { q: { name: 'STAR FINGER' }, e: { name: 'ORA ORA RUSH' }, r: { name: 'THE WORLD' } }
  }

  basic() {
    const acc = this.meta.palette.accent
    const hit = this.melee({
      range: 3.0, arc: 0.9, damage: 12, knockback: 6, stagger: 0.22,
      color: acc, wallSlam: true, crit: this.game.timeStopActive
    })
    if (hit > 0) this.game.audio.punch(this.alt ? 1.1 : 0.9)
    else this.game.audio.whoosh()
    const at = this.inFront(1.6, 1.15)
    this.game.effects.burst(at, { count: 8, color: new THREE.Color(acc), speed: 5, life: 0.28, size: 0.4, gravity: 4, dir: this._aim() })
    return hit > 0
  }

  _aim() {
    return new THREE.Vector3(Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw))
  }

  abilityQ() {
    const acc = this.meta.palette.accent
    const o = this.hitOrigin()
    const fx = Math.sin(this.aimYaw), fz = Math.cos(this.aimYaw)
    this.game.audio.heavy()
    this.game.engine.addShake(0.4)
    // visual beam
    const beamMat = new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.02, 12, 8), beamMat)
    beam.position.copy(o).addScaledVector(this._aim(), 6)
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this._aim())
    this.game.scene.add(beam)
    const start = this.game.time
    const dispose = () => {
      const t = (this.game.time - start) / 0.28
      beam.material.opacity = Math.max(0, 0.85 * (1 - t))
      if (t >= 1) { this.game.scene.remove(beam); beam.geometry.dispose(); beam.material.dispose(); this.game.updaters = this.game.updaters.filter((u) => u !== dispose) }
    }
    this.game.updaters.push(dispose)
    for (let i = 0; i < 22; i++) {
      const p = o.clone().addScaledVector(this._aim(), i * 0.5)
      p.y = 1.15
      this.game.effects.burst(p, { count: 2, color: new THREE.Color(acc), speed: 1, life: 0.3, size: 0.4, gravity: 0 })
    }
    this.lunge = 1
    const hits = this.game.combat.line(o, this.aimYaw, {
      length: 12, width: 0.9, damage: 34, knockback: 10, color: acc,
      crit: this.game.timeStopActive, wallSlam: true, wallSlamDamage: 40
    })
    this.game.hud.showBanner('STAR FINGER!')
    return hits > 0
  }

  abilityE() {
    this.channel = this.channelMax = 1.4
    this.channelTick = 0
    this.player.channelLock = true
    this.game.audio.summon()
    this.game.hud.showBanner('ORA ORA ORA ORA!')
    return true
  }

  onChannel() {
    const acc = this.meta.palette.accent
    this.player.channelLock = true
    this.lunge = Math.min(1, this.lunge + 0.5)
    if (this.channelTick <= 0) {
      this.channelTick = 0.075
      const dmg = 6 * (this.game.timeStopActive ? 2 : 1)
      const hit = this.melee({ range: 3.6, arc: 1.0, damage: dmg, knockback: 2.5, stagger: 0.05, color: acc, wallSlam: false })
      const at = this.inFront(2, 1.2)
      this.game.effects.burst(at, { count: 6, color: new THREE.Color(acc), speed: 6, life: 0.25, size: 0.45, gravity: 3, dir: this._aim() })
      this.game.engine.addShake(0.09)
      this.game.audio.ora(this._oraI = (this._oraI || 0) + 1)
      if (hit > 0 && Math.random() < 0.4) {
        this.game.hud.floatText(new THREE.Vector3(this.player.position.x, 2.4, this.player.position.z), 'ORA!', 'ora')
      }
    }
  }

  onChannelEnd() {
    this.player.channelLock = false
    this.lunge = 0.6
  }

  ultimate() {
    this.game.startTimeStop(4.5, 'STAR PLATINUM: THE WORLD')
    return true
  }
}
