'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'

/* ================================================================
   GEX CINEMATIC TERMINAL — Exposición Gamma Neta (demo)
   Sistema de diseño: paleta + tipografía + profundidad + motion
   implementados como tokens de código (inline styles) en vez de
   Tailwind, para reproducir fielmente el efecto "cinematic glass".
   Fuentes (IBM Plex Sans/Mono) se cargan globalmente en app/layout.tsx.
   ================================================================ */

const C = {
  void: '#030509',
  navy: '#060B14',
  panel: 'rgba(13,20,34,0.62)',
  panelDeep: 'rgba(8,13,24,0.78)',
  edge: 'rgba(120,200,255,0.16)',
  edgeStrong: 'rgba(120,200,255,0.34)',
  text: '#EAF2FA',
  sub: '#7E8CA3',
  mute: '#4A5570',
  cyan: '#3DD9EB',
  emerald: '#2EE8A5',
  amber: '#F5B93D',
  red: '#F45B6C',
}

/* sistema de profundidad: 5 capas, cada una con su Z, su ritmo de
   flotación y su retraso de entrada (boot secuencial) */
const ELEV = {
  hero: { z: 46, float: 'cx-float-b', delay: '0ms' },
  gauge: { z: 30, float: 'cx-float-a', delay: '90ms' },
  metrics: { z: 22, float: 'cx-float-a', delay: '170ms' },
  profile: { z: 14, float: 'cx-float-b', delay: '250ms' },
  wall: { z: 8, float: 'cx-float-a', delay: '330ms' },
}

/* sistema de sombra/glow: una receta, cuatro capas, reusada en todo panel */
function glassShadow(accent: string) {
  return `0 1px 0 0 rgba(255,255,255,0.08) inset, 0 -18px 40px -30px ${accent}30 inset, 0 34px 60px -26px rgba(0,0,0,0.9), 0 0 44px -18px ${accent}26`
}

const STYLES = `
* { box-sizing: border-box; }
.cx-root { font-family: 'IBM Plex Sans', sans-serif; }
.cx-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }

@keyframes cxNebula { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(40px,-30px) scale(1.08); } 66% { transform: translate(-30px,25px) scale(0.96); } }
.cx-nebula { position:absolute; border-radius:50%; filter: blur(110px); pointer-events:none; mix-blend-mode: screen; }
@keyframes cxBreathe { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }

@keyframes cxFloatA { 0%,100% { transform: translateY(0) translateZ(var(--z,0px)); } 50% { transform: translateY(-7px) translateZ(var(--z,0px)); } }
@keyframes cxFloatB { 0%,100% { transform: translateY(0) translateZ(var(--z,0px)); } 50% { transform: translateY(-11px) translateZ(var(--z,0px)); } }
.cx-float-a { animation: cxFloatA 8.5s ease-in-out infinite; }
.cx-float-b { animation: cxFloatB 6.5s ease-in-out infinite; }

@keyframes cxEnter { from { opacity:0; transform: translateY(18px) scale(0.97); } to { opacity:1; transform: translateY(0) scale(1); } }
.cx-enter { animation: cxEnter 700ms cubic-bezier(.16,1,.3,1) both; }

@keyframes cxRise { 0% { transform: translateY(0); opacity: 0; } 12% { opacity: var(--op, 0.5); } 88% { opacity: var(--op, 0.5); } 100% { transform: translateY(-110vh); opacity: 0; } }
.cx-particle { position:absolute; bottom:-4vh; border-radius:50%; pointer-events:none; animation: cxRise linear infinite; }

@keyframes cxHeroPulse { 0%,100% { text-shadow: 0 0 26px var(--glow), 0 0 70px var(--glow-soft); } 50% { text-shadow: 0 0 40px var(--glow), 0 0 110px var(--glow-soft); } }
.cx-hero { animation: cxHeroPulse 3.6s ease-in-out infinite; }
@keyframes cxCorePulse { 0%,100% { opacity:0.45; transform: translateY(-50%) scale(1); } 50% { opacity:0.95; transform: translateY(-50%) scale(1.16); } }

@keyframes cxWaveFlow { to { stroke-dashoffset: -130; } }
.cx-wave { stroke-dasharray: 8 6; animation: cxWaveFlow 2.2s linear infinite; }

@keyframes cxSweep { 0% { transform: translateY(-16vh); opacity:0; } 8% { opacity:1; } 92% { opacity:1; } 100% { transform: translateY(116vh); opacity:0; } }
.cx-sweep { position:absolute; left:0; right:0; height:16vh; pointer-events:none; background: linear-gradient(180deg, transparent, rgba(61,217,235,0.05), transparent); animation: cxSweep 12s linear infinite; }

@keyframes cxDot { 0%,100% { opacity:1; box-shadow: 0 0 10px 2px currentColor; } 50% { opacity:0.3; box-shadow: 0 0 4px 0 currentColor; } }
.cx-dot { animation: cxDot 2.2s ease-in-out infinite; }
@keyframes cxNeedle { 0%,100% { filter: drop-shadow(0 0 4px rgba(234,242,250,0.7)); } 50% { filter: drop-shadow(0 0 9px rgba(234,242,250,1)); } }
.cx-needle { animation: cxNeedle 3s ease-in-out infinite; }

.cx-btn:focus-visible { outline: 2px solid #3DD9EB; outline-offset: 2px; }
.cx-magnet { transition: transform 200ms cubic-bezier(.2,.8,.2,1); }

@media (prefers-reduced-motion: reduce) {
  .cx-nebula, .cx-float-a, .cx-float-b, .cx-particle, .cx-hero, .cx-sweep, .cx-dot, .cx-needle, .cx-wave, .cx-enter { animation: none !important; }
  .cx-magnet { transition: none !important; }
}
`

const SYMBOLS = [
  { key: 'NQ', base: 21480, step: 9, decimals: 0 },
  { key: 'ES', base: 6210, step: 2.2, decimals: 1 },
  { key: 'SPX', base: 6208, step: 2.1, decimals: 1 },
  { key: 'QQQ', base: 556, step: 0.2, decimals: 2 },
]

function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)) }
function round(value: number, config: { step: number; decimals: number }) { return Number((Math.round(value / config.step) * config.step).toFixed(config.decimals)) }
function polar(cx: number, cy: number, r: number, deg: number) { const rad = (deg * Math.PI) / 180; return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) } }
function arc(cx: number, cy: number, r: number, a1: number, a2: number) {
  const s = polar(cx, cy, r, a1); const e = polar(cx, cy, r, a2)
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

/* ---------- motor de datos simulados ----------
   IMPORTANTE: esto es una demo con datos aleatorios, no un feed real de
   opciones (CBOE/OPRA). El badge "DEMO · DATOS SIMULADOS" es intencional
   y no debe quitarse hasta conectar un proveedor real de cadenas de opciones. */
function initState(config: { base: number; step: number; decimals: number }) {
  const spot = config.base
  return {
    spot,
    callWall: round(spot + config.step * 22, config),
    putWall: round(spot - config.step * 26, config),
    zeroGamma: round(spot - config.step * 4, config),
    netGex: -2.18,
    callPct: 48,
  }
}
function stepState(prev: ReturnType<typeof initState>, config: { base: number; step: number; decimals: number }) {
  const spot = Number((prev.spot + (Math.random() - 0.5) * config.step * 1.6).toFixed(config.decimals))
  const dist = (spot - prev.zeroGamma) / config.step
  const netGex = clamp(dist * 0.1 + (Math.random() - 0.5) * 0.3, -7, 7)
  const callPct = clamp(prev.callPct + (Math.random() - 0.5) * 1.5, 30, 70)
  return { ...prev, spot, netGex, callPct }
}
function useSimulatedGex(symbolKey: string) {
  const config = SYMBOLS.find((s) => s.key === symbolKey)!
  const [state, setState] = useState(() => initState(config))
  useEffect(() => {
    setState(initState(config))
    const id = setInterval(() => setState((p) => stepState(p, config)), 1600)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolKey])
  return state
}

/* ---------- números líquidos: interpola cualquier valor hacia su objetivo cada frame ---------- */
function useLerp(target: number, speed = 0.12) {
  const [display, setDisplay] = useState(target)
  const rafRef = useRef<number | null>(null)
  useEffect(() => {
    function step() {
      setDisplay((prev) => {
        const diff = target - prev
        if (Math.abs(diff) < 0.0008) { rafRef.current = null; return target }
        rafRef.current = requestAnimationFrame(step)
        return prev + diff * speed
      })
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, speed])
  return display
}

/* ---------- parallax de escena al mouse ---------- */
function useSceneParallax() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const raf = useRef<number | null>(null)
  const onMove = useCallback((e: React.MouseEvent) => {
    if (raf.current) return
    raf.current = requestAnimationFrame(() => {
      setMouse({ x: (e.clientX / window.innerWidth - 0.5) * 2, y: (e.clientY / window.innerHeight - 0.5) * 2 })
      raf.current = null
    })
  }, [])
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current) }, [])
  return { mouse, onMove }
}

/* ---------- hover magnético: el elemento se desplaza levemente hacia el cursor ---------- */
function useMagnetic(strength = 12) {
  const ref = useRef<HTMLButtonElement>(null)
  const [style, setStyle] = useState({ transform: 'translate(0px,0px)' })
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return
    const rect = el.getBoundingClientRect()
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
    setStyle({ transform: `translate(${(dx * strength).toFixed(1)}px, ${(dy * strength).toFixed(1)}px)` })
  }
  const onLeave = () => setStyle({ transform: 'translate(0px,0px)' })
  return { ref, style, onMove, onLeave }
}

function ChevronDownIcon({ size = 14, color = C.sub }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

/* ---------- campo de partículas (generado una vez) ---------- */
function ParticleField() {
  const particles = useMemo(() => {
    const arr = []
    for (let i = 0; i < 34; i++) {
      const depth = Math.random()
      arr.push({
        left: Math.random() * 100,
        size: 1.5 + depth * 7,
        blur: depth > 0.75 ? 4 + depth * 5 : depth < 0.2 ? 1.5 : 0,
        opacity: 0.12 + depth * 0.35,
        duration: 26 - depth * 14,
        delay: -Math.random() * 26,
        color: Math.random() > 0.6 ? C.cyan : Math.random() > 0.5 ? C.emerald : '#9BB8D8',
      })
    }
    return arr
  }, [])
  return (
    <>
      {particles.map((p, i) => (
        <span key={i} className="cx-particle" style={{
          left: `${p.left}%`, width: p.size, height: p.size, background: p.color,
          filter: p.blur ? `blur(${p.blur}px)` : 'none', ['--op' as any]: p.opacity,
          animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`,
          boxShadow: `0 0 ${p.size * 2.5}px 0 ${p.color}`,
        } as React.CSSProperties} />
      ))}
    </>
  )
}

/* ---------- glass panel: primitiva única del sistema, con boot escalonado y flotación propia ---------- */
function GlassCard({ children, elevKey, accent = C.cyan, outerStyle = {}, innerStyle = {} }: {
  children: React.ReactNode
  elevKey: keyof typeof ELEV
  accent?: string
  outerStyle?: React.CSSProperties
  innerStyle?: React.CSSProperties
}) {
  const e = ELEV[elevKey]
  return (
    <div className="cx-enter" style={{ animationDelay: e.delay, ...outerStyle }}>
      <div className={e.float} style={{
        ['--z' as any]: `${e.z}px`, width: '100%', height: '100%',
        background: `linear-gradient(155deg, ${C.panel}, ${C.panelDeep})`,
        backdropFilter: 'blur(22px) saturate(1.3)', WebkitBackdropFilter: 'blur(22px) saturate(1.3)',
        border: `1px solid ${C.edge}`, borderTop: `1px solid rgba(255,255,255,0.14)`,
        borderRadius: 16, boxShadow: glassShadow(accent), transformStyle: 'preserve-3d',
        ...innerStyle,
      } as React.CSSProperties}>
        {children}
      </div>
    </div>
  )
}

function Metric({ label, value, sub, color = C.text }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ padding: '14px 17px', minWidth: 128, flex: 1 }}>
      <div style={{ fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 7, fontWeight: 500 }}>{label}</div>
      <div className="cx-mono" style={{ fontSize: 20, fontWeight: 600, color, lineHeight: 1.05, textShadow: `0 0 20px ${color}50` }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: C.mute, marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

/* ---------- onda de gamma viva: línea de energía fluyendo, decorativa ---------- */
function GammaWave({ color }: { color: string }) {
  const d = useMemo(() => {
    const w = 300, mid = 20
    let path = `M 0 ${mid}`
    for (let x = 0; x <= w; x += 6) {
      const y = mid + Math.sin(x / 22) * 9 + Math.sin(x / 9) * 2.5
      path += ` L ${x} ${y.toFixed(1)}`
    }
    return path
  }, [])
  return (
    <svg width="100%" height="40" viewBox="0 0 300 40" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="cxWaveFade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="50%" stopColor={color} stopOpacity="0.85" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={d} fill="none" stroke="url(#cxWaveFade)" strokeWidth="1.6" className="cx-wave" style={{ filter: `drop-shadow(0 0 5px ${color}90)` }} />
    </svg>
  )
}

/* ---------- gauge circular de sentimiento ---------- */
function SentimentGauge({ value }: { value: number }) {
  const cx = 105, cy = 100, r = 74, w = 13
  const needleA = 90 - clamp(value, -1, 1) * 90
  const nEnd = polar(cx, cy, r - w / 2 - 9, needleA)
  const label = value <= -0.33 ? 'BAJISTA' : value >= 0.33 ? 'ALCISTA' : 'NEUTRAL'
  const lc = value <= -0.33 ? C.red : value >= 0.33 ? C.emerald : C.amber
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 20px 12px' }}>
      <svg width="210" height="112" viewBox="0 0 210 112" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="cxSeg1" x1="0" y1="1" x2="0.6" y2="0"><stop offset="0%" stopColor={C.red} /><stop offset="100%" stopColor={C.amber} /></linearGradient>
          <linearGradient id="cxSeg2" x1="0.4" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={C.amber} /><stop offset="100%" stopColor={C.emerald} /></linearGradient>
          <radialGradient id="cxGlass" cx="42%" cy="30%" r="55%"><stop offset="0%" stopColor="#fff" stopOpacity="0.20" /><stop offset="100%" stopColor="#fff" stopOpacity="0" /></radialGradient>
        </defs>
        <ellipse cx={cx} cy={cy - 18} rx="92" ry="52" fill={lc} opacity="0.09" style={{ filter: 'blur(16px)' }} />
        <path d={arc(cx, cy, r, 180, 92)} fill="none" stroke="url(#cxSeg1)" strokeWidth={w} strokeLinecap="round" opacity="0.95" />
        <path d={arc(cx, cy, r, 88, 0)} fill="none" stroke="url(#cxSeg2)" strokeWidth={w} strokeLinecap="round" opacity="0.95" />
        <path d={arc(cx, cy, r + 11, 180, 0)} fill="none" stroke="rgba(160,190,230,0.14)" strokeWidth="1" />
        {[-1, -0.5, 0, 0.5, 1].map((t, i) => {
          const a = 90 - t * 90; const o = polar(cx, cy, r + 14, a); const n = polar(cx, cy, r + 8, a)
          return <line key={i} x1={n.x} y1={n.y} x2={o.x} y2={o.y} stroke={C.mute} strokeWidth={t === 0 ? 1.6 : 1} opacity="0.7" />
        })}
        <ellipse cx={cx - 22} cy={cy - 36} rx="50" ry="24" fill="url(#cxGlass)" transform={`rotate(-16 ${cx - 22} ${cy - 36})`} />
        <line className="cx-needle" x1={cx} y1={cy} x2={nEnd.x} y2={nEnd.y} stroke={C.text} strokeWidth="2.6" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="6.5" fill="#0B1220" stroke={C.text} strokeWidth="1.6" />
        <circle cx={cx} cy={cy} r="2.2" fill={lc} />
      </svg>
      <div className="cx-mono" style={{ marginTop: -4, fontSize: 17, fontWeight: 700, letterSpacing: 1.6, color: lc, textShadow: `0 0 24px ${lc}80` }}>{label}</div>
      <div className="cx-mono" style={{ fontSize: 11.5, color: C.sub }}>{value >= 0 ? '+' : ''}{value.toFixed(2)}</div>
    </div>
  )
}

/* ---------- perfil de gamma horizontal (datos crudos: estabilidad de lectura sobre fluidez) ---------- */
function GammaProfile({ state, config }: { state: ReturnType<typeof initState>; config: { base: number; step: number; decimals: number } }) {
  const rows = useMemo(() => {
    const arr = []
    for (let i = 6; i >= -6; i--) {
      const strike = round(state.spot + i * config.step * 3, config)
      const dc = Math.abs(strike - state.callWall); const dp = Math.abs(strike - state.putWall)
      arr.push({ strike, call: clamp(1 - dc / (config.step * 10), 0, 1), put: clamp(1 - dp / (config.step * 10), 0, 1), isSpot: i === 0 })
    }
    return arr
  }, [state.spot, state.callWall, state.putWall, config])

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: C.mute, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
        <span style={{ color: C.red }}>Put gamma</span><span>Strike</span><span style={{ color: C.emerald }}>Call gamma</span>
      </div>
      <div className="cx-mono">
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 74px 1fr', alignItems: 'center', height: 23 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 5 }}>
              <div style={{ height: 8, width: `${r.put * 100}%`, borderRadius: '4px 0 0 4px', background: `linear-gradient(90deg, ${C.red}30, ${C.red})`, boxShadow: r.put > 0.35 ? `0 0 14px 0 ${C.red}80, 0 0 3px 0 ${C.red}` : 'none' }} />
            </div>
            <div style={{
              textAlign: 'center', fontSize: 11, letterSpacing: 0.3, color: r.isSpot ? C.text : C.sub, fontWeight: r.isSpot ? 700 : 400,
              background: r.isSpot ? `linear-gradient(180deg, ${C.cyan}2E, ${C.cyan}10)` : 'transparent',
              boxShadow: r.isSpot ? `0 0 0 1px ${C.cyan}60, 0 0 18px 0 ${C.cyan}45` : 'none',
              borderRadius: 5, padding: '2px 0', textShadow: r.isSpot ? `0 0 12px ${C.cyan}90` : 'none',
            }}>{r.strike.toLocaleString('en-US')}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: 5 }}>
              <div style={{ height: 8, width: `${r.call * 100}%`, borderRadius: '0 4px 4px 0', background: `linear-gradient(90deg, ${C.emerald}, ${C.emerald}30)`, boxShadow: r.call > 0.35 ? `0 0 14px 0 ${C.emerald}80, 0 0 3px 0 ${C.emerald}` : 'none' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- muro de liquidez inferior, con reflejo ---------- */
function LiquidityWall({ state, config }: { state: ReturnType<typeof initState>; config: { base: number; step: number; decimals: number } }) {
  const bars = useMemo(() => {
    const arr = []; const n = 42
    for (let i = 0; i < n; i++) {
      const strike = state.putWall - config.step * 6 + ((state.callWall - state.putWall + config.step * 12) / n) * i
      const dc = Math.abs(strike - state.callWall) / (config.step * 7)
      const dp = Math.abs(strike - state.putWall) / (config.step * 7)
      const dz = Math.abs(strike - state.zeroGamma) / (config.step * 9)
      const h = clamp(Math.max(1 - dc, 1 - dp) * 0.9 + Math.max(0, 0.4 - dz), 0.04, 1)
      arr.push({ h, isCall: strike > state.zeroGamma, nearSpot: Math.abs(strike - state.spot) < config.step * 1.6 })
    }
    return arr
  }, [state.putWall, state.callWall, state.zeroGamma, state.spot, config])

  return (
    <div style={{ padding: '14px 20px 18px' }}>
      <div style={{ fontSize: 9.5, color: C.mute, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
        <span>Muro de gamma / liquidez</span>
        <span className="cx-mono" style={{ color: C.sub }}>PUT {state.putWall.toLocaleString('en-US')} · ZG {state.zeroGamma.toLocaleString('en-US')} · CALL {state.callWall.toLocaleString('en-US')}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 64 }}>
        {bars.map((b, i) => {
          const col = b.nearSpot ? C.cyan : b.isCall ? C.emerald : C.red
          return <div key={i} style={{ flex: 1, height: `${b.h * 100}%`, borderRadius: '3px 3px 0 0', background: `linear-gradient(180deg, ${col}, ${col}20)`, boxShadow: b.h > 0.55 ? `0 0 12px 0 ${col}70` : 'none', transition: 'height 900ms cubic-bezier(.3,.9,.3,1)' }} />
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 3, height: 20, marginTop: 2, transform: 'scaleY(-1)', opacity: 0.16, maskImage: 'linear-gradient(180deg, black, transparent 85%)', WebkitMaskImage: 'linear-gradient(180deg, black, transparent 85%)' }}>
        {bars.map((b, i) => {
          const col = b.nearSpot ? C.cyan : b.isCall ? C.emerald : C.red
          return <div key={i} style={{ flex: 1, height: `${b.h * 100}%`, background: `linear-gradient(180deg, ${col}, transparent)`, borderRadius: '3px 3px 0 0' }} />
        })}
      </div>
    </div>
  )
}

/* ================================================================ */
export default function GexPage() {
  const [symbolKey, setSymbolKey] = useState('NQ')
  const [open, setOpen] = useState(false)
  const config = SYMBOLS.find((s) => s.key === symbolKey)!
  const state = useSimulatedGex(symbolKey)
  const { mouse, onMove } = useSceneParallax()
  const magnet = useMagnetic(10)

  /* liquid transitions: solo en los números "de un vistazo".
     el perfil y el muro se quedan con el dato crudo — ahí la
     estabilidad de lectura importa más que el flujo. */
  const lerpedSpot = useLerp(state.spot)
  const lerpedNetGex = useLerp(state.netGex)
  const lerpedCallPct = useLerp(state.callPct)

  const distToZero = Number((lerpedSpot - state.zeroGamma).toFixed(config.decimals))
  const regime = lerpedNetGex >= 0 ? 'GAMMA LARGA' : 'GAMMA CORTA'
  const regimeColor = lerpedNetGex >= 0 ? C.emerald : C.red
  const heroColor = lerpedNetGex >= 0 ? C.emerald : C.cyan

  const sceneTransform = `perspective(1600px) rotateX(${(11 + mouse.y * -2.5).toFixed(2)}deg) rotateY(${(mouse.x * 3).toFixed(2)}deg)`

  return (
    <div className="cx-root" onMouseMove={onMove} style={{
      position: 'relative', minHeight: 'calc(100vh - 120px)', overflow: 'hidden', borderRadius: 24,
      background: `radial-gradient(ellipse 120% 90% at 50% -10%, #0A1426 0%, ${C.navy} 40%, ${C.void} 100%)`,
      color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px 60px',
    }}>
      <style>{STYLES}</style>

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div className="cx-nebula" style={{ width: 640, height: 640, top: '-22%', left: '8%', background: `radial-gradient(circle, ${C.cyan} 0%, transparent 65%)`, opacity: 0.13, animation: 'cxNebula 28s ease-in-out infinite' }} />
        <div className="cx-nebula" style={{ width: 720, height: 720, bottom: '-30%', right: '2%', background: `radial-gradient(circle, ${C.emerald} 0%, transparent 65%)`, opacity: 0.10, animation: 'cxNebula 34s ease-in-out infinite reverse' }} />
        <div className="cx-nebula" style={{ width: 480, height: 480, top: '30%', right: '30%', background: `radial-gradient(circle, #4A6BD8 0%, transparent 65%)`, opacity: 0.09, animation: 'cxNebula 40s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', left: '-10%', right: '-10%', bottom: '-6%', height: '34%', background: `linear-gradient(180deg, transparent, rgba(61,217,235,0.05) 45%, rgba(6,11,20,0.9))`, filter: 'blur(28px)', animation: 'cxBreathe 9s ease-in-out infinite' }} />
        <div style={{
          position: 'absolute', left: '-20%', right: '-20%', bottom: '-14%', height: '48%',
          backgroundImage: `linear-gradient(rgba(61,217,235,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(61,217,235,0.10) 1px, transparent 1px)`,
          backgroundSize: '54px 54px', transform: 'perspective(700px) rotateX(62deg)', transformOrigin: '50% 100%',
          maskImage: 'linear-gradient(180deg, transparent, black 35%, black 75%, transparent)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent, black 35%, black 75%, transparent)', opacity: 0.7,
        }} />
        <ParticleField />
        <div className="cx-sweep" />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 85% 70% at 50% 45%, transparent 55%, rgba(2,4,8,0.75) 100%)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 940, transform: sceneTransform, transformStyle: 'preserve-3d', transition: 'transform 400ms cubic-bezier(.2,.8,.2,1)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ position: 'relative' }}>
              <button
                ref={magnet.ref} onMouseMove={magnet.onMove} onMouseLeave={magnet.onLeave}
                className="cx-btn cx-mono cx-magnet" onClick={() => setOpen((o) => !o)}
                style={{
                  ...magnet.style,
                  display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px',
                  background: C.panelDeep, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                  border: `1px solid ${C.edgeStrong}`, borderRadius: 10, color: C.text, cursor: 'pointer',
                  fontWeight: 600, fontSize: 14, letterSpacing: 0.5,
                  boxShadow: `0 0 24px -8px ${C.cyan}50, 0 10px 24px -14px rgba(0,0,0,0.8)`,
                } as React.CSSProperties}>
                {symbolKey} <ChevronDownIcon size={14} color={C.sub} />
              </button>
              {open && (
                <div style={{ position: 'absolute', top: 44, left: 0, zIndex: 30, width: 92, padding: 5, background: 'rgba(10,16,28,0.95)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${C.edgeStrong}`, borderRadius: 10, boxShadow: '0 24px 50px -12px rgba(0,0,0,0.85)' }}>
                  {SYMBOLS.map((s) => (
                    <div key={s.key} className="cx-mono" onClick={() => { setSymbolKey(s.key); setOpen(false) }} style={{ padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, background: s.key === symbolKey ? 'rgba(61,217,235,0.12)' : 'transparent', color: s.key === symbolKey ? C.cyan : C.text }}>{s.key}</div>
                  ))}
                </div>
              )}
            </div>
            <span className="cx-mono" style={{ fontSize: 24, fontWeight: 500, letterSpacing: 0.5, textShadow: `0 0 26px ${C.cyan}45` }}>
              {lerpedSpot.toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals })}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 22, background: 'rgba(245,185,61,0.10)', border: `1px solid rgba(245,185,61,0.35)`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <span className="cx-dot" style={{ width: 6, height: 6, borderRadius: 3, background: C.amber, color: C.amber, display: 'inline-block' }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: C.amber, letterSpacing: 0.8 }}>DEMO · DATOS SIMULADOS</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 18, marginBottom: 18, flexWrap: 'wrap' }}>
          <GlassCard elevKey="hero" accent={heroColor} outerStyle={{ flex: '1.5 1 340px' }} innerStyle={{ padding: '26px 30px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: '4%', top: '38%', width: 190, height: 190, transform: 'translateY(-50%)', borderRadius: '50%', background: `radial-gradient(circle, ${heroColor}45, transparent 70%)`, filter: 'blur(32px)', pointerEvents: 'none', animation: 'cxCorePulse 3.6s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', left: 0, top: '12%', bottom: '12%', width: 2.5, background: `linear-gradient(180deg, transparent, ${heroColor}, transparent)`, boxShadow: `1.5px 0 0 0 ${C.red}30, -1.5px 0 0 0 ${C.cyan}30, 0 0 18px 1px ${heroColor}80` }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 10.5, color: C.sub, textTransform: 'uppercase', letterSpacing: 1.6, marginBottom: 8, fontWeight: 500 }}>Exposición Gamma Neta · {symbolKey}</div>
              <div className="cx-mono cx-hero" style={{ fontSize: 62, fontWeight: 700, lineHeight: 1, color: heroColor, ['--glow' as any]: `${heroColor}70`, ['--glow-soft' as any]: `${heroColor}30` } as React.CSSProperties}>
                {lerpedNetGex >= 0 ? '+' : '−'}{Math.abs(lerpedNetGex).toFixed(2)}<span style={{ fontSize: 30, fontWeight: 500, marginLeft: 6, color: C.sub }}>B</span>
              </div>
              <div style={{ display: 'flex', gap: 20, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="cx-mono" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.4, color: regimeColor, textShadow: `0 0 18px ${regimeColor}70` }}>{regime}</span>
                <span style={{ fontSize: 11.5, color: C.mute }}>{lerpedNetGex >= 0 ? 'Los dealers amortiguan el movimiento' : 'Los dealers amplifican el movimiento'}</span>
              </div>
            </div>
            <div style={{ position: 'relative', marginTop: 18, opacity: 0.8 }}>
              <GammaWave color={heroColor} />
            </div>
          </GlassCard>

          <GlassCard elevKey="gauge" accent={C.amber} outerStyle={{ flex: '0 1 260px' }}>
            <SentimentGauge value={clamp(lerpedNetGex / 6, -1, 1)} />
          </GlassCard>
        </div>

        <GlassCard elevKey="metrics" accent={C.cyan} outerStyle={{ marginBottom: 18 }} innerStyle={{ display: 'flex', flexWrap: 'wrap' }}>
          <Metric label="Call / Put" value={`${Math.round(lerpedCallPct)}·${Math.round(100 - lerpedCallPct)}`} sub="ratio de flujo" color={C.text} />
          <div style={{ width: 1, background: C.edge, margin: '14px 0' }} />
          <Metric label="Dist. Zero Gamma" value={`${distToZero >= 0 ? '+' : ''}${distToZero}`} sub="puntos" color={distToZero >= 0 ? C.emerald : C.red} />
          <div style={{ width: 1, background: C.edge, margin: '14px 0' }} />
          <Metric label="Call Wall" value={state.callWall.toLocaleString('en-US')} sub="resistencia gamma" color={C.emerald} />
          <div style={{ width: 1, background: C.edge, margin: '14px 0' }} />
          <Metric label="Put Wall" value={state.putWall.toLocaleString('en-US')} sub="soporte gamma" color={C.red} />
        </GlassCard>

        <GlassCard elevKey="profile" accent={C.emerald} outerStyle={{ marginBottom: 18 }}>
          <GammaProfile state={state} config={config} />
        </GlassCard>

        <GlassCard elevKey="wall" accent={C.cyan}>
          <LiquidityWall state={state} config={config} />
        </GlassCard>
      </div>
    </div>
  )
}
