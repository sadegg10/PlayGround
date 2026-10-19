import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

export class Engine {
  constructor(canvas) {
    this.canvas = canvas

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.22
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x140a2a)
    this.scene.fog = new THREE.FogExp2(0x1c1038, 0.0085)

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400)
    this.camera.position.set(0, 6, 12)

    this.composer = new EffectComposer(this.renderer)
    this.renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(this.renderPass)
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.6, 0.62)
    this.composer.addPass(this.bloom)
    this.output = new OutputPass()
    this.composer.addPass(this.output)

    this.shake = 0
    this.shakeDecay = 5.5
    this._shakeOffset = new THREE.Vector3()
    this._time = 0

    this._onResize = () => this.resize()
    window.addEventListener('resize', this._onResize)
    this.resize()
  }

  setBloom({ strength, radius, threshold }) {
    if (strength !== undefined) this.bloom.strength = strength
    if (radius !== undefined) this.bloom.radius = radius
    if (threshold !== undefined) this.bloom.threshold = threshold
  }

  addShake(amount) {
    this.shake = Math.min(1.6, this.shake + amount)
  }

  resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setSize(w, h, false)
    this.composer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  updateShake(dt) {
    this.shake = Math.max(0, this.shake - this.shakeDecay * dt * (0.4 + this.shake))
    const s = this.shake * this.shake
    this._shakeOffset.set(
      (Math.random() * 2 - 1) * s * 0.9,
      (Math.random() * 2 - 1) * s * 0.7,
      (Math.random() * 2 - 1) * s * 0.5
    )
    return this._shakeOffset
  }

  render(dt) {
    this._time += dt
    this.composer.render(dt)
  }

  dispose() {
    window.removeEventListener('resize', this._onResize)
    this.renderer.dispose()
  }
}
