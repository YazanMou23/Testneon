import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import FaceModel from './Face'
import Particles from './Particles'
import { pointer } from '../hooks/pointerStore'

/** Subtle camera parallax against the pointer. */
function CameraRig() {
  const { camera } = useThree()
  useFrame((_, dt) => {
    const tx = pointer.active ? pointer.x * 0.18 : 0
    const ty = pointer.active ? -pointer.y * 0.12 : 0
    camera.position.x = THREE.MathUtils.damp(camera.position.x, tx, 2, dt)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, ty, 2, dt)
    camera.lookAt(0.4, -0.05, 0)
  })
  return null
}

/** Coloured glow behind the head. Hue drifts with the cursor; it swells and
 *  brightens when the cursor gets close. */
function Glow() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, 'rgba(255,255,255,0.85)')
    grad.addColorStop(0.45, 'rgba(255,255,255,0.28)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
    return new THREE.CanvasTexture(c)
  }, [])
  const mesh = useRef<THREE.Mesh>(null!)
  const mat = useRef<THREE.MeshBasicMaterial>(null!)
  const col = useMemo(() => new THREE.Color('#4DA3FF'), [])
  const target = useMemo(() => new THREE.Color(), [])
  useFrame((state, dt) => {
    const px = pointer.active ? pointer.x : 0
    // blue (#4DA3FF) on the left -> violet in the middle -> magenta/cyan on the right
    target.setHSL(0.6 + px * 0.1, 0.95, 0.58)
    col.lerp(target, 1 - Math.exp(-3 * dt))
    mat.current.color.copy(col)
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.2) * 0.04
    const s = (6 + pointer.near * 1.2) * pulse
    mesh.current.scale.set(s, s, 1)
    mat.current.opacity = 0.55 + pointer.near * 0.35
  })
  return (
    <mesh ref={mesh} position={[0, 0.1, -1.8]}>
      <planeGeometry />
      <meshBasicMaterial
        ref={mat}
        map={tex}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

/** Places the face on the right (desktop) or lower center (compact), with an
 *  ease-out scale-up entrance. */
function FaceRig({ compact }: { compact: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const intro = useRef(0)
  useFrame((_, dt) => {
    intro.current = Math.min(1, intro.current + dt / 1.4)
    const e = 1 - Math.pow(1 - intro.current, 3)
    const base = compact ? 0.58 : 0.92
    ref.current.scale.setScalar(base * (0.82 + 0.18 * e))
    ref.current.position.set(compact ? 0.1 : 1.55, compact ? -1.1 : -0.12, 0)
  })
  return (
    <group ref={ref}>
      <Glow />
      <FaceModel />
    </group>
  )
}

export default function FaceCanvas({ compact }: { compact: boolean }) {
  return (
    <div className="canvas-layer" aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], fov: 35 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <CameraRig />
        {/* cinematic three-point lighting */}
        <ambientLight intensity={0.25} />
        <directionalLight position={[3.5, 4, 4]} intensity={2.4} color="#ffe8d6" />
        <directionalLight position={[-4, 1.5, -3]} intensity={2.6} color="#6fa8ff" />
        <pointLight position={[0, -1.6, 3]} intensity={6} color="#4653c8" />
        <FaceRig compact={compact} />
        <Particles />
      </Canvas>
    </div>
  )
}
