import { Game } from './game.js'

const canvas = document.getElementById('game')

function fail(message) {
  const loading = document.getElementById('loading')
  if (loading) {
    loading.innerHTML = `<div class="loading-inner"><div class="loading-text" style="max-width:520px;line-height:1.6">${message}</div></div>`
  }
}

try {
  const game = new Game(canvas)
  window.__STAND_RUSH__ = game
  game.start()
} catch (err) {
  console.error(err)
  fail('Failed to start the arena: ' + (err && err.message ? err.message : err) + '<br>Please use a WebGL-capable desktop browser.')
}
