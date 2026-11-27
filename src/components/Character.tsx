import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { pointer } from '../hooks/pointerStore'

// Cut-out cartoon character (generated in Gemini, transparent WebP) shown on a
// flat plane inside the R3F scene. The 3D feel is faked with perspective tilt,
// springs and a lean toward the cursor. Swappable: any transparent image works.
const CHARACTER_URL = `${import.meta.env.BASE_URL}character.webp`

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const K = 55
const C = 9.2 // damping ratio ~0.62: soft follow, small overshoot

function spring(st: { v: number }, target: number, dt: number, cur: number) {
  st.v += (K * (target - cur) - C * st.v) * dt
  return cur + st.v * dt
}

export default function Character() {
  const tex = useTexture(CHARACTER_URL)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  const group = useRef<THREE.Group>(null!)
  const world = useMemo(() => new THREE.Vector3(), [])
  const s = useRef({ rx: { v: 0 }, ry: { v: 0 }, rz: { v: 0 }, near: 0, t: 0 }).current

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05)
    s.t += dt
    const g = group.current
    let tY = Math.sin(s.t * 0.42) * 0.07
    let tX = Math.sin(s.t * 0.31 + 0.7) * 0.03
    let tZ = Math.sin(s.t * 0.26 + 1.4) * 0.012
    let posX = 0
    let posY = Math.sin(s.t * 1.35) * 0.012
    let posZ = 0
    let scale = 1
    let nearT = 0
    if (pointer.active) {
      g.getWorldPosition(world)
      world.project(state.camera)
      const dx = pointer.x - world.x
      const dy = pointer.y + world.y
      const dist = Math.hypot(dx * (state.size.width / state.size.height), dy)
      const u = clamp(1 - dist / 1.1, 0, 1)
      nearT = u * u * (3 - 2 * u)
      tY = clamp(pointer.x, -1, 1) * 0.1 + clamp(dx, -1, 1) * 0.03 * nearT
      tX = clamp(pointer.y, -1, 1) * 0.05 + clamp(dy, -1, 1) * 0.02 * nearT
      tZ = -clamp(pointer.x, -1, 1) * 0.025 - clamp(dx, -1, 1) * 0.03 * nearT
      // mostly translate: shifts the whole figure a little toward the cursor, keeps its shape
      posX = clamp(pointer.x, -1, 1) * 0.07 + clamp(dx, -1, 1) * 0.1 * nearT
      posY = -clamp(pointer.y, -1, 1) * 0.04 - clamp(dy, -1, 1) * 0.06 * nearT
      posZ = 0
      scale = 1 + 0.035 * nearT
    }
    s.near = THREE.MathUtils.damp(s.near, nearT, 4, dt)
    pointer.near = s.near
    g.rotation.y = spring(s.ry, tY, dt, g.rotation.y)
    g.rotation.x = spring(s.rx, tX, dt, g.rotation.x)
    g.rotation.z = spring(s.rz, tZ, dt, g.rotation.z)
    g.position.x = THREE.MathUtils.damp(g.position.x, posX, 4, dt)
    g.position.y = THREE.MathUtils.damp(g.position.y, posY, 3.5, dt)
    g.position.z = THREE.MathUtils.damp(g.position.z, posZ, 4, dt)
    const sc = THREE.MathUtils.damp(g.scale.x, scale, 3.5, dt)
    g.scale.setScalar(sc)
  })

  return (
    <group ref={group}>
      <mesh position={[0, 0.25, 0]}>
        <planeGeometry args={[3.7, 3.7]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  )
}
