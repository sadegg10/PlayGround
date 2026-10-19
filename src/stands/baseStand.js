import * as THREE from 'three'
import { createHumanoid, poseHumanoid } from '../entities/character.js'
import { clamp, damp, lerp } from '../core/utils.js'

/**
 * Base class for every playable Stand.
 *
 * Subclasses override `buildVisual()` (optional), `basic()`, `abilityQ()`,
 * `abilityE()`, `ultimate()` and optionally `update()`/`onEquip()`.
 *
 * Static `meta` describes the Stand for menus, HUD and cooldowns.
 */
export class Stand {
  constructor(game) {
    this.game = game
    this.player = game.player
    this.meta = this.constructor.meta
    this.rush = 0

    this.cd = { basic: 0, q: 0, e: 0, r: 0 }
    this.cdMax = {
      basic: this.meta.cooldowns.basic ?? 0.35,
      q: this.meta.cooldowns.q ?? 6,
      e: this.meta.cooldowns.e ?? 8,
      r: this.meta.cooldowns.r ?? 30
    }

    this.presence = 0
    this.targetPresence = 0.35
    this.lunge = 0
    this.strike = 0
    this.alt = 0
    this.channel = 0
    this.channelMax = 0
    this.channelTick = 0
    this.timers = {}
    this._tmp = new THREE.Vector3()

    this.buildVisual()
  }

  get manifest() { return this.player.standManifested }

  buildVisual() {
    const m = this.meta
    const rig = createHumanoid({
      color: m.palette.color,
      accent: m.palette.accent,
      skin: m.palette.skin ?? m.palette.color,
      hair: m.palette.hair ?? m.palette.accent,
      emissive: m.palette.emissive ?? m.palette.color,
      emissiveIntensity: 0.8,
      opacity: 0.0,
      bulk: m.palette.bulk ?? 1.05,
      scale: 1.06,
      cape: !!m.palette.cape,
      glow: true
    })
    this.rig = rig
    this.root = rig.root
    this.root.visible = false
    this.game.scene.add(this.root)

    this.light = new THREE.PointLight(m.palette.accent, 0, 9, 2)
    this.light.position.set(0, 1.3, 0)
    this.root.add(this.light)
  }

  onEquip() {
    this.root.visible = true
    this.targetPresence = this.manifest ? 1 : 0.35
    this.player.resetBuffs()
    this.game.audio.summon()
    this.game.effects.burst(
      new THREE.Vector3(this.player.position.x, 1.2, this.player.position.z),
      { count: 40, color: new THREE.Color(this.meta.palette.accent), speed: 6, life: 0.7, size: 0.7, gravity: 2 }
    )
    this.game.effects.ring(new THREE.Vector3(this.player.position.x, 0.1, this.player.position.z), {
      color: this.meta.palette.accent, flat: true, startScale: 0.4, endScale: 6, ttl: 0.6
    })
    this.game.hud.setStandName(this.meta.name)
    this.game.hud.setAbilityNames(this.meta.abilities.q.name, this.meta.abilities.e.name, this.meta.abilities.r.name)
    this.game.hud.setPortrait(this.meta.emblem, this.meta.palette.accent)
  }

  onUnequip() {}

  spawnBurstAt(position, color, count = 16, speed = 6) {
    this.game.effects.burst(position, { count, color: new THREE.Color(color), speed, life: 0.5, size: 0.6, gravity: 6 })
  }

  // ---------------- ability plumbing ----------------
  canBasic() { return this.cd.basic <= 0 && this.channel <= 0 }

  tryBasic() {
    if (!this.canBasic()) return false
    this.cd.basic = this.cdMax.basic
    this.strike = 1
    this.alt = (this.alt + 1) % 2
    return this.basic() !== false
  }

  tryQ() {
    if (this.cd.q > 0 || this.channel > 0) return false
    const cost = this.meta.abilities.q.cost ?? 0
    if (this.player.energy < cost) { this.game.hud.flashInsufficient(); return false }
    this.player.energy -= cost
    this.cd.q = this.cdMax.q
    this.player.faceAimNow()
    return this.abilityQ() !== false
  }

  tryE() {
    if (this.cd.e > 0 || this.channel > 0) return false
    const cost = this.meta.abilities.e.cost ?? 0
    if (this.player.energy < cost) { this.game.hud.flashInsufficient(); return false }
    this.player.energy -= cost
    this.cd.e = this.cdMax.e
    this.player.faceAimNow()
    return this.abilityE() !== false
  }

  tryR() {
    if (this.cd.r > 0 || this.channel > 0) return false
    if (this.player.rush < 100) { this.game.hud.flashRushNotReady(); return false }
    this.player.rush = 0
    this.cd.r = this.cdMax.r
    this.player.faceAimNow()
    this.game.onUltimate(this.meta.abilities.r.name)
    return this.ultimate() !== false
  }

  basic() { return false }
  abilityQ() { return false }
  abilityE() { return false }
  ultimate() { return false }

  // ---------------- helpers exposed to subclasses ----------------
  get aimYaw() { return this.player.aimYaw }
  get pos() { return this.player.position }

  inFront(distance = 1.5, y = 0) {
    return new THREE.Vector3(
      this.pos.x + Math.sin(this.aimYaw) * distance,
      y,
      this.pos.z + Math.cos(this.aimYaw) * distance
    )
  }

  hitOrigin() {
    return new THREE.Vector3(this.pos.x, 1.1, this.pos.z)
  }

  melee(opts) {
    return this.game.combat.meleeArc(this.hitOrigin(), this.aimYaw, { source: 'player', ...opts })
  }

  projectile(opts) {
    return this.game.projectiles.spawn(opts)
  }

  // ---------------- per-frame ----------------
  update(dt) {
    // cooldowns
    for (const k of Object.keys(this.cd)) this.cd[k] = Math.max(0, this.cd[k] - dt)
    for (const k of Object.keys(this.timers)) this.timers[k] = Math.max(0, this.timers[k] - dt)

    this.strike = Math.max(0, this.strike - dt * 5)
    this.lunge = damp(this.lunge, 0, 12, dt)

    this.targetPresence = this.manifest ? 1 : 0.35
    this.presence = damp(this.presence, this.targetPresence, 6, dt)

    // channel bookkeeping
    if (this.channel > 0) {
      this.channel -= dt
      this.channelTick -= dt
      this.onChannel(dt)
      if (this.channel <= 0) this.onChannelEnd()
    }

    this.updateVisual(dt)
    this.onUpdate(dt)
  }

  onUpdate() {}
  onChannel() {}
  onChannelEnd() {}

  updateVisual(dt) {
    if (!this.root.visible) return
    const p = this.player
    const yaw = p.aimYaw
    const side = 1.3
    const back = 0.85
    // Stand hovers beside and slightly behind the user, mirrored by facing.
    const fx = Math.sin(yaw)
    const fz = Math.cos(yaw)
    const rx = Math.cos(yaw)
    const rz = -Math.sin(yaw)
    const baseX = p.position.x - fx * back + rx * side
    const baseZ = p.position.z - fz * back + rz * side
    const lungeF = this.lunge * 1.7
    const target = this._tmp.set(
      baseX + fx * lungeF,
      p.position.y + 0.16 + Math.sin(this.game.time * 1.5) * 0.06,
      baseZ + fz * lungeF
    )
    this.root.position.lerp(target, clamp(dt * 14, 0, 1))
    this.root.rotation.y = yaw

    // opacity + glow for all materials
    const alpha = clamp(this.presence, 0, 1)
    const mats = this.rig.materials
    mats.bodyMat.opacity = 0.14 + alpha * 0.68
    mats.accentMat.opacity = 0.22 + alpha * 0.75
    mats.skinMat.opacity = 0.12 + alpha * 0.62
    mats.hairMat.opacity = 0.12 + alpha * 0.6
    const glow = 0.35 + alpha * 0.95
    mats.bodyMat.emissiveIntensity = glow
    mats.accentMat.emissiveIntensity = glow * 1.15
    mats.skinMat.emissiveIntensity = glow * 0.7
    this.light.intensity = alpha * 9

    const attackBlend = clamp(this.strike + this.channel * 0.4, 0, 1)
    poseHumanoid(this.rig, {
      time: this.game.time,
      speed: clamp(p.velocity.length() / p.baseSpeed, 0, 1),
      attack: attackBlend,
      guard: 0,
      running: p.velocity.length() > 3.5
    })

    if (this.channel > 0 && this.channelMax > 0) {
      // rapid alternating punch flurry
      const t = this.game.time * 26
      this.rig.rightArm.pivot.rotation.x = -1.2 + Math.sin(t) * 0.7
      this.rig.leftArm.pivot.rotation.x = -1.2 + Math.sin(t + Math.PI) * 0.7
      this.rig.rightArm.elbow.rotation.x = -0.4
      this.rig.leftArm.elbow.rotation.x = -0.4
    }
  }

  /** HUD state for this frame. */
  hudState() {
    return {
      basic: this.cd.basic / this.cdMax.basic,
      q: { name: this.meta.abilities.q.name, frac: this.cdMax.q ? this.cd.q / this.cdMax.q : 0, ready: this.cd.q <= 0 && this.player.energy >= (this.meta.abilities.q.cost ?? 0) },
      e: { name: this.meta.abilities.e.name, frac: this.cdMax.e ? this.cd.e / this.cdMax.e : 0, ready: this.cd.e <= 0 && this.player.energy >= (this.meta.abilities.e.cost ?? 0) },
      r: { name: this.meta.abilities.r.name, frac: this.cdMax.r ? this.cd.r / this.cdMax.r : 0, ready: this.cd.r <= 0 && this.player.rush >= 100 }
    }
  }

  dispose() {
    this.game.scene.remove(this.root)
  }
}
