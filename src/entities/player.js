import * as THREE from 'three'
import { Actor } from './actor.js'
import { createHumanoid, poseHumanoid, applyDefeat } from './character.js'
import { clamp, damp, angleLerp, TAU } from '../core/utils.js'

const UP = new THREE.Vector3(0, 1, 0)

export class Player extends Actor {
  constructor(game, opts = {}) {
    super(game, { team: 'player', radius: 0.6, height: 1.9, hp: 100, speed: 7.2, ...opts })

    this.baseSpeed = 7.2
    this.maxHp = 100
    this.hp = 100
    this.energy = 100
    this.rush = 0
    this.standManifested = false
    this.stand = null

    this.dashes = 0
    this.dashCd = 0
    this.dashTimer = 0
    this.attackingRecently = 0

    this.buffs = []
    this.speedMult = 1
    this.damageMult = 1
    this.takenMult = 1
    this.regen = 0
    this.channelLock = false

    this._wish = new THREE.Vector3()
    this._fwd = new THREE.Vector3()
    this._right = new THREE.Vector3()
    this._prevVel = new THREE.Vector3()

    this.buildVisual()
  }

  buildVisual() {
    const rig = createHumanoid({
      color: 0x191d33,
      accent: 0xf5c542,
      skin: 0xe6b184,
      hair: 0x14121f,
      emissive: 0x0a0e1e,
      emissiveIntensity: 0.2,
      bulk: 1.0,
      scale: 1.0,
      glow: false
    })
    this.rig = rig
    this.body = rig.root
    this.root.add(this.body)

    // Jotaro-style cap
    const capMat = new THREE.MeshStandardMaterial({ color: 0x14121f, roughness: 0.6, metalness: 0.3 })
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), capMat)
    cap.position.y = 0.04
    cap.castShadow = true
    rig.headPivot.add(cap)
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.22), capMat)
    brim.position.set(0, 0.08, 0.2)
    brim.rotation.x = -0.15
    rig.headPivot.add(brim)

    // personal spotlight so the user always reads clearly against the dark arena
    this.spot = new THREE.PointLight(0xfff0d0, 26, 14, 2)
    this.spot.position.set(0, 4.2, 0)
    this.root.add(this.spot)

    // ground aura disc
    this.aura = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.72, 32),
      new THREE.MeshBasicMaterial({ color: 0xf5c542, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    )
    this.aura.rotation.x = -Math.PI / 2
    this.aura.position.y = 0.03
    this.root.add(this.aura)

    this.guardPose = 0
  }

  get aimYaw() { return this.game.camYaw }

  setStand(stand) {
    if (this.stand) {
      this.stand.onUnequip()
      this.stand.dispose()
    }
    this.stand = stand
    stand.onEquip()
  }

  resetBuffs() {
    this.buffs.length = 0
    this.speedMult = 1
    this.damageMult = 1
    this.takenMult = 1
    this.channelLock = false
  }

  addBuff(opts) {
    const { key, duration = 5, speed = 1, damage = 1, taken = 1, regen = 0 } = opts
    this.buffs = this.buffs.filter((b) => b.key !== key)
    this.buffs.push({ key, duration, speed, damage, taken, regen })
  }

  updateBuffs(dt) {
    let speed = 1, damage = 1, taken = 1, regen = 0
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      const b = this.buffs[i]
      b.duration -= dt
      if (b.duration <= 0) { this.buffs.splice(i, 1); continue }
      speed *= b.speed; damage *= b.damage; taken *= b.taken; regen += b.regen
    }
    this.speedMult = speed
    this.damageMult = damage
    this.takenMult = taken
    this.regen = regen
  }

  addRush(amount) { this.rush = clamp(this.rush + amount, 0, 100) }
  addEnergy(amount) { this.energy = clamp(this.energy + amount, 0, 100) }
  heal(amount) {
    const before = this.hp
    this.hp = clamp(this.hp + amount, 0, this.maxHp)
    return this.hp - before
  }

  faceAimNow() {
    this.yaw = this.game.camYaw
    this.root.rotation.y = this.yaw
  }

  takeDamage(amount, opts = {}) {
    if (this.dashTimer > 0 && !opts.ignoreInvuln) return 0
    const scaled = amount * this.takenMult
    const dealt = super.takeDamage(scaled, opts)
    if (dealt > 0) {
      this.game.hud.hurtFlash()
      this.game.audio.hit()
      this.addRush(dealt * 0.5)
      this.game.engine.addShake(0.35)
      this.hurt = 0.35
      if (!this.alive) this.game.onPlayerDeath()
    }
    return dealt
  }

  handleInput(input, dt) {
    if (!this.alive) return
    const locked = this.channelLock

    // camera-relative movement basis
    const camYaw = this.game.camYaw
    this._fwd.set(Math.sin(camYaw), 0, Math.cos(camYaw))
    this._right.crossVectors(this._fwd, UP).normalize()

    const ax = locked ? { x: 0, y: 0 } : input.axis()
    this._wish.set(0, 0, 0)
    this._wish.addScaledVector(this._fwd, ax.y)
    this._wish.addScaledVector(this._right, ax.x)
    if (this._wish.lengthSq() > 0) this._wish.normalize()

    const targetSpeed = this.baseSpeed * this.speedMult * (locked ? 0.25 : 1)
    const accel = this.onGround ? 14 : 6
    this.velocity.x = damp(this.velocity.x, this._wish.x * targetSpeed, accel, dt)
    this.velocity.z = damp(this.velocity.z, this._wish.z * targetSpeed, accel, dt)

    // dash
    this.dashCd = Math.max(0, this.dashCd - dt)
    if ((input.justPressed('ShiftLeft') || input.justPressed('ShiftRight')) && this.dashCd <= 0 && !locked) {
      const dir = this._wish.lengthSq() > 0 ? this._wish.clone() : this._fwd.clone()
      this.velocity.copy(dir.multiplyScalar(26))
      this.dashTimer = 0.16
      this.dashCd = 1.1
      this.invuln = 0.34
      this.game.audio.whoosh()
      this.game.effects.burst(this.position.clone().setY(1), { count: 14, color: new THREE.Color(0x35e0ff), speed: 4, life: 0.4, size: 0.5, gravity: 1 })
    }
    this.dashTimer = Math.max(0, this.dashTimer - dt)

    // jump
    if (input.justPressed('Space') && this.onGround && !locked) {
      this.yVel = 11
      this.onGround = false
      this.game.audio.whoosh()
    }

    // facing
    let desired = this.yaw
    if (this.attackingRecently > 0 || locked) desired = this.game.camYaw
    else if (this._wish.lengthSq() > 0.01) desired = Math.atan2(this._wish.x, this._wish.z)
    this.yaw += (() => {
      let d = ((desired - this.yaw + Math.PI) % TAU) - Math.PI
      if (d < -Math.PI) d += TAU
      return d * clamp(dt * 12, 0, 1)
    })()
    this.root.rotation.y = this.yaw

    this.attackingRecently = Math.max(0, this.attackingRecently - dt)

    // combat actions
    const s = this.stand
    if (s) {
      if (input.mouse(0) || input.down('KeyJ')) { s.tryBasic(); this.attackingRecently = 0.3 }
      if (input.justPressed('KeyQ')) { s.tryQ(); this.attackingRecently = 0.4 }
      if (input.justPressed('KeyE')) { s.tryE(); this.attackingRecently = 0.4 }
      if (input.justPressed('KeyR')) { s.tryR(); this.attackingRecently = 0.5 }
    }
    if (input.justPressed('KeyC')) {
      this.standManifested = !this.standManifested
      this.game.audio.uiClick()
      this.game.hud.showBanner(this.standManifested ? 'STAND MANIFESTED' : 'STAND DISMISSED')
    }
  }

  update(dt, input) {
    if (!this.alive) {
      this.deathTimer += dt
      applyDefeat(this.rig, this.deathTimer * 1.6)
      this.physics(dt)
      return
    }

    this.handleInput(input, dt)
    this.updateBuffs(dt)
    this.stand?.update(dt)

    if (this.regen > 0) this.heal(this.regen * dt)
    if (this.hp < this.maxHp && this.regen <= 0) this.heal(0.6 * dt)

    this.energy = clamp(this.energy + (2.5 + this.velocity.length() * 0.15) * dt, 0, 100)

    this.physics(dt)

    this.hurt = Math.max(0, (this.hurt || 0) - dt * 3)
    poseHumanoid(this.rig, {
      time: this.animTime,
      speed: clamp(this.velocity.length() / this.baseSpeed, 0, 1),
      attack: this.stand ? this.stand.strike * 0.8 : 0,
      hurt: this.hurt,
      jump: this.onGround ? null : this.yVel
    })

    const auraColor = this.stand?.meta?.palette?.accent ?? 0xf5c542
    this.aura.material.color.setHex(auraColor)
    this.aura.material.opacity = 0.25 + (this.stand ? this.stand.presence * 0.4 : 0.1)
    this.aura.scale.setScalar(1 + Math.sin(this.game.time * 4) * 0.06)
    this.aura.rotation.z += dt
  }

  onDeath() {
    this.velocity.set(0, 0, 0)
    this.game.audio.death()
  }
}
