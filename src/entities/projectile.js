import * as THREE from 'three'
import { clamp } from '../core/utils.js'

const SPHERE = new THREE.SphereGeometry(1, 12, 10)

export class ProjectileManager {
  constructor(game) {
    this.game = game
    this.list = []
  }

  spawn(opts) {
    const {
      position, velocity = new THREE.Vector3(), damage = 10, radius = 0.5,
      color = 0x66ffcc, owner = 'player', ttl = 3, homing = 0, gravity = 0,
      pierce = 0, kind = 'bullet', size = 0.28, slow = 0, aoe = 0, trailColor = null,
      onHit = null, spin = 0, emissive = true, data = null
    } = opts

    let mesh
    if (kind === 'net') {
      const geo = new THREE.TorusGeometry(radius, 0.06, 6, 24)
      mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }))
      mesh.rotation.x = -Math.PI / 2
    } else if (kind === 'ring') {
      mesh = new THREE.Mesh(new THREE.RingGeometry(size * 0.6, size, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }))
      mesh.rotation.x = -Math.PI / 2
    } else {
      mesh = new THREE.Mesh(SPHERE, new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: emissive ? 2.4 : 0.4,
        roughness: 0.3, metalness: 0.2
      }))
      mesh.scale.setScalar(size)
    }
    mesh.position.copy(position)
    this.game.scene.add(mesh)

    const p = {
      mesh, position: mesh.position, velocity: velocity.clone(), damage, radius,
      color, owner, ttl, life: 0, homing, gravity, pierce, kind, size, slow, aoe,
      onHit, spin, trailColor: trailColor || color, data,
      hitSet: new Set(), alive: true
    }
    this.list.push(p)
    return p
  }

  _targetsFor(owner) {
    if (owner === 'player') return this.game.enemies
    return [this.game.player]
  }

  _nearest(from, owner, maxDist = 18) {
    let best = null
    let bestD = maxDist * maxDist
    for (const e of this._targetsFor(owner)) {
      if (!e || !e.alive) continue
      const d = e.position.distanceToSquared(from)
      if (d < bestD) { bestD = d; best = e }
    }
    return best
  }

  update(dt) {
    const game = this.game
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]
      // enemy projectiles hang frozen in time stop
      if (this.game.timeStopActive && p.owner === 'enemy') continue
      p.life += dt
      if (p.life > p.ttl) { this._remove(i); continue }

      if (p.spin) p.mesh.rotation.z += p.spin * dt

      if (p.homing > 0 && p.kind === 'bullet') {
        const target = this._nearest(p.position, p.owner)
        if (target) {
          const desired = new THREE.Vector3(target.position.x, target.position.y + target.height * 0.5, target.position.z).sub(p.position).normalize().multiplyScalar(p.velocity.length())
          p.velocity.lerp(desired, clamp(p.homing * dt, 0, 1))
        }
      }

      if (p.gravity) p.velocity.y -= p.gravity * dt
      p.position.addScaledVector(p.velocity, dt)

      if (p.kind === 'net') {
        // linger zone: slow + periodic damage
        for (const e of game.enemies) {
          if (!e.alive) continue
          if (e.position.distanceTo(p.position) < p.radius + e.radius) {
            e.slowTimer = Math.max(e.slowTimer, p.slow || 0.3)
            if (p.data?.burn) game.combat.applyBurn(e, p.data.burn === true ? { dps: 5, duration: 2 } : p.data.burn)
            if ((p.life % 0.45) < dt) {
              game.combat.damage(e, p.damage * 0.4, { source: 'player', color: p.color, noCombo: false })
            }
          }
        }
        continue
      }

      // collision with ground
      if (p.position.y < 0.1 && p.kind === 'bullet') {
        this._impact(p, new THREE.Vector3(p.position.x, 0.1, p.position.z))
        this._remove(i)
        continue
      }

      // collision
      const targets = this._targetsFor(p.owner)
      let collided = false
      for (const t of targets) {
        if (!t || !t.alive) continue
        const dx = t.position.x - p.position.x
        const dz = t.position.z - p.position.z
        const dy = (t.position.y + t.height * 0.5) - p.position.y
        const r = p.radius + t.radius
        if (dx * dx + dz * dz < r * r && Math.abs(dy) < t.height * 0.6 + p.radius) {
          if (p.hitSet.has(t)) continue
          p.hitSet.add(t)
          this._hit(p, t)
          if (p.pierce <= 0) { collided = true; break }
          p.pierce--
        }
      }
      if (collided) { this._remove(i); continue }

      // out of world
      if (Math.hypot(p.position.x, p.position.z) > game.arena.radius * 1.6) { this._remove(i); continue }

      // trail
      if (Math.random() < dt * 40 && p.kind === 'bullet') {
        game.effects.burst(p.position, { count: 1, color: new THREE.Color(p.trailColor), speed: 0.4, life: 0.25, size: p.size * 1.4, gravity: 0, drag: 4 })
      }
    }
  }

  _hit(p, target) {
    const game = this.game
    const color = p.color
    game.effects.hitSpark(p.position.clone(), color)
    if (p.aoe > 0) {
      game.effects.shockwave(p.position.clone(), color, 0.4, p.aoe * 2)
      game.combat.sphere(p.position, p.aoe, { damage: p.damage * 0.6, source: p.owner, color, knockback: 4, wallSlam: p.owner === 'player' })
    }
    if (p.slow > 0 && target.slowTimer !== undefined) target.slowTimer = Math.max(target.slowTimer, p.slow)
    if (p.data?.burn && target.team === 'enemy') game.combat.applyBurn(target, p.data.burn === true ? { dps: 5, duration: 2 } : p.data.burn)
    game.combat.damage(target, p.damage, { source: p.owner, color, crit: p.data?.crit })
    p.onHit?.(target, p)
    game.audio.hit()
  }

  _impact(p, at) {
    this.game.effects.hitSpark(at, p.color)
    if (p.aoe > 0) {
      this.game.effects.shockwave(at, p.color, 0.4, p.aoe * 2)
      this.game.combat.sphere(at, p.aoe, { damage: p.damage * 0.5, source: p.owner, color: p.color, knockback: 3, wallSlam: false })
    }
    p.onHit?.(null, p)
  }

  _remove(i) {
    const p = this.list[i]
    this.game.scene.remove(p.mesh)
    p.mesh.geometry?.dispose?.()
    p.mesh.material?.dispose?.()
    this.list.splice(i, 1)
  }

  clear() {
    for (let i = this.list.length - 1; i >= 0; i--) this._remove(i)
  }

  clearEnemyWithin(center, radius) {
    let count = 0
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]
      if (p.owner !== 'enemy') continue
      if (p.position.distanceTo(center) <= radius) {
        this.game.effects.hitSpark(p.position.clone(), p.color)
        this._remove(i)
        count++
      }
    }
    return count
  }
}
