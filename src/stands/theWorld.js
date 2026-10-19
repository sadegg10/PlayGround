import * as THREE from 'three'
import { Stand } from './baseStand.js'

export class TheWorld extends Stand {
  static meta = {
    id: 'the-world',
    name: 'THE WORLD',
    jp: 'ザ・ワールド',
    type: 'Close Range · Time',
    emblem: '⧗',
    desc: 'DIO\'s Stand that rules time. Stop the world, move freely within frozen seconds, and crush all who oppose you.',
    palette: { color: 0x2a2340, accent: 0xf5c542, skin: 0xd9c27a, hair: 0xf0e0a0, emissive: 0xf5c542, bulk: 1.22, cape: true },
    stats: { power: 5, speed: 3, range: 2, defense: 5 },
    cooldowns: { basic: 0.4, q: 15, e: 8, r: 40 },
    abilities: { q: { name: 'TIME STOP' }, e: { name: 'STEAMROLLER' }, r: { name: 'OVER HEAVEN' } }
  }

  basic() {
    const acc = this.meta.palette.accent
    const hit = this.melee({ range: 3.2, arc: 0.95, damage: 17, knockback: 9, stagger: 0.35, color: acc, wallSlam: true, wallSlamDamage: 44, vertical: true })
    if (hit > 0) this.game.audio.heavy()
    else this.game.audio.whoosh()
    const at = this.inFront(1.7, 1.15)
    this.game.effects.burst(at, { count: 12, color: new THREE.Color(acc), speed: 6, life: 0.3, size: 0.5, gravity: 5 })
    return hit > 0
  }

  abilityQ() {
    this.game.startTimeStop(3, 'TIME STOP')
    return true
  }

  abilityE() {
    const acc = this.meta.palette.accent
    const o = this.inFront(3.2, 0)
    this.game.audio.explosion()
    this.game.engine.addShake(0.8)
    this.game.effects.shockwave(o.clone().setY(0.1), acc, 0.7, 9)
    this.game.effects.flash(o.clone().setY(1), acc, 3.5, 0.4)
    this.game.effects.burst(o.clone().setY(0.6), { count: 46, color: new THREE.Color(acc), speed: 12, life: 0.7, size: 0.8, gravity: 12 })

    // falling steamroller slab
    const roller = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.6, 20), new THREE.MeshStandardMaterial({ color: 0xf0c33a, metalness: 0.7, roughness: 0.35 }))
    body.rotation.z = Math.PI / 2
    roller.add(body)
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.8, 18), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.5 }))
    drum.rotation.z = Math.PI / 2
    drum.position.y = 0.2
    roller.add(drum)
    roller.position.set(o.x, 9, o.z)
    this.game.scene.add(roller)
    roller.castShadow = true
    const start = this.game.time
    const fall = () => {
      const t = Math.min(1, (this.game.time - start) / 0.35)
      roller.position.y = 9 - 8.4 * (t * t)
      roller.rotation.z += 0.1
      if (t >= 1) {
        this.game.scene.remove(roller)
        roller.traverse((c) => { c.geometry?.dispose?.(); c.material?.dispose?.() })
        this.game.updaters = this.game.updaters.filter((u) => u !== fall)
      }
    }
    this.game.updaters.push(fall)

    const hits = this.game.combat.sphere(o, 4.6, { damage: 46, knockback: 14, color: acc, source: 'player', wallSlam: true, wallSlamDamage: 55 })
    this.game.hud.showBanner('ROAD ROLLER DA!')
    return hits > 0
  }

  ultimate() {
    this.game.startTimeStop(6, 'ZA WARUDO: OVER HEAVEN')
    // barrage of thrown knives
    const acc = 0xffffff
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2
      const dir = new THREE.Vector3(Math.sin(a), 0.12, Math.cos(a))
      this.game.projectiles.spawn({
        position: new THREE.Vector3(this.player.position.x, 1.3, this.player.position.z),
        velocity: dir.multiplyScalar(22),
        damage: 18, radius: 0.6, color: acc, owner: 'player', ttl: 4, pierce: 2, size: 0.22, data: { crit: true },
        trailColor: 0xf5c542
      })
    }
    this.game.audio.ult()
    return true
  }
}
