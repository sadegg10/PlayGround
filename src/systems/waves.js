import * as THREE from 'three'
import { rand, pick, TAU } from '../core/utils.js'
import { enemyCost } from '../entities/enemy.js'

export class WaveManager {
  constructor(game) {
    this.game = game
    this.wave = 0
    this.queue = []
    this.spawnTimer = 0
    this.intermission = 0
    this.state = 'idle'
    this.pendingTotal = 0
  }

  reset() {
    this.wave = 0
    this.queue.length = 0
    this.pendingTotal = 0
    this.state = 'idle'
    this.intermission = 0
  }

  begin() {
    this.wave = 0
    this.nextWave()
  }

  composition(wave) {
    let budget = 3 + wave * 1.5
    const available = ['thug']
    if (wave >= 2) available.push('gunner')
    if (wave >= 3) available.push('bruiser')
    const list = []
    if (wave % 5 === 0) {
      list.push('boss')
      budget = Math.max(2, budget - 6)
    }
    let guard = 0
    while (budget > 0 && guard++ < 200) {
      const t = pick(available)
      const c = enemyCost(t)
      if (c > budget && list.length > 0) break
      list.push(t)
      budget -= c
    }
    return list
  }

  nextWave() {
    this.wave++
    this.game.wave = this.wave
    const comp = this.composition(this.wave)
    this.queue = comp
    this.pendingTotal = comp.length
    this.spawnTimer = 0.4
    this.state = 'spawning'
    const isBoss = this.wave % 5 === 0
    this.game.onWaveStart(this.wave, isBoss)
  }

  update(dt) {
    if (this.state === 'idle' || this.state === 'done') return

    if (this.intermission > 0) {
      this.intermission -= dt
      if (this.intermission <= 0) this.nextWave()
      return
    }

    if (this.state === 'spawning') {
      this.spawnTimer -= dt
      if (this.spawnTimer <= 0 && this.queue.length > 0) {
        const type = this.queue.shift()
        this.spawnTimer = type === 'boss' ? 1.5 : rand(0.75, 0.25) * (this.queue.length > 6 ? 0.6 : 1)
        this._spawn(type)
      }
      if (this.queue.length === 0 && this.game.enemies.length > 0) this.state = 'clearing'
      else if (this.queue.length === 0 && this.game.enemies.length === 0) this._complete()
    } else if (this.state === 'clearing') {
      if (this.game.enemies.length === 0) this._complete()
    }
  }

  _spawn(type) {
    const angle = rand(TAU)
    const r = this.game.arena.radius - rand(4, 1.5)
    const pos = new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r)
    this.game.spawnEnemy(type, pos, this.wave)
  }

  _complete() {
    this.state = 'intermission'
    this.intermission = 4
    this.game.onWaveClear(this.wave)
  }
}
