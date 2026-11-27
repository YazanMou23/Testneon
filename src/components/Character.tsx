import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { pointer } from '../hooks/pointerStore'
import { prefersReducedMotion } from '../utils/webgl'

// Cut-out cartoon character (generated in Gemini, transparent WebP) shown on a
// flat plane inside the R3F scene. The 3D feel is faked with perspective tilt,
// springs and a lean toward the cursor. Swappable: any transparent image works.
// Layers (made from the same image): base with the irises removed, an iris layer
// and an eye-opening mask. A small shader moves the irises inside the eyes and
// shifts the head region slightly against the shoulders.
const BASE = import.meta.env.BASE_URL
const URLS = [`${BASE}character-base.webp`, `${BASE}character-iris.webp`, `${BASE}character-eyemask.png`]

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`
const FRAG = `
uniform sampler2D uBase; uniform sampler2D uIris; uniform sampler2D uMask;
uniform vec2 uGaze; uniform vec2 uHead;
varying vec2 vUv;
void main(){
  float vy = 1.0 - vUv.y;
  float w = 1.0 - smoothstep(0.60, 0.72, vy);
  vec2 p = vUv - uHead * w;
  vec4 base = texture2D(uBase, p);
  // the drawn irises are converged (toward the nose); re-centre each eye so rest looks parallel
  vec2 rest = p.x < 0.5 ? vec2(-6.0 / 1024.0, 0.0) : vec2(6.5 / 1024.0, 0.0);
  vec4 iris = texture2D(uIris, p - uGaze - rest);
  float m = texture2D(uMask, p).r;
  float a = iris.a * m;
  vec3 col = mix(base.rgb, iris.rgb, a);
  gl_FragColor = vec4(col, base.a);
  #include <colorspace_fragment>
}`

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const K = 55
const C = 9.2 // damping ratio ~0.62: soft follow, small overshoot

function spring(st: { v: number }, target: number, dt: number, cur: number) {
  st.v += (K * (target - cur) - C * st.v) * dt
  return cur + st.v * dt
}

export default function Character() {
  const [baseTex, irisTex, maskTex] = useTexture(URLS)
  baseTex.colorSpace = THREE.SRGBColorSpace
  irisTex.colorSpace = THREE.SRGBColorSpace
  maskTex.colorSpace = THREE.NoColorSpace
  for (const t of [baseTex, irisTex, maskTex]) t.anisotropy = 8
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uBase: { value: baseTex },
          uIris: { value: irisTex },
          uMask: { value: maskTex },
          uGaze: { value: new THREE.Vector2() },
          uHead: { value: new THREE.Vector2() },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [baseTex, irisTex, maskTex],
  )
  const group = useRef<THREE.Group>(null!)
  const world = useMemo(() => new THREE.Vector3(), [])
  const s = useRef({ rx: { v: 0 }, ry: { v: 0 }, rz: { v: 0 }, near: 0, t: 0, gx: 0, gy: 0, hx: 0, hy: 0 }).current

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
    let gx = Math.sin(s.t * 0.37) * 0.15
    let gy = Math.sin(s.t * 0.29 + 1) * 0.08
    let hx = 0
    let hy = 0
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
      // gaze: eyes aim at the cursor from the head position; the head region turns a little, slower than the eyes
      const aspect = state.size.width / state.size.height
      gx = clamp((dx * aspect) / 0.55, -1, 1)
      gy = clamp(dy / 0.45, -1, 1)
      hx = clamp(dx * aspect, -1, 1)
      hy = clamp(dy, -1, 1)
    }
    if (!pointer.active && pointer.inside) {
      // cursor resting in the window: eyes keep looking at it while the body settles
      g.getWorldPosition(world)
      world.project(state.camera)
      const aspect = state.size.width / state.size.height
      gx = clamp(((pointer.x - world.x) * aspect) / 0.55, -1, 1)
      gy = clamp((pointer.y + world.y) / 0.45, -1, 1)
    }
    s.gx = THREE.MathUtils.damp(s.gx, gx, 16, dt)
    s.gy = THREE.MathUtils.damp(s.gy, gy, 16, dt)
    s.hx = THREE.MathUtils.damp(s.hx, hx, 5, dt)
    s.hy = THREE.MathUtils.damp(s.hy, hy, 5, dt)
    const rm = prefersReducedMotion()
    mat.uniforms.uGaze.value.set(s.gx * (7 / 1024), -s.gy * (4 / 1024))
    mat.uniforms.uHead.value.set(rm ? 0 : s.hx * 0.008, rm ? 0 : -s.hy * 0.005)
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
        <primitive object={mat} attach="material" />
      </mesh>
    </group>
  )
}
