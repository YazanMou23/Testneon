// Shared mutable pointer state. Window events write here; useFrame reads it,
// so pointer motion never triggers a React re-render.
export interface PointerState {
  x: number // -1 (left) .. 1 (right)
  y: number // -1 (top) .. 1 (bottom)
  active: boolean // a live pointer/touch position is driving the face
  lastMove: number
  near: number // 0..1 how close the cursor is to the head (set by the face)
}

export const pointer: PointerState = { x: 0, y: 0, active: false, lastMove: 0, near: 0 }

const IDLE_AFTER_MS = 3500

if (typeof window !== 'undefined') {
  const onMove = (clientX: number, clientY: number) => {
    pointer.x = (clientX / window.innerWidth) * 2 - 1
    pointer.y = (clientY / window.innerHeight) * 2 - 1
    pointer.active = true
    pointer.lastMove = performance.now()
  }
  window.addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY), { passive: true })
  window.addEventListener(
    'touchmove',
    (e) => {
      const t = e.touches[0]
      if (t) onMove(t.clientX, t.clientY)
    },
    { passive: true },
  )
  window.addEventListener('pointerout', (e) => {
    if (!e.relatedTarget) pointer.active = false // cursor left the window -> neutral
  })
  window.setInterval(() => {
    if (performance.now() - pointer.lastMove > IDLE_AFTER_MS) pointer.active = false
  }, 1000)
}
