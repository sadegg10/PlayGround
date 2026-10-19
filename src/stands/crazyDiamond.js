import * as THREE from 'three'
import { Stand } from './baseStand.js'

export class CrazyDiamond extends Stand {
  static meta = {
    id: 'crazy-diamond',
    name: 'CRAZY DIAMOND',
    jp: 'クレイジー・ダイヤモンド',
    type: 'Close Range · Restoration',
    emblem: '◆',
    desc: 'Josuke\'s healing Stand. It can fix anything — including you. Restore your body, revert enemy attacks, and mend the battlefield.',
    palette: { color: 0x8fa8c8, accent: 0xff6fa8, skin: 0xbfd0e6, hair: 0xffd27a, emissive: 0xff8fc0, bulk: 1.1 },
    stats: { power: 4, speed: 4, range: 2, defense: 5 },
    cooldowns: { basic: 0.3, q: 10, e: 7, r: 35 },
    abilities: { q: { name: 'RESTORE', cost: 25 }, e: { name: 'REVERT', cost: 15 }, r: { name: 'GREAT RESTORATION' } }
  }

  onUpdate(dt) {
    this.player.heal(1.5 * dt)
  }

  basic() {
    const acc = this.meta.palette.accent
    const hit = this.melee({ range: 3.1, arc: 0.85, damage: 15, knockback: 7, stagger: 0.25, color: acc, wallSlam: true })
    if (hit > 0) this.game.audio.punch(this.alt ? 1.05 : 0.95)
    else this.game.audio.whoosh()
    this.game.effects.burst(this.inFront(1.7, 1.1), { count: 10, color: new THREE.Color(acc), speed: 5, life: 0.3, size: 0.45, gravity: 4 })
    return hit > 0
  }

  abilityQ() {
    const acc = this.meta.palette.accent
    const healed = this.player.heal(38)
    this.game.audio.heal()
    this.game.hud.floatText(new THREE.Vector3(this.player.position.x, 2.4, this.player.position.z), `+${Math.round(healed)}`, 'heal')
    this.game.hud.showBanner('CRAZY DIAMOND!')
    this.game.effects.ring(this.player.position.clone().setY(0.1), { color: acc, flat: true, startScale: 0.5, endScale: 5, ttl: 0.6 })
    this.game.effects.burst(this.player.position.clone().setY(1.2), { count: 40, color: new THREE.Color(acc), speed: 5, life: 0.8, size: 0.6, gravity: -2 })
    const cleared = this.game.projectiles.clearEnemyWithin(this.player.position, 9)
    if (cleared > 0) {
      this.game.hud.floatText(new THREE.Vector3(this.player.position.x, 2.9, this.player.position.z), 'REVERTED!', 'heal')
      this.game.addScore(cleared * 20)
    }
    return true
  }

  abilityE() {
    const acc = this.meta.palette.accent
    const hits = this.melee({ range: 4.2, arc: 1.4, damage: 12, knockback: 15, stagger: 0.6, color: acc, wallSlam: true, wallSlamDamage: 50, vertical: true })
    this.game.audio.heavy()
    this.game.engine.addShake(0.4)
    this.game.effects.slash(this.inFront(2, 1.1), undefined, { color: acc, startScale: 1.2, endScale: 3, ttl: 0.3 })
    this.game.hud.showBanner('DORA!')
    this.lunge = 1
    return hits > 0
  }

  ultimate() {
    const acc = this.meta.palette.accent
    const healed = this.player.heal(70)
    this.player.energy = 100
    this.player.buffs = this.player.buffs.filter((b) => b.damage > 0)
    this.game.audio.heal()
    this.game.audio.explosion()
    this.game.engine.addShake(0.7)
    this.game.hud.floatText(new THREE.Vector3(this.player.position.x, 2.6, this.player.position.z), `+${Math.round(healed)}`, 'heal')
    this.game.hud.showBanner('GREAT RESTORATION')
    this.game.effects.ring(this.player.position.clone().setY(0.1), { color: acc, flat: true, startScale: 0.6, endScale: 11, ttl: 0.9 })
    this.game.effects.flash(this.player.position.clone().setY(1), acc, 5, 0.5)
    this.game.effects.burst(this.player.position.clone().setY(1), { count: 70, color: new THREE.Color(acc), speed: 10, life: 1, size: 0.7, gravity: -3 })
    this.game.combat.sphere(this.player.position, 9, { damage: 48, knockback: 12, color: acc, source: 'player', wallSlam: true, wallSlamDamage: 40 })
    this.game.projectiles.clearEnemyWithin(this.player.position, 12)
    return true
  }
}
