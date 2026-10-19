import { StarPlatinum } from './starPlatinum.js'
import { TheWorld } from './theWorld.js'
import { CrazyDiamond } from './crazyDiamond.js'
import { HierophantGreen } from './hierophantGreen.js'
import { MagiciansRed } from './magiciansRed.js'
import { SilverChariot } from './silverChariot.js'

export const STAND_CLASSES = [
  StarPlatinum,
  TheWorld,
  CrazyDiamond,
  HierophantGreen,
  MagiciansRed,
  SilverChariot
]

export const STAND_METAS = STAND_CLASSES.map((c) => c.meta)

export function createStand(indexOrId, game) {
  const idx = typeof indexOrId === 'number'
    ? indexOrId
    : STAND_CLASSES.findIndex((c) => c.meta.id === indexOrId)
  const Cls = STAND_CLASSES[(idx + STAND_CLASSES.length) % STAND_CLASSES.length]
  return new Cls(game)
}
