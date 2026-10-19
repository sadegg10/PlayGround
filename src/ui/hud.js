import * as THREE from 'three'
import { clamp } from '../core/utils.js'
import { STAND_METAS } from '../stands/index.js'

export class HUD {
  constructor(game) {
    this.game = game
    this.el = {}
    const ids = [
      'hud', 'health-fill', 'health-text', 'stand-fill', 'ult-fill', 'ult-text',
      'wave-number', 'wave-sub', 'stand-name', 'score', 'combo', 'combo-value',
      'style-rank', 'boss-bar-wrap', 'boss-name', 'boss-fill', 'crosshair', 'hitmarker',
      'vignette', 'timestop-overlay', 'status-banner', 'float-layer', 'portrait-glyph',
      'ab-q-name', 'ab-e-name', 'ab-r-name', 'hud-hint'
    ]
    for (const id of ids) this.el[id] = document.getElementById(id)
    this.abilities = {
      basic: document.querySelector('.ability[data-key="J"]'),
      q: document.querySelector('.ability[data-key="Q"]'),
      e: document.querySelector('.ability[data-key="E"]'),
      r: document.querySelector('.ability[data-key="R"]')
    }
    this.floats = []
    this._bannerTimer = null
    this._hitTimer = 0
    this._vignetteTimer = 0
    this._insufficientTimer = 0
  }

  setStandName(name) { this.el['stand-name'].textContent = name }
  setAbilityNames(q, e, r) {
    this.el['ab-q-name'].textContent = q
    this.el['ab-e-name'].textContent = e
    this.el['ab-r-name'].textContent = r
  }
  setPortrait(glyph, color) {
    this.el['portrait-glyph'].textContent = glyph
    const c = '#' + new THREE.Color(color).getHexString()
    this.el['portrait-glyph'].style.color = c
    this.el['portrait-glyph'].style.textShadow = `0 0 12px ${c}`
  }

  show() { this.el.hud.classList.remove('hidden') }
  hide() { this.el.hud.classList.add('hidden') }

  flashRank(rank) {
    const e = this.el['style-rank']
    e.textContent = rank
    e.classList.remove('active')
    void e.offsetWidth
    e.classList.add('active')
  }

  showBanner(text) {
    const e = this.el['status-banner']
    e.textContent = text
    e.classList.remove('hidden')
    e.style.animation = 'none'
    void e.offsetWidth
    e.style.animation = 'bannerPop 0.4s ease-out'
    clearTimeout(this._bannerTimer)
    this._bannerTimer = setTimeout(() => e.classList.add('hidden'), 1600)
  }

  hurtFlash() {
    this.el.vignette.classList.add('hurt')
    this._vignetteTimer = 0.3
  }

  flashInsufficient() {
    this._insufficientTimer = 0.4
    this.el['stand-fill'].style.filter = 'brightness(2.2)'
  }

  flashRushNotReady() {
    this._insufficientTimer = 0.4
    this.el['ult-fill'].style.filter = 'brightness(0.5)'
  }

  hitMarker() {
    const e = this.el.hitmarker
    e.classList.remove('show')
    void e.offsetWidth
    e.classList.add('show')
  }

  floatText(worldPos, text, cls = 'dmg') {
    if (this.floats.length > 40) {
      const old = this.floats.shift()
      old.el.remove()
    }
    const el = document.createElement('div')
    el.className = 'float-text ' + cls
    el.textContent = text
    this.el['float-layer'].appendChild(el)
    this.floats.push({
      el, world: worldPos.clone(), life: 0, ttl: cls === 'ora' ? 1.0 : 0.95,
      drift: (Math.random() - 0.5) * 40, rise: cls === 'crit' ? 70 : 55, scale: cls === 'crit' ? 1.2 : 1
    })
  }

  showBossBar(enemy) {
    if (!enemy) { this.el['boss-bar-wrap'].classList.add('hidden'); return }
    this.el['boss-bar-wrap'].classList.remove('hidden')
    this.el['boss-name'].textContent = enemy.cfg.name
  }
  hideBossBar() { this.el['boss-bar-wrap'].classList.add('hidden') }

  update(dt) {
    const g = this.game
    const p = g.player

    // bars
    const hpFrac = clamp(p.hp / p.maxHp, 0, 1)
    this.el['health-fill'].style.width = (hpFrac * 100) + '%'
    this.el['health-text'].textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`
    this.el['stand-fill'].style.width = clamp(p.energy, 0, 100) + '%'
    this.el['ult-fill'].style.width = clamp(p.rush, 0, 100) + '%'
    const ult = this.el['ult-fill'].parentElement
    ult.classList.toggle('ready', p.rush >= 100)
    this.el['ult-text'].textContent = p.rush >= 100 ? 'RUSH READY' : `${Math.floor(p.rush)}%`

    // wave / score / combo
    this.el['wave-number'].textContent = g.wave
    this.el['wave-sub'].textContent = `ENEMIES: ${g.enemies.length + g.waves.queue.length}`
    this.el['score'].textContent = g.score.toLocaleString()
    const combo = g.combat.combo
    this.el.combo.classList.toggle('hidden', combo < 2)
    this.el['combo-value'].textContent = combo
    this.el['style-rank'].textContent = g.combat.rank.name
    this.el['style-rank'].classList.toggle('active', g.combat.rankIndex > 0)

    // abilities
    const st = p.stand ? p.stand.hudState() : null
    if (st) {
      this._setAbility(this.abilities.basic, st.basic, true, false)
      this._setAbility(this.abilities.q, st.q.frac, st.q.ready, false)
      this._setAbility(this.abilities.e, st.e.frac, st.e.ready, false)
      this._setAbility(this.abilities.r, st.r.frac, st.r.ready, true)
    }

    // boss bar
    if (g.boss && g.boss.alive) {
      this.showBossBar(g.boss)
      this.el['boss-fill'].style.width = clamp(g.boss.hp / g.boss.maxHp, 0, 1) * 100 + '%'
    } else if (this.el['boss-bar-wrap'].classList.contains('hidden') === false) {
      this.hideBossBar()
    }

    // timers
    if (this._vignetteTimer > 0) { this._vignetteTimer -= dt; if (this._vignetteTimer <= 0) this.el.vignette.classList.remove('hurt') }
    if (this._insufficientTimer > 0) {
      this._insufficientTimer -= dt
      if (this._insufficientTimer <= 0) {
        this.el['stand-fill'].style.filter = ''
        this.el['ult-fill'].style.filter = ''
      }
    }

    this._updateFloats(dt)
  }

  _setAbility(el, frac, ready, isUlt) {
    if (!el) return
    const cd = el.querySelector('.cooldown')
    cd.style.transform = `scaleY(${clamp(frac, 0, 1)})`
    el.classList.toggle('ready', ready)
  }

  _updateFloats(dt) {
    const W = window.innerWidth, H = window.innerHeight
    const cam = this.game.camera
    const v = new THREE.Vector3()
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]
      f.life += dt
      const t = f.life / f.ttl
      if (t >= 1) { f.el.remove(); this.floats.splice(i, 1); continue }
      v.copy(f.world)
      v.y += t * 0.9
      v.project(cam)
      const x = (v.x * 0.5 + 0.5) * W
      const y = (-v.y * 0.5 + 0.5) * H
      const pop = t < 0.15 ? 0.6 + (t / 0.15) * 0.4 : 1
      f.el.style.transform = `translate(-50%,-50%) translate(${x + f.drift * t}px, ${y - f.rise * t}px) scale(${pop * f.scale})`
      f.el.style.opacity = String(clamp(1.2 - t * 1.3, 0, 1))
      f.el.style.display = v.z > 1 ? 'none' : 'block'
    }
  }
}

/** Builds the Stand selection grid from metadata. */
export function buildStandSelect(container, onPreview, onConfirm) {
  container.innerHTML = ''
  const cards = []
  STAND_METAS.forEach((meta, index) => {
    const card = document.createElement('div')
    card.className = 'stand-card'
    const accent = '#' + new THREE.Color(meta.palette.accent).getHexString()
    const color = '#' + new THREE.Color(meta.palette.color).getHexString()
    const statRow = (label, value) => `
      <div class="stat"><span style="width:34px">${label}</span>
        <span class="track"><i style="width:${(value / 5) * 100}%;background:${accent}"></i></span></div>`
    card.innerHTML = `
      <div class="emblem" style="color:${accent}">${meta.emblem}</div>
      <div class="card-name" style="color:${accent}">${meta.name}</div>
      <div class="card-type">${meta.type}</div>
      <div class="card-desc">${meta.desc}</div>
      <div class="stats">
        ${statRow('PWR', meta.stats.power)}
        ${statRow('SPD', meta.stats.speed)}
        ${statRow('RNG', meta.stats.range)}
        ${statRow('DEF', meta.stats.defense)}
      </div>`
    card.style.boxShadow = `inset 0 -40px 60px -40px ${color}`
    card.addEventListener('click', () => {
      cards.forEach((c) => c.classList.remove('selected'))
      card.classList.add('selected')
      onPreview(index)
    })
    card.addEventListener('dblclick', () => onConfirm(index))
    container.appendChild(card)
    cards.push(card)
  })
  return { cards }
}
