import * as THREE from 'three'
import { rand, TAU } from '../core/utils.js'

function groundTexture() {
  const size = 512
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#2b2444'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 2600; i++) {
    const v = 46 + Math.random() * 40
    ctx.fillStyle = `rgb(${v},${v - 6},${v + 22})`
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2)
  }
  ctx.strokeStyle = 'rgba(150,90,255,0.75)'
  ctx.lineWidth = 3
  ctx.strokeRect(0, 0, size, size)
  ctx.strokeStyle = 'rgba(80,220,255,0.28)'
  ctx.lineWidth = 1.5
  const cell = size / 4
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(size, i * cell); ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(6, 6)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

const GO_GLYPHS = ['ゴ', 'ゴ', 'ゴ', 'ゴ', 'ゴ', 'ゴ']

function runeTexture(glyph) {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, size, size)
  ctx.font = 'bold 96px "Hiragino Sans", "Yu Gothic", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(255,46,136,0.9)'
  ctx.shadowBlur = 22
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.fillText(glyph, size / 2, size / 2 + 6)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export class Arena {
  constructor(scene) {
    this.scene = scene
    this.radius = 26
    this.wallHeight = 7
    this.group = new THREE.Group()
    scene.add(this.group)
    this.props = []
    this.runeSprites = []
    this.menace = 0
    this._time = 0

    this._buildLights()
    this._buildGround()
    this._buildWalls()
    this._buildProps()
    this._buildRunes()
    this._buildSky()
    this._buildAtmosphere()
  }

  _buildLights() {
    const ambient = new THREE.AmbientLight(0x6a5a9a, 0.5)
    this.scene.add(ambient)

    const hemi = new THREE.HemisphereLight(0x9aa0ff, 0x3a2a5a, 1.15)
    this.scene.add(hemi)

    const key = new THREE.DirectionalLight(0xfff0dd, 2.6)
    key.position.set(18, 30, 14)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.near = 1
    key.shadow.camera.far = 90
    const d = 34
    key.shadow.camera.left = -d
    key.shadow.camera.right = d
    key.shadow.camera.top = d
    key.shadow.camera.bottom = -d
    key.shadow.bias = -0.0006
    this.scene.add(key)
    this.keyLight = key

    const rim = new THREE.DirectionalLight(0x35e0ff, 1.1)
    rim.position.set(-16, 12, -18)
    this.scene.add(rim)

    const fill = new THREE.DirectionalLight(0xff2e88, 0.7)
    fill.position.set(-8, 6, 20)
    this.scene.add(fill)

    this.neonLights = []
    const colors = [0x7b2ff7, 0xff2e88, 0x35e0ff, 0xf5c542]
    for (let i = 0; i < 4; i++) {
      const pl = new THREE.PointLight(colors[i], 30, 40, 2)
      const a = (i / 4) * TAU
      pl.position.set(Math.cos(a) * this.radius * 0.82, 5.5, Math.sin(a) * this.radius * 0.82)
      this.scene.add(pl)
      this.neonLights.push(pl)
    }
  }

  _buildGround() {
    const geo = new THREE.PlaneGeometry(this.radius * 2.2, this.radius * 2.2)
    const mat = new THREE.MeshStandardMaterial({
      map: groundTexture(), color: 0x9a8ac8, roughness: 0.72, metalness: 0.18
    })
    const ground = new THREE.Mesh(geo, mat)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.group.add(ground)
    this.ground = ground

    const grid = new THREE.GridHelper(this.radius * 2, 40, 0x9b6cff, 0x4a3a7a)
    grid.material.transparent = true
    grid.material.opacity = 0.45
    grid.position.y = 0.02
    this.group.add(grid)

    const disc = new THREE.Mesh(
      new THREE.RingGeometry(this.radius - 1.2, this.radius, 96),
      new THREE.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
    )
    disc.rotation.x = -Math.PI / 2
    disc.position.y = 0.04
    this.group.add(disc)
    this.rimRing = disc
  }

  _buildWalls() {
    const seg = 24
    const mat = new THREE.MeshStandardMaterial({ color: 0x3d2b66, roughness: 0.65, metalness: 0.45, emissive: 0x160a30, emissiveIntensity: 1 })
    const trimMat = new THREE.MeshBasicMaterial({ color: 0x35e0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x7b2ff7, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending })
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * TAU
      const w = (TAU * this.radius) / seg
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, this.wallHeight, 1.2), mat)
      wall.position.set(Math.cos(a) * this.radius, this.wallHeight / 2, Math.sin(a) * this.radius)
      wall.lookAt(0, this.wallHeight / 2, 0)
      wall.castShadow = true
      wall.receiveShadow = true
      this.group.add(wall)

      const trim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.3), trimMat)
      trim.position.set(Math.cos(a) * (this.radius - 0.55), this.wallHeight - 0.25, Math.sin(a) * (this.radius - 0.55))
      trim.lookAt(0, this.wallHeight - 0.25, 0)
      this.group.add(trim)

      if (i % 3 === 0) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.25, this.wallHeight * 0.7, 0.22), stripeMat)
        stripe.position.set(Math.cos(a) * (this.radius - 0.6), this.wallHeight * 0.42, Math.sin(a) * (this.radius - 0.6))
        stripe.lookAt(0, this.wallHeight * 0.42, 0)
        this.group.add(stripe)
      }
    }
  }

  _buildProps() {
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x4a3478, roughness: 0.55, metalness: 0.5, emissive: 0x1a0a34, emissiveIntensity: 1 })
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xf5c542, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending })
    const positions = []
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2
      const r = this.radius * 0.66
      positions.push([Math.cos(a) * r, Math.sin(a) * r])
    }
    for (const [x, z] of positions) {
      const g = new THREE.Group()
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 5, 6), pillarMat)
      pillar.position.y = 2.5
      pillar.castShadow = true
      g.add(pillar)
      const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), glowMat)
      cap.position.y = 5.4
      g.add(cap)
      g.position.set(x, 0, z)
      this.group.add(g)
      this.props.push({ group: g, cap, phase: rand(TAU) })
    }

    // scattered rubble crates for visual interest
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x4a3a72, roughness: 0.8, metalness: 0.2 })
    for (let i = 0; i < 14; i++) {
      const s = rand(1.1, 0.5)
      const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat)
      const a = rand(TAU)
      const r = rand(this.radius * 0.9, 6)
      crate.position.set(Math.cos(a) * r, s / 2, Math.sin(a) * r)
      crate.rotation.y = rand(TAU)
      crate.castShadow = true
      crate.receiveShadow = true
      this.group.add(crate)
    }
  }

  _buildRunes() {
    for (let i = 0; i < 14; i++) {
      const tex = runeTexture(GO_GLYPHS[i % GO_GLYPHS.length])
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      const sprite = new THREE.Sprite(mat)
      const s = rand(3.2, 1.8)
      sprite.scale.set(s, s, 1)
      sprite.position.set(rand(this.radius * 1.6, -this.radius * 1.6), rand(7.5, 2.5), rand(this.radius * 1.6, -this.radius * 1.6))
      this.group.add(sprite)
      this.runeSprites.push({ sprite, baseY: sprite.position.y, phase: rand(TAU), speed: rand(1.4, 0.6) })
    }
  }

  _buildSky() {
    const geo = new THREE.SphereGeometry(180, 32, 16)
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x2a1452) },
        bottom: { value: new THREE.Color(0x0a0616) }
      },
      vertexShader: `varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vPos;
        void main() { float h = normalize(vPos).y * 0.5 + 0.5; gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0); }`
    })
    const sky = new THREE.Mesh(geo, mat)
    this.scene.add(sky)

    const starsGeo = new THREE.BufferGeometry()
    const n = 900
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(rand(160, 90))
      v.y = Math.abs(v.y)
      pos.set([v.x, v.y, v.z], i * 3)
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xbfc8ff, size: 0.7, transparent: true, opacity: 0.8, sizeAttenuation: true }))
    this.scene.add(stars)
  }

  _buildAtmosphere() {
    // floating ember motes
    const n = 260
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(n * 3)
    this._motes = []
    for (let i = 0; i < n; i++) {
      const a = rand(TAU)
      const r = rand(this.radius * 1.3)
      const y = rand(12, 0.5)
      pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3)
      this._motes.push({ a, r, y, speed: rand(0.3, 0.05), rise: rand(0.5, 0.1) })
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({ color: 0xff9d5c, size: 0.16, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    this.motes = new THREE.Points(geo, mat)
    this.group.add(this.motes)
  }

  setMenace(level) {
    this.menace = level
  }

  update(dt, time) {
    this._time = time
    for (const p of this.props) {
      p.cap.rotation.y += dt * 0.6
      p.cap.position.y = 5.4 + Math.sin(time * 1.4 + p.phase) * 0.15
    }
    for (let i = 0; i < this.neonLights.length; i++) {
      const pl = this.neonLights[i]
      pl.intensity = 18 + Math.sin(time * 2 + i * 1.6) * 8 + this.menace * 10
    }
    this.rimRing.rotation.z += dt * 0.15
    this.rimRing.material.opacity = 0.35 + Math.sin(time * 2) * 0.12 + this.menace * 0.2

    const targetOpacity = 0.12 + this.menace * 0.85
    for (const r of this.runeSprites) {
      r.sprite.position.y = r.baseY + Math.sin(time * r.speed + r.phase) * 0.5
      const pulse = 0.7 + Math.sin(time * 3 + r.phase) * 0.3
      r.sprite.material.opacity = targetOpacity * pulse
      r.sprite.material.rotation += dt * 0.2 * (Math.sin(r.phase) > 0 ? 1 : -1)
    }

    // motes drift
    const arr = this.motes.geometry.attributes.position.array
    for (let i = 0; i < this._motes.length; i++) {
      const m = this._motes[i]
      m.a += dt * m.speed * 0.15
      m.y += dt * m.rise
      if (m.y > 13) m.y = 0.3
      arr[i * 3] = Math.cos(m.a) * m.r
      arr[i * 3 + 1] = m.y
      arr[i * 3 + 2] = Math.sin(m.a) * m.r
    }
    this.motes.geometry.attributes.position.needsUpdate = true
  }
}
