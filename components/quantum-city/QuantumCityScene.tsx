'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { PIPELINE_DIVIDER_Z, QUANTUM_CITY_STATIONS, TREE_PATHS, TREE_SLOTS, type StationDef } from './stations'
import { walkRoute } from '@/lib/quantum-city/tree-route'
import type { ManuFloorState } from './QuantumCityRoot'
import { readCssColorVar, rgbTupleToHex } from './use-theme-color'
import { Glow, HexPlatform, glowTexture, Plumbob, SeatedAvatar, WalkingAvatar, Workstation, useScreenTexture, type Activity } from './floor-props'
import type { CityEvent, StationLive, WiredStationId } from '@/lib/quantum-city/types'

// Straight in front and high, so the tree reads top-to-bottom like the sketch.
const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 60, 46]
const DEFAULT_TARGET: [number, number, number] = [0, 0, 0.5]
const DORMANT_COLOR = '#4a463c'
/** Stations are drawn larger than their layout radius so desks and avatars read at the default zoom. */
const VISUAL_SCALE = 1.6

type LiveStations = Partial<Record<WiredStationId, StationLive>>

interface Theme {
  bgDeep: string
  border: string
  inkMuted: string
  inkPrimary: string
  bear: string
  nexus: string
  atlas: string
  oracle: string
  pulse: string
}

/**
 * The one place a station's visual activity is decided, and it only reads
 * real state: no backend → 'off' (empty desks, dark screens); a live
 * `active`/`alert` from /api/quantum-city/state → 'busy'; anything else →
 * 'idle'. Nothing here is timer- or random-driven (docs §37).
 */
function activityFor(station: StationDef, live: StationLive | null, engaged = false): Activity {
  if (!station.implemented) return 'off'
  // `engaged` = M.A.N.U. is answering (center) or just read this station's
  // data (/api/oracle/chat reports which) — a real use, not a timer.
  if (engaged) return 'busy'
  return live && live.state !== 'idle' ? 'busy' : 'idle'
}

function stateWord(station: StationDef, live: StationLive | null, override?: string): string {
  if (!station.implemented) return 'SIN BACKEND'
  if (override) return override
  if (live?.state === 'alert') return 'ALERTA'
  if (live?.state === 'active') return 'ACTIVO'
  return 'EN REPOSO'
}

interface QuantumCitySceneProps {
  selectedId: string | null
  onSelect: (station: StationDef) => void
  liveStations: LiveStations
  events: CityEvent[]
  freshEventIds: string[]
  /** Slow orbit while nothing is selected; the root turns it off for reduced motion. */
  autoRotate?: boolean
  /** What the M.A.N.U. chat is doing right now (see QuantumCityRoot). */
  manu?: ManuFloorState
}

export function QuantumCityScene({ selectedId, onSelect, liveStations, events, freshEventIds, autoRotate = false, manu }: QuantumCitySceneProps) {
  const consulted = useMemo(() => new Set<string>(manu?.consultation?.sources ?? []), [manu?.consultation])
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  // Bumped by a courier when it delivers a real event; Mando's globe flashes.
  const flashRef = useRef(0)

  const theme = useMemo<Theme>(
    () => ({
      bgDeep: rgbTupleToHex(readCssColorVar('--c-bg-deep', [10, 9, 8])),
      border: rgbTupleToHex(readCssColorVar('--c-bg-border', [46, 42, 34])),
      inkMuted: rgbTupleToHex(readCssColorVar('--c-ink-muted', [136, 128, 112])),
      inkPrimary: rgbTupleToHex(readCssColorVar('--c-ink-primary', [243, 239, 231])),
      bear: rgbTupleToHex(readCssColorVar('--c-bear', [239, 68, 68])),
      nexus: rgbTupleToHex(readCssColorVar('--c-nexus', [124, 58, 237])),
      atlas: rgbTupleToHex(readCssColorVar('--c-atlas', [16, 185, 129])),
      oracle: rgbTupleToHex(readCssColorVar('--c-oracle', [232, 180, 76])),
      pulse: rgbTupleToHex(readCssColorVar('--c-pulse', [249, 115, 22])),
    }),
    [],
  )

  const stationColors = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of QUANTUM_CITY_STATIONS) map[s.id] = rgbTupleToHex(readCssColorVar(s.cssColorVar))
    return map
  }, [])

  const resetCamera = () => {
    const controls = controlsRef.current
    if (!controls) return
    controls.target.set(...DEFAULT_TARGET)
    controls.object.position.set(...DEFAULT_CAMERA_POSITION)
    controls.update()
  }

  const mando = QUANTUM_CITY_STATIONS.find((s) => s.id === 'mando')!

  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ position: DEFAULT_CAMERA_POSITION, fov: 30 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={[theme.bgDeep]} />
        <fog attach="fog" args={[theme.bgDeep, 72, 150]} />

        {/* Platforms, rims, screens and glows are unlit/emissive, so the
            lights only need to model the avatars and desks. */}
        <hemisphereLight args={[theme.inkPrimary, theme.bgDeep, 1.1]} />
        <directionalLight position={[10, 16, 8]} intensity={1.1} color={theme.inkPrimary} />

        <Grid
          args={[96, 96]}
          cellSize={1}
          cellThickness={0.5}
          sectionSize={5}
          sectionThickness={1}
          cellColor={theme.border}
          sectionColor={theme.inkMuted}
          fadeDistance={80}
          fadeStrength={1.5}
          infiniteGrid={false}
          position={[0, -0.01, 0]}
        />

        <FloorDecor theme={theme} />

        {/* Divider between the real engines and the not-yet-built pipeline row */}
        <Line
          points={[
            [-11, 0.02, PIPELINE_DIVIDER_Z],
            [11, 0.02, PIPELINE_DIVIDER_Z],
          ]}
          color={theme.border}
          lineWidth={1}
          dashed
          dashSize={0.3}
          gapSize={0.2}
        />
        <Html position={[0, 0.3, PIPELINE_DIVIDER_Z]} center distanceFactor={12} zIndexRange={[20, 0]}>
          <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-ink-dim whitespace-nowrap">
            Pipeline — sin backend todavía
          </span>
        </Html>

        <Connectors liveStations={liveStations} lineColor={theme.inkMuted} crossColor={theme.nexus} />

        <Couriers
          events={events}
          freshEventIds={freshEventIds}
          liveStations={liveStations}
          stationColors={stationColors}
          alertColor={theme.bear}
          crossColor={theme.nexus}
          consultation={manu?.consultation ?? null}
          onArrive={() => {
            flashRef.current = 1
          }}
        />

        <MandoCenter
          station={mando}
          live={liveStations.mando ?? null}
          isSelected={selectedId === 'mando'}
          onSelect={() => onSelect(mando)}
          theme={theme}
          flashRef={flashRef}
          thinking={manu?.thinking ?? null}
        />

        {QUANTUM_CITY_STATIONS.filter((s) => s.id !== 'mando').map((station) => (
          <Station
            key={station.id}
            station={station}
            isSelected={selectedId === station.id}
            onSelect={() => onSelect(station)}
            live={liveStations[station.id as WiredStationId] ?? null}
            color={stationColors[station.id]}
            theme={theme}
            consulted={consulted.has(station.id)}
          />
        ))}

        <CameraRig controlsRef={controlsRef} selectedId={selectedId} />

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.08}
          minDistance={8}
          maxDistance={84}
          maxPolarAngle={Math.PI / 2.1}
          target={DEFAULT_TARGET}
          autoRotate={autoRotate && !selectedId}
          autoRotateSpeed={0.35}
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

// The tree's lines, drawn as corridors on the floor (stations.ts has the
// sketch they come from). Couriers walk along them to reach M.A.N.U.
// GEX → Flow (the chokmah–chesed line) is the one actual cross-engine read
// in the codebase — Order Flow's /api/manu/analyze pulls GEX's latest brief
// (docs/quantum-city-architecture.md §4) — so it is tinted when both have data.
function Connectors({ liveStations, lineColor, crossColor }: { liveStations: LiveStations; lineColor: string; crossColor: string }) {
  const crossLive = Boolean(liveStations.gex && liveStations.orderflow)
  return (
    <>
      {TREE_PATHS.map(([a, b]) => {
        const isCross = (a === 'chokmah' && b === 'chesed') || (a === 'chesed' && b === 'chokmah')
        const [ax, az] = TREE_SLOTS[a]
        const [bx, bz] = TREE_SLOTS[b]
        return (
          <Line
            key={`${a}-${b}`}
            points={[
              [ax, 0.02, az],
              [bx, 0.02, bz],
            ]}
            color={isCross && crossLive ? crossColor : lineColor}
            lineWidth={isCross && crossLive ? 3.5 : 3}
            transparent
            opacity={isCross && crossLive ? 0.85 : 0.7}
          />
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------- couriers

interface CourierSpec {
  id: string
  /** Floor points along the tree's lines, already trimmed to the platform edges. */
  route: [number, number][]
  color: string
  seed: number
}

/** World units per second along the corridors. */
const COURIER_SPEED = 1.6
const COURIER_SCALE = 0.3

function radiusOf(id: string): number {
  return (QUANTUM_CITY_STATIONS.find((s) => s.id === id)?.radius ?? 1) * VISUAL_SCALE
}

// Phase 3's event bus, drawn as a person: each FRESH event (new since the
// last poll, see use-events.ts) sends one avatar from its station to M.A.N.U.
// carrying the result, then back. No fresh event → nobody walks.
function Couriers({
  events,
  freshEventIds,
  liveStations,
  stationColors,
  alertColor,
  crossColor,
  consultation,
  onArrive,
}: {
  events: CityEvent[]
  freshEventIds: string[]
  liveStations: LiveStations
  stationColors: Record<string, string>
  alertColor: string
  crossColor: string
  consultation: ManuFloorState['consultation']
  onArrive: () => void
}) {
  const [couriers, setCouriers] = useState<CourierSpec[]>([])
  const seq = useRef(0)

  // A M.A.N.U. answer: one courier per engine whose data went into it.
  useEffect(() => {
    if (!consultation || consultation.sources.length === 0) return
    const spawned = consultation.sources.map((src) => ({
      id: `manu-${consultation.id}-${src}`,
      route: walkRoute(src, 'mando', radiusOf),
      color: stationColors[src] ?? crossColor,
      seed: seq.current++,
    }))
    setCouriers((prev) => [...prev, ...spawned])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultation?.id])

  useEffect(() => {
    if (freshEventIds.length === 0) return
    const fresh = events.filter((e) => freshEventIds.includes(e.id))
    const spawned: CourierSpec[] = []
    for (const e of fresh) {
      const isUrgent = e.severity === 'high' || e.severity === 'critical' || liveStations[e.station]?.state === 'alert'
      if (e.station !== 'mando') {
        spawned.push({
          id: `${e.id}-mando-${Date.now()}`,
          route: walkRoute(e.station, 'mando', radiusOf),
          color: isUrgent ? alertColor : stationColors[e.station] ?? crossColor,
          seed: seq.current++,
        })
      }

      // The one real cross-engine read: a fresh Order Flow event, while GEX
      // has fresh-enough data, means Flow's narrative is cross-referencing
      // GEX's gamma regime right now (see Connectors' comment above).
      if (e.station === 'orderflow' && liveStations.gex && liveStations.gex.state !== 'idle') {
        spawned.push({
          id: `${e.id}-gexflow-${Date.now()}`,
          route: walkRoute('gex', 'orderflow', radiusOf),
          color: crossColor,
          seed: seq.current++,
        })
      }
    }
    if (spawned.length > 0) setCouriers((prev) => [...prev, ...spawned])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshEventIds])

  const handleDone = (id: string) => setCouriers((prev) => prev.filter((c) => c.id !== id))

  return (
    <>
      {couriers
        .filter((c) => c.route.length >= 2)
        .map((c) => (
          <Courier key={c.id} spec={c} onArrive={onArrive} onDone={() => handleDone(c.id)} />
        ))}
    </>
  )
}

function Courier({ spec, onArrive, onDone }: { spec: CourierSpec; onArrive: () => void; onDone: () => void }) {
  const group = useRef<THREE.Group>(null)
  const walk = useRef(0)
  const progress = useRef({ d: 0, back: false, finished: false })
  const [carrying, setCarrying] = useState(true)

  // Polyline with cumulative lengths, so a distance maps to a floor point.
  const path = useMemo(() => {
    const pts = spec.route.map(([x, z]) => new THREE.Vector3(x, 0.08, z))
    const cum = [0]
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
    return { pts, cum, len: Math.max(0.5, cum[cum.length - 1]) }
  }, [spec])

  const pointAt = (d: number, out: THREE.Vector3) => {
    const { pts, cum } = path
    let i = 1
    while (i < pts.length - 1 && cum[i] < d) i++
    const seg = cum[i] - cum[i - 1] || 1
    out.lerpVectors(pts[i - 1], pts[i], Math.min(1, Math.max(0, (d - cum[i - 1]) / seg)))
    return out
  }
  const ahead = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dt) => {
    const p = progress.current
    const g = group.current
    if (p.finished || !g) return
    p.d = Math.min(path.len, p.d + dt * COURIER_SPEED)
    const along = p.back ? path.len - p.d : p.d
    pointAt(along, g.position)
    pointAt(p.back ? Math.max(0, along - 0.3) : Math.min(path.len, along + 0.3), ahead)
    if (ahead.distanceToSquared(g.position) > 1e-6) g.lookAt(ahead.x, g.position.y, ahead.z)
    walk.current += dt * 9
    if (p.d < path.len) return
    if (!p.back) {
      p.back = true
      p.d = 0
      setCarrying(false)
      onArrive()
    } else {
      p.finished = true
      onDone()
    }
  })

  return (
    <group ref={group} position={path.pts[0]} scale={COURIER_SCALE}>
      <WalkingAvatar seed={spec.seed} walkRef={walk} carry={carrying ? spec.color : undefined} />
    </group>
  )
}

// ---------------------------------------------------------------- stations

function StationTag({ name, subtitle, state, color, detail, dim }: { name: string; subtitle: string; state: string; color: string; detail?: string; dim: boolean }) {
  const busy = state === 'ACTIVO' || state === 'ALERTA' || state === 'PENSANDO' || state === 'CONSULTADO'
  return (
    <div
      className="pointer-events-none select-none flex items-start gap-2 rounded-md border bg-bg-deep/85 px-2.5 py-1.5 backdrop-blur-sm whitespace-nowrap"
      style={{ borderColor: color, opacity: dim ? 0.65 : 1, boxShadow: busy ? `0 0 18px -4px ${color}` : undefined }}
    >
      <span className="mt-0.5 w-5 h-5 rounded grid place-items-center text-[10px] font-mono font-bold" style={{ background: `${color}33`, color }}>
        {name[0]}
      </span>
      <div className="flex flex-col">
        <span className="text-[12px] font-mono font-bold tracking-[0.08em]" style={{ color }}>
          {name}
        </span>
        <span className="text-[9.5px] font-mono text-ink-secondary">{subtitle}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-dim" style={state === 'ALERTA' ? { color } : undefined}>
          <span className={busy ? 'w-1.5 h-1.5 rounded-full animate-pulse' : 'w-1.5 h-1.5 rounded-full'} style={{ background: busy ? color : 'currentColor' }} />
          {state}
        </span>
        {detail && <span className="text-[8.5px] font-mono text-ink-dim max-w-[180px] whitespace-normal leading-snug mt-0.5">{detail}</span>}
      </div>
    </div>
  )
}

function Station({
  station,
  isSelected,
  onSelect,
  live,
  color: liveColor,
  theme,
  consulted,
}: {
  station: StationDef
  isSelected: boolean
  onSelect: () => void
  live: StationLive | null
  color: string
  theme: Theme
  consulted: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const r = station.radius * VISUAL_SCALE
  // `live` is only present for Phase-2-wired stations (see docs §11) — an
  // 'alert' there is a real recency/severity signal (e.g. HIGH-severity Order
  // Flow events, a GEX regime flip, Risk-Off VIX), never invented.
  const color = live?.state === 'alert' ? theme.bear : station.implemented ? liveColor : DORMANT_COLOR
  const activity = activityFor(station, live, consulted)
  const [x, z] = station.position
  // Workstation props are modeled in a radius-5 footprint.
  const k = r / 5
  const seed = useMemo(() => station.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0), [station.id])
  const glow = activity === 'busy' ? 0.42 : activity === 'idle' ? 0.14 : 0.04

  return (
    <group position={[x, 0, z]}>
      <HexPlatform
        radius={r}
        color={color}
        height={0.07}
        rimOpacity={station.implemented ? (isSelected || hovered ? 1 : 0.8) : 0.35}
        floorTint={activity === 'busy' ? 0.14 : isSelected || hovered ? 0.08 : 0.03}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      />
      <Glow color={color} size={r * 2.8} opacity={glow + (isSelected ? 0.1 : 0)} position={[0, 0.12, 0]} />
      <group position={[0, 0.07, 0]} scale={k}>
        <Workstation color={color} activity={activity} seed={seed} screenBg={theme.bgDeep} />
      </group>
      {activity === 'busy' && (
        <Plumbob color={live?.state === 'alert' ? theme.bear : theme.atlas} position={[0.9 * k, 0.07 + 3.3 * k, 2.3 * k]} scale={k * 1.2} />
      )}

      {/* Plain DOM label via drei's Html (billboards automatically) instead of
          drei's Text — troika-three-text needs a worker to lay out glyphs,
          which some sandboxed/CSP-restricted browsers block. */}
      <Html position={[0, r * 0.95 + 0.55, -0.2]} center distanceFactor={16} occlude={false} zIndexRange={[20, 0]}>
        <StationTag
          name={station.name}
          subtitle={station.subtitle}
          state={stateWord(station, live, consulted ? 'CONSULTADO' : undefined)}
          color={color}
          dim={!station.implemented}
          detail={consulted ? 'M.A.N.U. leyó estos datos' : live && (isSelected || hovered) ? live.detail : undefined}
        />
      </Html>
    </group>
  )
}

// ---------------------------------------------------------------- mando

function MandoCenter({
  station,
  live,
  isSelected,
  onSelect,
  theme,
  flashRef,
  thinking,
}: {
  station: StationDef
  live: StationLive | null
  isSelected: boolean
  onSelect: () => void
  theme: Theme
  flashRef: React.MutableRefObject<number>
  thinking: string | null
}) {
  const [hovered, setHovered] = useState(false)
  const r = station.radius * VISUAL_SCALE
  const activity = activityFor(station, live, thinking !== null)
  const rim = live?.state === 'alert' ? theme.bear : theme.pulse
  // Console props are modeled for a radius-7.2 platform.
  const k = r / 7.2
  const globe = useRef<THREE.Group>(null)
  const ringA = useRef<THREE.Mesh>(null)
  const ringB = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.Sprite>(null)
  const beam = useRef<THREE.Mesh>(null)
  const screenA = useScreenTexture(theme.pulse, 'line', theme.bgDeep)
  const screenB = useScreenTexture(theme.oracle, 'candles', theme.bgDeep)

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime()
    const busy = activity === 'busy'
    flashRef.current = Math.max(0, flashRef.current - dt * 1.6)
    const flash = flashRef.current
    if (globe.current) {
      globe.current.rotation.y += dt * (busy ? 0.6 : 0.2)
      globe.current.position.y = 8.2 + Math.sin(t * 1.2) * 0.2
    }
    if (ringA.current) ringA.current.rotation.z += dt * 0.6
    if (ringB.current) ringB.current.rotation.z -= dt * 0.4
    if (glow.current) {
      const m = glow.current.material as THREE.SpriteMaterial
      m.opacity = 0.35 + flash * 0.55 + (busy ? 0.15 : 0)
      const s = 15 + flash * 8
      glow.current.scale.set(s, s, 1)
    }
    if (beam.current) (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.06 + flash * 0.14 + (busy ? 0.05 : 0)
    if (busy) {
      screenA.offset.x += dt * 0.05
      screenB.offset.x += dt * 0.04
    }
  })

  return (
    <group position={[station.position[0], 0, station.position[1]]}>
      <HexPlatform
        radius={r}
        color={rim}
        height={0.1}
        rimOpacity={isSelected || hovered ? 1 : 0.85}
        floorTint={activity === 'busy' ? 0.1 : 0.04}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      />
      <Glow color={rim} size={r * 2.6} opacity={0.18} position={[0, 0.15, 0]} />
      <group position={[0, 0.1, 0]} scale={k}>
        <mesh position={[0, 1, 0]}>
          <cylinderGeometry args={[3.4, 3.4, 1, 24, 1, true]} />
          <meshStandardMaterial color="#111827" metalness={0.6} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const ang = (i / 8) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.sin(ang) * 3.5, 2.1, Math.cos(ang) * 3.5]} rotation={[0, ang, 0]}>
              <planeGeometry args={[1.4, 0.8]} />
              <meshBasicMaterial map={i % 2 ? screenB : screenA} color={activity === 'busy' ? '#d0dbf0' : '#6a7690'} side={THREE.DoubleSide} />
            </mesh>
          )
        })}
        {Array.from({ length: 4 }, (_, i) => {
          const ang = (i / 4) * Math.PI * 2 + Math.PI / 4
          return (
            <group key={i} position={[Math.sin(ang) * 2.5, 0.25, Math.cos(ang) * 2.5]} rotation={[0, ang + Math.PI, 0]}>
              <SeatedAvatar seed={40 + i} activity={activity} />
            </group>
          )
        })}
        <group ref={globe} position={[0, 8.2, 0]}>
          <mesh>
            <sphereGeometry args={[2.55, 32, 24]} />
            <meshBasicMaterial color={theme.oracle} transparent opacity={0.22} />
          </mesh>
          <mesh>
            <icosahedronGeometry args={[2.7, 3]} />
            <meshBasicMaterial color={theme.oracle} wireframe transparent opacity={0.5} />
          </mesh>
          <mesh ref={ringA} rotation={[Math.PI / 2.3, 0, 0]}>
            <torusGeometry args={[3.6, 0.05, 6, 64]} />
            <meshBasicMaterial color={theme.pulse} />
          </mesh>
          <mesh ref={ringB} rotation={[Math.PI / 1.8, 0.5, 0]}>
            <torusGeometry args={[4.2, 0.03, 6, 64]} />
            <meshBasicMaterial color={theme.oracle} transparent opacity={0.6} />
          </mesh>
          <sprite ref={glow} scale={[15, 15, 1]}>
            <spriteMaterial map={glowTexture()} color={theme.oracle} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
          </sprite>
        </group>
        <mesh ref={beam} position={[0, 4.2, 0]}>
          <cylinderGeometry args={[1.2, 3.2, 7, 32, 1, true]} />
          <meshBasicMaterial color={theme.oracle} transparent opacity={0.06} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {activity === 'busy' && <Plumbob color={live?.state === 'alert' ? theme.bear : theme.atlas} position={[0, 4.4, 0]} scale={1.3} />}
      </group>

      <Html position={[0, 12.6 * k, 0]} center distanceFactor={16} occlude={false} zIndexRange={[20, 0]}>
        <StationTag
          name={station.name}
          subtitle={station.subtitle}
          state={stateWord(station, live, thinking !== null ? 'PENSANDO' : undefined)}
          color={rim}
          dim={false}
          detail={thinking !== null ? `“${thinking.slice(0, 80)}”` : live && (isSelected || hovered) ? live.detail : undefined}
        />
      </Html>
    </group>
  )
}

// ---------------------------------------------------------------- decor

/**
 * Static room dressing so the floor reads as a place: a wall of chart
 * screens behind the pipeline row and server racks around the edge. None of
 * it moves or claims to show live data.
 */
function FloorDecor({ theme }: { theme: Theme }) {
  const colors = [theme.oracle, theme.atlas, theme.pulse, theme.nexus, theme.oracle, theme.atlas, theme.pulse]
  const racks = useMemo(() => {
    const out: { x: number; z: number; ry: number; strip: boolean }[] = []
    // Leave the arc facing the default camera open.
    const camAngle = Math.atan2(DEFAULT_CAMERA_POSITION[2], DEFAULT_CAMERA_POSITION[0])
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2
      if (Math.cos(a - camAngle) > 0.45) continue
      const r = 34 + (i % 3) * 0.8
      out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, ry: -a + Math.PI / 2, strip: i % 4 !== 0 })
    }
    return out
  }, [])

  return (
    <group>
      {colors.map((c, i) => (
        <WallScreen key={i} color={c} kind={i % 3 === 1 ? 'candles' : 'line'} x={-15 + i * 5} bg={theme.bgDeep} />
      ))}
      {racks.map((r, i) => (
        <group key={i} position={[r.x, 0, r.z]} rotation={[0, r.ry, 0]}>
          <mesh position={[0, 1.8, 0]}>
            <boxGeometry args={[1.2, 3.6, 1.2]} />
            <meshStandardMaterial color="#0b0f18" roughness={0.6} metalness={0.4} />
          </mesh>
          <mesh position={[0, 1.8, 0.62]}>
            <boxGeometry args={[0.06, 2.9, 0.02]} />
            <meshBasicMaterial color={r.strip ? theme.oracle : theme.atlas} transparent opacity={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function WallScreen({ color, kind, x, bg }: { color: string; kind: 'line' | 'candles'; x: number; bg: string }) {
  const tex = useScreenTexture(color, kind, bg)
  return (
    <group position={[x, 2.6, -31]}>
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[4.7, 2.8, 0.15]} />
        <meshStandardMaterial color="#0b0f18" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh>
        <planeGeometry args={[4.5, 2.6]} />
        <meshBasicMaterial map={tex} color="#7f8da8" />
      </mesh>
    </group>
  )
}
