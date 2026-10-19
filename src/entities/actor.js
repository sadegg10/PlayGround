import * as THREE from 'three'
import { clamp, flatDistance } from '../core/utils.js'

let nextId = 1

export class Actor {
  constructor(game, opts = {}) {
    this.game = game
    this.id = nextId++
    this.team = opts.team || 'enemy'
    this.root = new THREE.Group()
    this.root.position.copy(opts.position || new THREE.Vector3())
    game.scene.add(this.root)

    this.radius = opts.radius ?? 0.7
    this.height = opts.height ?? 1.9
    this.maxHp = opts.hp ?? 100
    this.hp = this.maxHp
    this.baseSpeed = opts.speed ?? 4
    this.speed = this.baseSpeed
    this.alive = true
    this.removed = false

    this.velocity = new THREE.Vector3()
    this.knockback = new THREE.Vector3()
    this.forward = new THREE.Vector3(0, 0, 1)
    this.yaw = 0
    this.yVel = 0
    this.z = 0
    this.onGround = true

    this.stagger = 0
    this.hitFlash = 0
    this.invuln = 0
    this.attackCooldown = 0
    this.animTime = Math.random() * 10
    this.speedFactor = 1
    this.slowTimer = 0
    this.deathTimer = 0
  }

  get position() { return this.root.position }

  get speedScale() {
    return this.slowTimer > 0 ? 0.35 : 1
  }

  flash(color = 0xffffff, amount = 1) {
    this.hitFlash = Math.max(this.hitFlash, amount)
    this._flashColor = color
  }

  applyKnockback(dir, force, opts = {}) {
    if (force <= 0) return
    const d = dir.clone()
    d.y = 0
    if (d.lengthSq() < 1e-6) d.set(0, 0, 1)
    d.normalize()
    const k = opts.vertical ? force * 0.5 : 0
    this.knockback.addScaledVector(d, force)
    if (k > 0) this.yVel = Math.max(this.yVel, k)
    this.onGround = false
    this.stagger = Math.max(this.stagger, opts.stagger ?? 0.25)
  }

  takeDamage(amount, opts = {}) {
    if (!this.alive || amount <= 0) return 0
    if (this.invuln > 0 && !opts.ignoreInvuln) return 0
    this.hp -= amount
    this.flash(opts.hitColor || 0xffffff, 1)
    if (this.hp <= 0) {
      this.hp = 0
      this.die(opts)
    }
    return amount
  }

  die() {
    if (!this.alive) return
    this.alive = false
    this.deathTimer = 0
    this.onDeath?.()
  }

  physics(dt) {
    const scale = this.speedScale
    // knockback decay
    const decay = Math.exp(-6 * dt)
    this.knockback.multiplyScalar(decay)
    if (this.knockback.lengthSq() < 0.01) this.knockback.set(0, 0, 0)

    const move = this.velocity.clone().multiplyScalar(scale)
    this.position.addScaledVector(move, dt)
    this.position.addScaledVector(this.knockback, dt)

    // gravity
    this.yVel -= 26 * dt
    this.position.y += this.yVel * dt
    if (this.position.y <= 0) {
      this.position.y = 0
      this.yVel = 0
      this.onGround = true
    }

    // arena containment + wall slam detection handled by game
    const r = this.game.arena.radius - this.radius
    const dist = Math.hypot(this.position.x, this.position.z)
    if (dist > r) {
      const nx = this.position.x / dist
      const nz = this.position.z / dist
      this.position.x = nx * r
      this.position.z = nz * r
      this.onWallHit?.(nx, nz)
    }

    // timers
    this.stagger = Math.max(0, this.stagger - dt)
    this.hitFlash = Math.max(0, this.hitFlash - dt * 5)
    this.invuln = Math.max(0, this.invuln - dt)
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
    this.slowTimer = Math.max(0, this.slowTimer - dt)
    this.animTime += dt * (1 + this.velocity.length() * 0.1)
  }

  faceDirection(dt, target, rate = 8) {
    const targetYaw = Math.atan2(target.x - this.position.x, target.z - this.position.z)
    let diff = targetYaw - this.yaw
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    this.yaw += diff * clamp(rate * dt, 0, 1)
    this.root.rotation.y = this.yaw
  }

  distanceTo(other) {
    return flatDistance(this.position, other.position)
  }

  dispose() {
    this.removed = true
    this.game.scene.remove(this.root)
    this.root.traverse?.((c) => {
      c.geometry?.dispose?.()
      if (c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material]
        for (const m of mats) m.dispose?.()
      }
    })
  }
}
