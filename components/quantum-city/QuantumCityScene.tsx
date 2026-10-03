'use client'

import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { QUANTUM_CITY_STATIONS, type StationDef } from './stations'
import { readCssColorVar, rgbTupleToHex } from './use-theme-color'
import type { StationLive, WiredStationId } from '@/lib/quantum-city/types'

const DEFAULT_CAMERA_POSITION: [number, number, number] = [20, 20, 26]
const DEFAULT_TARGET: [number, number, number] = [0, 0, -4]
const DORMANT_COLOR = '#4a463c'

type LiveStations = Partial<Record<WiredStationId, StationLive>>

interface QuantumCitySceneProps {
  selectedId: string | null
  onSelect: (station: StationDef) => void
  liveStations: LiveStations
}

export function QuantumCityScene({ selectedId, onSelect, liveStations }: QuantumCitySceneProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  const theme = useMemo(
    () => ({
      bgDeep: rgbTupleToHex(readCssColorVar('--c-bg-deep', [10, 9, 8])),
      border: rgbTupleToHex(readCssColorVar('--c-bg-border', [46, 42, 34])),
      inkMuted: rgbTupleToHex(readCssColorVar('--c-ink-muted', [136, 128, 112])),
      inkPrimary: rgbTupleToHex(readCssColorVar('--c-ink-primary', [243, 239, 231])),
      bear: rgbTupleToHex(readCssColorVar('--c-bear', [239, 68, 68])),
    }),
    [],
  )

  const resetCamera = () => {
    const controls = controlsRef.current
    if (!controls) return
    controls.target.set(...DEFAULT_TARGET)
    controls.object.position.set(...DEFAULT_CAMERA_POSITION)
    controls.update()
  }

  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ position: DEFAULT_CAMERA_POSITION, fov: 30 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={[theme.bgDeep]} />
        <fog attach="fog" args={[theme.bgDeep, 28, 56]} />

        {/* Low, mostly-ambient lighting on purpose: the station platforms use
            an unlit material (see Station below) so they read as flat
            holographic zone markers rather than lit 3D mounds — a single
            strong directional light across a wide flat disc reads as a dome
            due to the shading gradient, which looked like a cartoonish
            "mushroom" in review and doesn't fit the brief's premium/
            institutional direction. */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 16, 8]} intensity={0.35} color={theme.inkPrimary} />

        <Grid
          args={[70, 70]}
          cellSize={1}
          cellThickness={0.5}
          sectionSize={5}
          sectionThickness={1}
          cellColor={theme.border}
          sectionColor={theme.inkMuted}
          fadeDistance={58}
          fadeStrength={1.5}
          infiniteGrid={false}
          position={[0, -0.01, 0]}
        />

        {/* Divider between the real engines and the not-yet-built pipeline row */}
        <Line
          points={[
            [-11, 0.02, -14],
            [11, 0.02, -14],
          ]}
          color={theme.border}
          lineWidth={1}
          dashed
          dashSize={0.3}
          gapSize={0.2}
        />
        <Html position={[0, 0.3, -14]} center distanceFactor={12}>
          <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-ink-dim whitespace-nowrap">
            Pipeline — sin backend todavía
          </span>
        </Html>

        {QUANTUM_CITY_STATIONS.map((station) => (
          <Station
            key={station.id}
            station={station}
            isSelected={selectedId === station.id}
            onSelect={() => onSelect(station)}
            live={liveStations[station.id as WiredStationId] ?? null}
            alertColor={theme.bear}
          />
        ))}

        <CameraRig controlsRef={controlsRef} selectedId={selectedId} />

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.08}
          minDistance={8}
          maxDistance={42}
          maxPolarAngle={Math.PI / 2.1}
          target={DEFAULT_TARGET}
        />
      </Canvas>

      <button
        type="button"
        onClick={resetCamera}
        className="absolute bottom-4 left-4 px-3 py-1.5 rounded-md border border-bg-border bg-bg-card/80 backdrop-blur text-[11px] font-mono uppercase tracking-wider text-ink-secondary hover:text-ink-primary hover:border-ink-muted transition-colors"
      >
        Reset view
      </button>
    </div>
  )
}

function CameraRig({
  controlsRef,
  selectedId,
}: {
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>
  selectedId: string | null
}) {
  const target = useMemo(() => {
    const station = QUANTUM_CITY_STATIONS.find((s) => s.id === selectedId)
    if (!station) return null
    return new THREE.Vector3(station.position[0], 0.6, station.position[1])
  }, [selectedId])

  useFrame(() => {
    if (!target || !controlsRef.current) return
    controlsRef.current.target.lerp(target, 0.08)
    controlsRef.current.update()
  })

  return null
}

function ringPoints(radius: number, segments = 48): [number, number, number][] {
  const pts: [number, number, number][] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts.push([Math.cos(a) * radius, 0, Math.sin(a) * radius])
  }
  return pts
}

function Station({
  station,
  isSelected,
  onSelect,
  live,
  alertColor,
}: {
  station: StationDef
  isSelected: boolean
  onSelect: () => void
  live: StationLive | null
  alertColor: string
}) {
  const [hovered, setHovered] = useState(false)
  const agentRef = useRef<THREE.Mesh>(null)

  const liveColor = useMemo(() => rgbTupleToHex(readCssColorVar(station.cssColorVar)), [station.cssColorVar])
  // `live` is only present for Phase-2-wired stations (see docs §11) — an
  // 'alert' there is a real recency/severity signal (e.g. HIGH-severity Order
  // Flow events, a GEX regime flip, Risk-Off VIX), never invented. Stations
  // without a `live` entry keep the original static look untouched.
  const color = live?.state === 'alert' ? alertColor : station.implemented ? liveColor : DORMANT_COLOR
  const isActive = live?.state === 'active' || live?.state === 'alert'
  const [x, z] = station.position

  const markerSize = station.radius * 0.32
  const agentRestY = markerSize + 0.35
  const ring = useMemo(() => ringPoints(station.radius), [station.radius])

  // Idle-only motion, and only for implemented stations — a dormant
  // Strategy/Risk/Execution/Review station must look inert, not "working",
  // since there is no backend behind it (docs/quantum-city-architecture.md
  // §11/§37). The bob/spin itself is always uniform (never data-driven) —
  // only its amplitude reflects real `live.state` recency, nothing fabricated.
  useFrame(({ clock }) => {
    if (!agentRef.current || !station.implemented) return
    const t = clock.getElapsedTime()
    const amplitude = isActive ? 0.13 : 0.08
    agentRef.current.position.y = agentRestY + Math.sin(t * 1.2 + x + z) * amplitude
    agentRef.current.rotation.y = t * (isActive ? 0.7 : 0.4)
  })

  return (
    <group position={[x, 0, z]}>
      {/* Flat, unlit "zone card" — a filled disc + glowing ring outline,
          deliberately immune to scene lighting (meshBasicMaterial) so it
          reads as a holographic floor marker, not a solid lit shape. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <circleGeometry args={[station.radius, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isSelected ? 0.26 : hovered ? 0.2 : isActive ? 0.16 : station.implemented ? 0.1 : 0.05}
        />
      </mesh>
      <Line points={ring} color={color} lineWidth={isSelected || hovered ? 2.5 : isActive ? 2 : 1.5} transparent opacity={station.implemented ? 1 : 0.5} />

      {station.implemented && (
        <mesh ref={agentRef} position={[0, agentRestY, 0]}>
          <octahedronGeometry args={[markerSize, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={hovered || isSelected ? 0.8 : isActive ? 0.65 : 0.45}
            roughness={0.25}
            metalness={0.6}
            flatShading
          />
        </mesh>
      )}
      {!station.implemented && (
        <mesh position={[0, agentRestY * 0.6, 0]}>
          <octahedronGeometry args={[markerSize * 0.7, 0]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.4} />
        </mesh>
      )}

      {/* Plain DOM label via drei's Html (billboards automatically) instead of
          drei's Text — troika-three-text needs a worker to lay out glyphs,
          which some sandboxed/CSP-restricted browsers block; Html has no
          such dependency and reuses the app's own font/text styling. */}
      <Html position={[0, station.radius + 1.1, 0]} center distanceFactor={9} occlude={false}>
        <div className="flex flex-col items-center pointer-events-none select-none">
          <span
            className="text-[13px] font-mono font-bold tracking-[0.08em] whitespace-nowrap"
            style={{ color, opacity: station.implemented ? 1 : 0.6 }}
          >
            {station.name}
          </span>
          <span className="text-[9px] font-mono uppercase tracking-wider text-ink-dim" style={live?.state === 'alert' ? { color: alertColor } : undefined}>
            {!station.implemented ? 'NOT IMPLEMENTED' : live ? live.state.toUpperCase() : 'IDLE'}
          </span>
          {live && (isSelected || hovered) && (
            <span className="text-[8.5px] font-mono text-ink-dim max-w-[160px] text-center leading-snug mt-0.5">{live.detail}</span>
          )}
        </div>
      </Html>
    </group>
  )
}
