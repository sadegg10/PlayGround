import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clamp, lerp, angleDelta } from '../src/core/utils.js'
import { WaveManager } from '../src/systems/waves.js'
import { Combat, STYLE_RANKS } from '../src/systems/combat.js'
import { STAND_METAS, STAND_CLASSES } from '../src/stands/index.js'

test('math helpers behave', () => {
  assert.equal(clamp(5, 0, 3), 3)
  assert.equal(clamp(-2, 0, 3), 0)
  assert.equal(lerp(0, 10, 0.5), 5)
  assert.ok(Math.abs(angleDelta(0, Math.PI)) <= Math.PI)
})

test('wave composition ramps up and includes a boss every 5th wave', () => {
  const waves = new WaveManager({})
  const w1 = waves.composition(1)
  assert.ok(w1.length > 0)
  assert.ok(w1.every((t) => t === 'thug'), 'wave 1 only spawns thugs')

  const w3 = waves.composition(3)
  assert.ok(w3.includes('bruiser') || w3.includes('gunner'))

  const w5 = waves.composition(5)
  assert.ok(w5.includes('boss'), 'wave 5 contains a boss')

  const w10 = waves.composition(10)
  assert.ok(w10.includes('boss'), 'wave 10 contains a boss')
  assert.ok(w10.length > 1, 'boss waves still include supporting enemies')
})

test('style ranks are ordered and increase with combo', () => {
  const mins = STYLE_RANKS.map((r) => r.min)
  for (let i = 1; i < mins.length; i++) assert.ok(mins[i] > mins[i - 1], 'rank thresholds ascend')

  const combat = new Combat({ enemies: [], player: null, hud: {}, audio: {}, engine: {} })
  assert.equal(combat._rankFor(0), 0)
  assert.equal(combat._rankFor(1000), STYLE_RANKS.length - 1)
  assert.ok(combat._rankFor(20) >= combat._rankFor(5), 'more combo never lowers rank')
})

test('every Stand exposes complete metadata and a class', () => {
  assert.equal(STAND_METAS.length, 6)
  assert.equal(STAND_CLASSES.length, 6)
  const ids = new Set()
  for (const meta of STAND_METAS) {
    assert.ok(meta.id && !ids.has(meta.id), `unique id for ${meta.name}`)
    ids.add(meta.id)
    assert.ok(meta.name && meta.desc && meta.type && meta.emblem)
    for (const key of ['q', 'e', 'r']) {
      assert.ok(meta.abilities[key]?.name, `${meta.name} has ability ${key}`)
    }
    for (const key of ['power', 'speed', 'range', 'defense']) {
      assert.ok(meta.stats[key] >= 0 && meta.stats[key] <= 5, `${meta.name} stat ${key} in range`)
    }
    assert.ok(meta.palette.color !== undefined && meta.palette.accent !== undefined)
    assert.ok(meta.cooldowns.basic > 0 && meta.cooldowns.r > meta.cooldowns.q)
  }
})
