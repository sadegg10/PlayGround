/**
 * Keyboard + pointer input. Pointer lock is used for mouse-look.
 */
export class Input {
  constructor(canvas) {
    this.canvas = canvas
    this.keys = new Set()
    this.pressed = new Set()
    this.released = new Set()
    this.mouseDown = new Set()
    this.mousePressed = new Set()
    this.mouseDX = 0
    this.mouseDY = 0
    this.locked = false
    this.onAction = null

    this._bind()
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) {
        // still record as held
        this.keys.add(e.code)
        return
      }
      this.keys.add(e.code)
      this.pressed.add(e.code)
      if (['Tab', 'Space', 'KeyQ', 'KeyE', 'KeyR', 'KeyJ', 'KeyC', 'KeyM'].includes(e.code)) e.preventDefault()
    })
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code)
      this.released.add(e.code)
    })
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.mouseDown.clear()
    })

    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) {
        this.canvas.requestPointerLock?.()
      }
      this.mouseDown.add(e.button)
      this.mousePressed.add(e.button)
    })
    window.addEventListener('mouseup', (e) => {
      this.mouseDown.delete(e.button)
    })
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas
    })
    window.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX || 0
        this.mouseDY += e.movementY || 0
      }
    })
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  down(code) { return this.keys.has(code) }
  justPressed(code) { return this.pressed.has(code) }
  justReleased(code) { return this.released.has(code) }
  mouse(button = 0) { return this.mouseDown.has(button) }
  mouseJust(button = 0) { return this.mousePressed.has(button) }

  axis() {
    let x = 0, y = 0
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1
    const len = Math.hypot(x, y)
    if (len > 1) { x /= len; y /= len }
    return { x, y }
  }

  endFrame() {
    this.pressed.clear()
    this.released.clear()
    this.mousePressed.clear()
    this.mouseDX = 0
    this.mouseDY = 0
  }

  exitPointerLock() {
    document.exitPointerLock?.()
  }
}
