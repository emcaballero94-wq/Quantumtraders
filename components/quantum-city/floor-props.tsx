'use client'

// Low-poly "Sims-style" props for the Quantum City floor: hex platforms,
// desks with chart screens, seated/walking avatars, the plumbob and glows.
//
// Activity is ALWAYS passed in from real station state (see
// QuantumCityScene's `activityFor`) — these props never decide on their own
// to look busy. 'busy' only happens for a live `active`/`alert` station,
// 'idle' is a calm uniform breathing loop, and 'off' (no backend) leaves the
// desks empty and the screens dark (docs/quantum-city-architecture.md §37).

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export type Activity = 'busy' | 'idle' | 'off'

// ---------------------------------------------------------------- textures

function seeded(seed: number) {
  let s = seed
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}

const screenCanvasCache = new Map<string, HTMLCanvasElement>()

/** A small chart-looking canvas (line or candles), cached per color+kind. */
function screenCanvas(color: string, kind: 'line' | 'candles', bg: string): HTMLCanvasElement {
  const key = `${color}-${kind}-${bg}`
  const hit = screenCanvasCache.get(key)
  if (hit) return hit
  const rnd = seeded(color.split('').reduce((a, ch) => a + ch.charCodeAt(0), kind === 'line' ? 7 : 13))
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 160
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, 256, 160)
  g.strokeStyle = 'rgba(140,160,200,0.12)'
  g.lineWidth = 1
  for (let x = 0; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 160); g.stroke() }
  for (let y = 0; y < 160; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke() }
  let y = 90
  if (kind === 'candles') {
    for (let x = 4; x < 256; x += 9) {
      const o = y
      const cl = y + (rnd() - 0.52) * 18
      g.fillStyle = cl < o ? '#10b981' : '#ef4444'
      g.fillRect(x, Math.min(o, cl), 5, Math.max(2, Math.abs(cl - o)))
      g.fillRect(x + 2, Math.min(o, cl) - 5, 1, Math.abs(cl - o) + 10)
      y = Math.max(25, Math.min(140, cl))
    }
  } else {
    g.strokeStyle = color
    g.lineWidth = 2.5
    g.beginPath()
    for (let x = 0; x <= 256; x += 4) {
      y = Math.max(20, Math.min(145, y + (rnd() - 0.5) * 12))
      if (x === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
    g.lineTo(256, 160)
    g.lineTo(0, 160)
    g.closePath()
    g.globalAlpha = 0.18
    g.fillStyle = color
    g.fill()
    g.globalAlpha = 1
  }
  screenCanvasCache.set(key, c)
  return c
}

/** Per-mount texture (its own offset, so each station scrolls independently). */
export function useScreenTexture(color: string, kind: 'line' | 'candles', bg: string) {
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(screenCanvas(color, kind, bg))
    t.wrapS = THREE.RepeatWrapping
    t.repeat.x = 0.5
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [color, kind, bg])
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

let glowTex: THREE.CanvasTexture | null = null
export function glowTexture() {
  if (glowTex) return glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.25, 'rgba(255,255,255,0.45)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  glowTex = new THREE.CanvasTexture(c)
  return glowTex
}

export function Glow({ color, size, opacity, position = [0, 0, 0] }: { color: string; size: number; opacity: number; position?: [number, number, number] }) {
  return (
    <sprite position={position} scale={[size, size, 1]}>
      <spriteMaterial map={glowTexture()} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
    </sprite>
  )
}

// ---------------------------------------------------------------- platform

/**
 * Hex platform with a neon rim. Radius matches the cylinder's corner
 * distance; the torus is rotated so its 6 corners line up with the
 * cylinder's (cylinder corners sit at 30° + n·60° in the xz plane).
 */
export function HexPlatform({
  radius,
  color,
  height,
  rimOpacity,
  floorTint,
  onClick,
  onPointerOver,
  onPointerOut,
}: {
  radius: number
  color: string
  height: number
  rimOpacity: number
  floorTint: number
  onClick?: (e: { stopPropagation: () => void }) => void
  onPointerOver?: (e: { stopPropagation: () => void }) => void
  onPointerOut?: () => void
}) {
  return (
    <group>
      <mesh position={[0, height / 2, 0]} onClick={onClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
        <cylinderGeometry args={[radius, radius, height, 6]} />
        <meshStandardMaterial color="#0b1019" roughness={0.5} metalness={0.5} emissive={color} emissiveIntensity={floorTint} />
      </mesh>
      <mesh position={[0, height + 0.004, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
        <torusGeometry args={[radius, radius * 0.018, 4, 6]} />
        <meshBasicMaterial color={color} transparent opacity={rimOpacity} />
      </mesh>
      <mesh position={[0, height + 0.004, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
        <torusGeometry args={[radius * 0.82, radius * 0.006, 4, 6]} />
        <meshBasicMaterial color={color} transparent opacity={rimOpacity * 0.35} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------- avatars

const SHIRTS = ['#2b3a55', '#334155', '#1f2937', '#3f4b63', '#1e3a8a', '#4b5563', '#0f3d3e', '#3b2f5c']
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']
const HAIR = ['#1b1b1b', '#3b2a1a', '#5a3b1e', '#2a2a2a', '#7a5230']

/** Seated avatar, local units (≈1.9 tall). `seed` picks a stable look. */
export function SeatedAvatar({ seed, activity }: { seed: number; activity: Activity }) {
  const upper = useRef<THREE.Group>(null)
  const head = useRef<THREE.Mesh>(null)
  const phase = (seed * 1.37) % 6.28
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const busy = activity === 'busy'
    const sp = busy ? 9 : 1.6
    if (head.current) head.current.position.y = 1.28 + Math.sin(t * sp + phase) * (busy ? 0.04 : 0.015)
    if (upper.current) {
      upper.current.rotation.z = Math.sin(t * sp * 0.5 + phase) * (busy ? 0.05 : 0.02)
      upper.current.rotation.x = busy ? -0.12 : 0
    }
  })
  return (
    <group ref={upper} position={[0, 0.62, 0]}>
      <AvatarBody seed={seed} headRef={head} />
    </group>
  )
}

function AvatarBody({ seed, headRef }: { seed: number; headRef?: React.Ref<THREE.Mesh> }) {
  return (
    <>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.3, 0.38, 1, 10]} />
        <meshStandardMaterial color={SHIRTS[seed % SHIRTS.length]} roughness={0.8} />
      </mesh>
      <mesh ref={headRef} position={[0, 1.28, 0]}>
        <sphereGeometry args={[0.27, 14, 12]} />
        <meshStandardMaterial color={SKIN[(seed * 3) % SKIN.length]} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.31, 0]}>
        <sphereGeometry args={[0.285, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={HAIR[(seed * 7) % HAIR.length]} roughness={0.9} />
      </mesh>
    </>
  )
}

/** Walking avatar; `walkRef.current` is advanced by the caller to swing the legs. */
export function WalkingAvatar({ seed, walkRef, carry }: { seed: number; walkRef: React.MutableRefObject<number>; carry?: string }) {
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const upper = useRef<THREE.Group>(null)
  useFrame(() => {
    const ph = walkRef.current
    if (legL.current) legL.current.rotation.x = Math.sin(ph) * 0.55
    if (legR.current) legR.current.rotation.x = -Math.sin(ph) * 0.55
    if (upper.current) upper.current.position.y = 0.8 + Math.abs(Math.sin(ph)) * 0.05
  })
  return (
    <group>
      <group ref={upper} position={[0, 0.8, 0]}>
        <AvatarBody seed={seed} />
      </group>
      {[legL, legR].map((ref, i) => (
        <group key={i} ref={ref} position={[i ? 0.14 : -0.14, 0.82, 0]}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.2, 0.8, 0.22]} />
            <meshStandardMaterial color="#151b26" roughness={0.8} />
          </mesh>
        </group>
      ))}
      {carry && (
        <mesh position={[0, 1.35, 0.45]}>
          <icosahedronGeometry args={[0.26, 1]} />
          <meshBasicMaterial color={carry} />
          <Glow color={carry} size={2.4} opacity={0.9} />
        </mesh>
      )}
    </group>
  )
}

/** The Sims diamond. Green = live & active, red = live alert. */
export function Plumbob({ color, position, scale = 1 }: { color: string; position: [number, number, number]; scale?: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }, dt) => {
    if (!ref.current) return
    ref.current.rotation.y += dt * 2.2
    ref.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 3) * 0.12 * scale
  })
  return (
    <mesh ref={ref} position={position} scale={[scale, scale * 1.7, scale]}>
      <octahedronGeometry args={[0.3, 0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} roughness={0.3} />
    </mesh>
  )
}

// ---------------------------------------------------------------- workstation

/**
 * Two rows of desks (2 seats each) in a radius-5 local footprint — the
 * caller scales the group down to the station's real radius. Avatars only
 * sit when the station has a real backend (`activity !== 'off'`).
 */
export function Workstation({ color, activity, seed, screenBg }: { color: string; activity: Activity; seed: number; screenBg: string }) {
  const lineTex = useScreenTexture(color, 'line', screenBg)
  const candleTex = useScreenTexture(color, 'candles', screenBg)
  const lineMat = useMemo(() => new THREE.MeshBasicMaterial({ map: lineTex, color: '#5a6680' }), [lineTex])
  const candleMat = useMemo(() => new THREE.MeshBasicMaterial({ map: candleTex, color: '#5a6680' }), [candleTex])
  useEffect(() => () => { lineMat.dispose(); candleMat.dispose() }, [lineMat, candleMat])
  const target = useMemo(() => new THREE.Color(activity === 'busy' ? '#d0dbf0' : activity === 'idle' ? '#5a6680' : '#11141b'), [activity])

  useFrame((_, dt) => {
    // Charts only scroll while the station is genuinely active.
    if (activity === 'busy') {
      lineTex.offset.x += dt * 0.12
      candleTex.offset.x += dt * 0.08
    }
    lineMat.color.lerp(target, 0.08)
    candleMat.color.lerp(target, 0.08)
  })

  const rows: number[] = [-1.7, 1.3]
  const seats: number[] = [-0.9, 0.9]
  return (
    <group>
      {rows.map((dz, r) => (
        <group key={dz} position={[0, 0, dz]}>
          <mesh position={[0, 0.8, 0]}>
            <boxGeometry args={[3.6, 0.9, 1.1]} />
            <meshStandardMaterial color="#121826" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[0, 1.26, 0.56]}>
            <boxGeometry args={[3.62, 0.04, 0.04]} />
            <meshBasicMaterial color={color} transparent opacity={activity === 'off' ? 0.25 : 0.9} />
          </mesh>
          {seats.map((sx, s) => (
            <group key={sx} position={[sx, 0, 0]}>
              {[-0.42, 0.42].map((mx) => (
                <group key={mx} position={[mx, 0, -0.3]}>
                  <mesh position={[0, 1.75, 0]}>
                    <boxGeometry args={[0.78, 0.5, 0.05]} />
                    <meshStandardMaterial color="#121826" roughness={0.4} metalness={0.6} />
                  </mesh>
                  <mesh position={[0, 1.75, 0.03]} material={mx < 0 ? lineMat : candleMat}>
                    <planeGeometry args={[0.72, 0.44]} />
                  </mesh>
                  <mesh position={[0, 1.4, 0]}>
                    <boxGeometry args={[0.08, 0.3, 0.08]} />
                    <meshStandardMaterial color="#121826" />
                  </mesh>
                </group>
              ))}
              <mesh position={[0, 0.65, 1.05]}>
                <boxGeometry args={[0.8, 0.12, 0.8]} />
                <meshStandardMaterial color="#0d1118" roughness={0.8} />
              </mesh>
              <mesh position={[0, 1.1, 1.42]}>
                <boxGeometry args={[0.8, 0.9, 0.1]} />
                <meshStandardMaterial color="#0d1118" roughness={0.8} />
              </mesh>
              {activity !== 'off' && (
                <group position={[0, 0.1, 1.0]} rotation={[0, Math.PI, 0]}>
                  <SeatedAvatar seed={seed + r * 2 + s} activity={activity} />
                </group>
              )}
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}
