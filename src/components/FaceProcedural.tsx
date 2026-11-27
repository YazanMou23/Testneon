/**
 * FaceModel - the hero's 3D human face.
 *
 * NOTE: this is a procedural placeholder head (three.js primitives, original
 * code, repo license) so the experience is complete and testable end to end.
 * It is designed to be replaced by the Gemini 4 Argon generated face asset
 * behind this same component contract (a group whose head and eyes track the
 * shared pointer state with damped motion, idle breathing and blinking).
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { pointer } from '../hooks/pointerStore'

const SKIN = '#e3a88d'
const SKIN_ROUGH = 0.58

export default function FaceProcedural() {
  const head = useRef<THREE.Group>(null!)
  const eyeL = useRef<THREE.Group>(null!)
  const eyeR = useRef<THREE.Group>(null!)

  const skinMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: SKIN, roughness: SKIN_ROUGH, metalness: 0.02 }),
    [],
  )
  const lipMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#c47b72', roughness: 0.45 }),
    [],
  )
  const browMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#4a352a', roughness: 0.8 }),
    [],
  )
  const eyeWhiteMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#f2f4f6', roughness: 0.22 }),
    [],
  )
  const irisMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#5b7fa6', roughness: 0.3 }),
    [],
  )
  const pupilMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#0a0a0c', roughness: 0.35 }),
    [],
  )
  const glintMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    [],
  )

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const h = head.current
    if (!h) return

    // Target head rotation: cursor-driven, else a gentle autonomous idle.
    let ry: number
    let rx: number
    if (pointer.active) {
      ry = pointer.x * 0.55
      rx = pointer.y * 0.28
    } else {
      ry = Math.sin(t * 0.35) * 0.16 + Math.sin(t * 1.7) * 0.02
      rx = Math.sin(t * 0.5 + 1.3) * 0.06 + Math.sin(t * 2.3) * 0.012
    }
    h.rotation.y = THREE.MathUtils.damp(h.rotation.y, ry, 4, dt)
    h.rotation.x = THREE.MathUtils.damp(h.rotation.x, rx, 4, dt)

    // Breathing + floating micro-movement.
    h.position.y = Math.sin(t * 1.1) * 0.015
    const b = 1 + Math.sin(t * 1.4) * 0.004
    h.scale.set(1, b, 1)

    // Eyes track the cursor beyond the head rotation (local = world - head).
    const gY = pointer.active ? pointer.x * 0.9 : Math.sin(t * 0.4) * 0.05
    const gX = pointer.active ? pointer.y * 0.55 : 0
    const erY = THREE.MathUtils.clamp(gY - h.rotation.y, -0.28, 0.28)
    const erX = THREE.MathUtils.clamp(gX - h.rotation.x, -0.18, 0.18)
    for (const eye of [eyeL.current, eyeR.current]) {
      if (!eye) continue
      eye.rotation.y = THREE.MathUtils.damp(eye.rotation.y, erY, 8, dt)
      eye.rotation.x = THREE.MathUtils.damp(eye.rotation.x, erX, 8, dt)
      // Blink: a short dip every ~4.2 s.
      const phase = t % 4.2
      const blink = phase < 0.14 ? Math.max(0.12, Math.abs(phase - 0.07) / 0.07) : 1
      eye.scale.set(1, blink, 1)
    }
  })

  return (
    <group ref={head}>
      {/* cranium + jaw */}
      <mesh material={skinMat} scale={[0.86, 1.04, 0.92]}>
        <sphereGeometry args={[1, 64, 64]} />
      </mesh>
      <mesh material={skinMat} position={[0, -0.55, 0.12]} scale={[0.62, 0.6, 0.62]}>
        <sphereGeometry args={[1, 48, 48]} />
      </mesh>
      {/* ears */}
      <mesh material={skinMat} position={[0.84, 0.02, 0.02]} scale={[0.09, 0.15, 0.08]}>
        <sphereGeometry args={[1, 24, 24]} />
      </mesh>
      <mesh material={skinMat} position={[-0.84, 0.02, 0.02]} scale={[0.09, 0.15, 0.08]}>
        <sphereGeometry args={[1, 24, 24]} />
      </mesh>
      {/* nose */}
      <mesh material={skinMat} position={[0, -0.03, 0.88]} scale={[0.1, 0.2, 0.14]}>
        <sphereGeometry args={[1, 24, 24]} />
      </mesh>
      <mesh material={skinMat} position={[0, -0.16, 0.95]} scale={[0.085, 0.08, 0.08]}>
        <sphereGeometry args={[1, 24, 24]} />
      </mesh>
      {/* lips */}
      <mesh material={lipMat} position={[0, -0.37, 0.8]} scale={[0.17, 0.05, 0.065]}>
        <sphereGeometry args={[1, 24, 24]} />
      </mesh>
      <mesh material={lipMat} position={[0, -0.42, 0.79]} scale={[0.14, 0.055, 0.06]}>
        <sphereGeometry args={[1, 24, 24]} />
      </mesh>
      {/* brows */}
      <mesh material={browMat} position={[0.26, 0.31, 0.86]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[0.24, 0.038, 0.05]} />
      </mesh>
      <mesh material={browMat} position={[-0.26, 0.31, 0.86]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[0.24, 0.038, 0.05]} />
      </mesh>
      {/* eyes */}
      {([
        { ref: eyeL, x: 0.26 },
        { ref: eyeR, x: -0.26 },
      ] as const).map(({ ref, x }) => (
        <group key={x} ref={ref} position={[x, 0.1, 0.85]}>
          <mesh material={eyeWhiteMat} scale={[1, 0.82, 0.72]}>
            <sphereGeometry args={[0.115, 32, 32]} />
          </mesh>
          <mesh material={irisMat} position={[0, 0, 0.082]}>
            <sphereGeometry args={[0.055, 24, 24]} />
          </mesh>
          <mesh material={pupilMat} position={[0, 0, 0.108]}>
            <sphereGeometry args={[0.026, 16, 16]} />
          </mesh>
          <mesh material={glintMat} position={[0.022, 0.028, 0.118]}>
            <sphereGeometry args={[0.012, 8, 8]} />
          </mesh>
        </group>
      ))}
      {/* neck */}
      <mesh material={skinMat} position={[0, -1.2, -0.05]}>
        <cylinderGeometry args={[0.26, 0.34, 0.7, 32]} />
      </mesh>
    </group>
  )
}
