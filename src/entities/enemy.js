import * as THREE from 'three'
import { Actor } from './actor.js'
import { createHumanoid, poseHumanoid, applyDefeat } from './character.js'
import { clamp, rand, pick } from '../core/utils.js'

export const ENEMY_TYPES = {
  thug: {
    name: 'THUG', hp: 55, speed: 4.6, damage: 9, attackRange: 2.4, attackCd: 1.15,
    radius: 0.62, scale: 1.0, score: 100, windup: 0.32,
    palette: { color: 0x5a2436, accent: 0xff4d6d, skin: 0xb98a6a, hair: 0x221018 }
  },
  gunner: {
    name: 'GUNNER', hp: 42, speed: 3.9, damage: 7, attackRange: 18, preferred: 13, attackCd: 1.5,
    radius: 0.6, scale: 0.96, score: 130, ranged: true, windup: 0.4, projectileSpeed: 20,
    palette: { color: 0x24405a, accent: 0x4dc4ff, skin: 0xb98a6a, hair: 0x141b28 }
  },
  bruiser: {
    name: 'BRUISER', hp: 175, speed: 2.7, damage: 18, attackRange: 3.0, attackCd: 2.1,
    radius: 0.9, scale: 1.4, score: 240, windup: 0.55,
    palette: { color: 0x3a3a20, accent: 0xc9ff4d, skin: 0x9a8a5a, hair: 0x1a1a10 }
  },
  boss: {
    name: 'STAND LORD', hp: 650, speed: 3.4, damage: 22, attackRange: 3.4, attackCd: 1.7,
    radius: 1.3, scale: 1.9, score: 1200, boss: true, windup: 0.5,
    palette: { color: 0x2a0f3a, accent: 0xff2e88, skin: 0x6a3a8a, hair: 0xffd24a, cape: true }
  }
}

export class Enemy extends Actor {
  constructor(game, type, position, wave = 1) {
    const cfg = ENEMY_TYPES[type]
    const scaleStat = 1 + (wave - 1) * 0.16
    super(game, {
      team: 'enemy',
      position,
      radius: cfg.radius * cfg.scale,
      height: 1.9 * cfg.scale,
      hp: Math.round(cfg.hp * (cfg.boss ? 1 + (wave - 1) * 0.24 : scaleStat)),
      speed: cfg.speed
    })
    this.cfg = cfg
    this.type = type
    this.scale = cfg.scale
    this.damage = cfg.damage * (cfg.boss ? 1 + (wave - 1) * 0.12 : 1 + (wave - 1) * 0.07)
    this.attackCd = rand(cfg.attackCd, 0.3)
    this.windup = 0
    this.windupActive = false
    this.state = 'idle'
    this.strafeDir = Math.random() < 0.5 ? 1 : -1
    this.strafeTimer = rand(2, 0.5)
    this.burnDps = 0
    this.burnTimer = 0
    this.summonCd = 5
    this._repel = new THREE.Vector3()
    this.buildVisual()
  }

  buildVisual() {
    const cfg = this.cfg
    const rig = createHumanoid({
      color: cfg.palette.color,
      accent: cfg.palette.accent,
      skin: cfg.palette.skin,
      hair: cfg.palette.hair,
      emissive: cfg.palette.accent,
      emissiveIntensity: 0.25,
      bulk: 1.0 + (this.scale - 1) * 0.5,
      scale: this.scale,
      cape: !!cfg.palette.cape,
      glow: false
    })
    this.rig = rig
    this.root.add(rig.root)
    this._accent = new THREE.Color(cfg.palette.accent)

    // glowing eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: cfg.palette.accent })
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035 * this.scale, 8, 6), eyeMat)
      eye.position.set(s * 0.07 * this.scale, 0.02 * this.scale, 0.17 * this.scale)
      rig.headPivot.add(eye)
    }
    if (cfg.boss) {
      for (const s of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09 * this.scale, 0.5 * this.scale, 6), new THREE.MeshStandardMaterial({ color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.5 }))
        horn.position.set(s * 0.13 * this.scale, 0.24 * this.scale, 0)
        horn.rotation.z = s * 0.3
        rig.headPivot.add(horn)
      }
      const aura = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 40), new THREE.MeshBasicMaterial({ color: cfg.palette.accent, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }))
      aura.rotation.x = -Math.PI / 2
      aura.position.y = 0.05
      this.root.add(aura)
      this.bossAura = aura
    }

    // health bar
    const barY = this.height + 0.45
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.12), new THREE.MeshBasicMaterial({ color: 0x120610, transparent: true, opacity: 0.75, depthTest: false }))
    bg.position.y = barY
    bg.renderOrder = 5
    this.root.add(bg)
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.12), new THREE.MeshBasicMaterial({ color: cfg.boss ? 0xff2e88 : 0xff5a5a, depthTest: false }))
    fill.position.set(0, barY, 0.001)
    fill.renderOrder = 6
    this.root.add(fill)
    this.healthBar = { bg, fill, width: 1.0 }
    bg.visible = false
    fill.visible = false
  }

  get frozen() { return this.game.timeStopActive }

  onDeath() {
    this.game.audio.explosion()
    const p = this.position.clone().setY(1)
    this.game.effects.burst(p, { count: 30 + Math.round(this.scale * 14), color: new THREE.Color(this.cfg.palette.accent), speed: 8, life: 0.8, size: 0.6, gravity: 8 })
    this.game.effects.shockwave(this.position.clone().setY(0.1), this.cfg.palette.accent, 0.5, 4)
    this.game.combat.onEnemyKilled(this)
    this.healthBar.bg.visible = false
    this.healthBar.fill.visible = false
  }

  update(dt) {
    if (!this.alive) {
      this.deathTimer += dt
      applyDefeat(this.rig, this.deathTimer * 1.8)
      this.root.rotation.y = this.yaw
      if (this.deathTimer > 1.4) this.game.removeEnemy(this)
      return
    }

    // burn damage over time
    if (this.burnTimer > 0) {
      this.burnTimer -= dt
      this.burnDpsAccum = (this.burnDpsAccum || 0) + this.burnDps * dt
      if (this.burnDpsAccum >= 1) {
        const d = Math.floor(this.burnDpsAccum)
        this.burnDpsAccum -= d
        this.game.combat.damage(this, d, { source: 'player', color: 0xff6a2a, showNumber: false, noCombo: true })
      }
      if (Math.random() < dt * 12) this.game.effects.burst(this.position.clone().setY(1 + rand(1.2)), { count: 1, color: new THREE.Color(0xff6a2a), speed: 1, life: 0.5, size: 0.4, gravity: -2 })
    }

    if (this.frozen) {
      this.rig.materials.bodyMat.emissive.setHex(0x2255aa)
      this.rig.materials.bodyMat.emissiveIntensity = 0.7
      return
    }

    const player = this.game.player
    const toPlayer = new THREE.Vector3(player.position.x - this.position.x, 0, player.position.z - this.position.z)
    const dist = toPlayer.length()
    toPlayer.normalize()

    this.strafeTimer -= dt
    if (this.strafeTimer <= 0) { this.strafeTimer = rand(2.4, 1); this.strafeDir *= -1 }

    if (this.stagger > 0) {
      this.velocity.multiplyScalar(0.9)
      this.physics(dt)
      this.animate(dt, 0)
      return
    }

    this.attackCd -= dt

    // ----- movement -----
    const desired = new THREE.Vector3()
    if (this.cfg.ranged) {
      const pref = this.cfg.preferred
      if (dist > pref + 2) desired.copy(toPlayer)
      else if (dist < pref - 2.5) desired.copy(toPlayer).multiplyScalar(-1)
      else {
        desired.set(-toPlayer.z, 0, toPlayer.x).multiplyScalar(this.strafeDir)
      }
    } else {
      if (dist > this.cfg.attackRange * 0.85) desired.copy(toPlayer)
      else {
        desired.set(-toPlayer.z, 0, toPlayer.x).multiplyScalar(this.strafeDir * 0.6)
      }
    }
    // separation from other enemies
    this._repel.set(0, 0, 0)
    let neighbors = 0
    for (const e of this.game.enemies) {
      if (e === this || !e.alive) continue
      const dx = this.position.x - e.position.x
      const dz = this.position.z - e.position.z
      const d2 = dx * dx + dz * dz
      const min = (this.radius + e.radius + 0.5)
      if (d2 < min * min && d2 > 0.0001) {
        const d = Math.sqrt(d2)
        this._repel.x += (dx / d) * (1 - d / min)
        this._repel.z += (dz / d) * (1 - d / min)
        neighbors++
      }
    }
    if (neighbors > 0) desired.addScaledVector(this._repel, 1.6).normalize()

    const moveSpeed = this.baseSpeed * this.speedScale * (this.windupActive ? 0.25 : 1)
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, desired.x * moveSpeed, 8, dt)
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, desired.z * moveSpeed, 8, dt)

    // face player
    if (!this.windupActive) this.faceDirection(dt, player.position, 7)

    // ----- attacks -----
    if (this.cfg.boss) {
      this.summonCd -= dt
      if (this.summonCd <= 0 && this.game.enemies.length < 24) {
        this.summonCd = 7
        this.game.audio.bossRoar()
        this.game.hud.showBanner('SUMMONING MINIONS!')
        for (let i = 0; i < 3; i++) {
          const a = rand(Math.PI * 2)
          this.game.spawnEnemy(pick(['thug', 'gunner']), new THREE.Vector3(this.position.x + Math.cos(a) * 4, 0, this.position.z + Math.sin(a) * 4), this.game.wave)
        }
      }
    }

    if (!this.windupActive && this.attackCd <= 0 && dist <= this.cfg.attackRange) {
      this.startAttack()
    }

    if (this.windupActive) {
      this.windup -= dt
      const glow = 1 - this.windup / this.cfg.windup
      this.rig.materials.accentMat.emissiveIntensity = 0.5 + glow * 2
      if (this.windup <= 0) {
        this.windupActive = false
        this.rig.materials.accentMat.emissiveIntensity = 0.15
        this.executeAttack(dist)
      }
    }

    this.physics(dt)
    this.animate(dt, this.velocity.length())
    this.updateHealthBar()
  }

  startAttack() {
    this.windup = this.cfg.windup
    this.windupActive = true
    this.attackCd = this.cfg.attackCd
    this.game.audio.whoosh()
  }

  executeAttack(dist) {
    const player = this.game.player
    if (this.cfg.ranged) {
      const from = this.position.clone().setY(1.3)
      const target = new THREE.Vector3(player.position.x, 1.1, player.position.z)
      const dir = target.sub(from).normalize()
      // slight lead
      dir.x += player.velocity.x * 0.03
      dir.z += player.velocity.z * 0.03
      dir.normalize()
      const color = this.cfg.palette.accent
      this.game.projectiles.spawn({
        position: from, velocity: dir.multiplyScalar(this.cfg.projectileSpeed),
        damage: this.damage, radius: 0.5, color, owner: 'enemy', ttl: 3, size: 0.28, trailColor: color
      })
      this.game.audio.projectile()
      return
    }
    // melee
    const p = this.position.clone().setY(1.1)
    this.game.effects.slash(this.position.clone().setY(1.2), undefined, { color: this.cfg.palette.accent, startScale: 0.6 * this.scale, endScale: 1.4 * this.scale, ttl: 0.2 })
    if (dist <= this.cfg.attackRange + 0.8) {
      if (player.alive && player.invuln <= 0) {
        this.game.combat.damage(player, this.damage, { source: 'enemy', color: this.cfg.palette.accent })
        const kb = new THREE.Vector3(player.position.x - this.position.x, 0, player.position.z - this.position.z).normalize()
        player.applyKnockback(kb, 5, { stagger: 0.15 })
      } else {
        this.game.effects.burst(this.position.clone().setY(1.1), { count: 4, color: new THREE.Color(0xffffff), speed: 3, life: 0.2, size: 0.3, gravity: 2 })
      }
    }
    this.game.audio.hit()
  }

  updateHealthBar() {
    const show = this.alive && (this.hitFlash > 0 || this.hp < this.maxHp) && !this.cfg.boss
    this.healthBar.bg.visible = show
    this.healthBar.fill.visible = show
    if (!show) return
    const frac = clamp(this.hp / this.maxHp, 0, 1)
    this.healthBar.fill.scale.x = Math.max(0.001, frac)
    this.healthBar.fill.position.x = -(1 - frac) * 0.5 * this.healthBar.width
    const q = this.game.camera.quaternion
    this.healthBar.bg.quaternion.copy(q)
    this.healthBar.fill.quaternion.copy(q)
  }

  animate(dt, speed) {
    const mat = this.rig.materials
    const flash = this.hitFlash > 0
    if (flash) {
      mat.bodyMat.emissive.setHex(0xffffff)
      mat.bodyMat.emissiveIntensity = 1.8
    } else {
      mat.bodyMat.emissive.copy(this._accent)
      mat.bodyMat.emissiveIntensity = this.cfg.boss ? 0.55 : 0.32
    }
    poseHumanoid(this.rig, {
      time: this.animTime,
      speed: clamp(speed / this.baseSpeed, 0, 1),
      attack: this.windupActive ? 1 - clamp(this.windup / this.cfg.windup, 0, 1) : this.hitFlash,
      hurt: this.stagger > 0 ? 0.6 : 0
    })
    if (this.bossAura) {
      this.bossAura.rotation.z += dt * 0.8
      this.bossAura.material.opacity = 0.35 + Math.sin(this.game.time * 3) * 0.15
    }
  }
}

export function enemyCost(type) {
  return { thug: 1, gunner: 1, bruiser: 2, boss: 6 }[type] || 1
}
