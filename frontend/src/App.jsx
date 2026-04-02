import { useState, useEffect, useRef, useCallback } from 'react'
import RuleSelector from './components/RuleSelector'
import AutomataCanvas from './components/AutomataCanvas'
import Canvas3D from './components/Canvas3D'
import EpidemicView from './components/EpidemicView'
import Controls from './components/Controls'
import Timeline from './components/Timeline'
import { fetchRules, computeAutomata } from './api'

const ACCENT = {
  elementary:   '#00d4ff',
  game_of_life: '#00ff88',
  brians_brain: '#ff6b6b',
  cyclic:       '#ffaa00',
  langtons_ant: '#ff6644',
  custom_2d:    '#cc44ff',
  bacteria:     '#44ff88',
  traffic:      '#4488ff',
  image_ca:     '#ff88cc',
  life_3d:      '#aa66ff',
  epidemic:     '#ff4466',
}

const DEFAULT_CONFIG = {
  automata_type: 'elementary',
  rule: 110,
  width: 160,
  height: 80,
  generations: 160,
  initial_state: 'single_cell',
  density: 0.3,
  num_states: 8,
  threshold: 1,
  neighborhood: 'moore',
  num_ants: 1,
  bs_rule: 'B3/S23',
  // bacteria
  num_strains: 3,
  spread_rate: 0.55,
  death_rate: 0.08,
  nutrient_density: 0.15,
  // traffic
  num_lanes: 4,
  car_density: 0.25,
  max_speed: 3,
  brake_prob: 0.15,
  light_period: 12,
  // image_ca
  palette_name: 'cosmic',
  image_rule: 'cyclic',
  seed_type: 'random',
  // life_3d
  grid_size: 18,
  rule_3d: '445',
  // epidemic
  forecast_weeks: 52,
}

// ─── Animated starfield background ────────────────────────────────────────────
function Starfield() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    const stars = Array.from({ length: 150 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.4 + 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.004 + 0.001,
      hue: Math.random() * 60 + 180,
    }))
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const frame = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      stars.forEach((s) => {
        const a = 0.25 + 0.45 * Math.abs(Math.sin(s.phase + t * s.speed * 0.001))
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${s.hue},80%,85%,${a})`
        ctx.fill()
      })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} className="starfield" />
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [config, setConfig]         = useState(DEFAULT_CONFIG)
  const [data, setData]             = useState(null)
  const [currentGen, setCurrentGen] = useState(0)
  const [isPlaying, setIsPlaying]   = useState(false)
  const [looping, setLooping]       = useState(false)
  const [speed, setSpeed]           = useState(10)
  const [isLoading, setIsLoading]   = useState(false)
  const [error, setError]           = useState(null)
  const [rulesData, setRulesData]   = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isStale, setIsStale]       = useState(false)
  const [view3D, setView3D]         = useState(false)

  // Refs for RAF loop
  const rafRef        = useRef(null)
  const lastTimeRef   = useRef(0)
  const isPlayingRef  = useRef(false)
  const speedRef      = useRef(speed)
  const dataRef       = useRef(null)
  const loopingRef    = useRef(looping)

  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { speedRef.current = speed }, [speed])
  useEffect(() => { dataRef.current = data }, [data])
  useEffect(() => { loopingRef.current = looping }, [looping])

  useEffect(() => { fetchRules().then(setRulesData).catch(() => {}) }, [])

  // Mark stale when config changes (but NOT speed/loop — those aren't compute params)
  const handleConfigChange = useCallback((patch) => {
    setConfig((prev) => ({ ...prev, ...patch }))
    const computeKeys = new Set([
      'automata_type','rule','width','height','generations','initial_state',
      'density','num_states','threshold','neighborhood','num_ants','bs_rule',
      'num_strains','spread_rate','death_rate','nutrient_density',
      'num_lanes','car_density','max_speed','brake_prob','light_period',
      'palette_name','image_rule','seed_type',
      'grid_size','rule_3d','forecast_weeks',
    ])
    if (Object.keys(patch).some((k) => computeKeys.has(k))) {
      setIsStale(true)
    }
  }, [])

  const runCompute = async (cfg) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setIsPlaying(false)
    isPlayingRef.current = false
    setIsLoading(true)
    setError(null)
    setIsStale(false)
    try {
      const result = await computeAutomata(cfg)
      setData(result)
      setCurrentGen(0)
    } catch (e) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCompute  = () => runCompute(config)
  const handleRefresh  = () => { if (data) runCompute(config) }
  const handleStop     = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setIsPlaying(false)
    isPlayingRef.current = false
    setCurrentGen(0)
  }

  // RAF-based playback loop
  const animate = useCallback((timestamp) => {
    if (!isPlayingRef.current) return
    const interval = 1000 / speedRef.current
    if (timestamp - lastTimeRef.current >= interval) {
      lastTimeRef.current = timestamp
      const d = dataRef.current
      if (!d) return
      const total = d.total_generations
      setCurrentGen((prev) => {
        if (prev >= total - 1) {
          if (loopingRef.current) return 0
          setIsPlaying(false)
          isPlayingRef.current = false
          return prev
        }
        return prev + 1
      })
    }
    rafRef.current = requestAnimationFrame(animate)
  }, [])

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = 0
      rafRef.current = requestAnimationFrame(animate)
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isPlaying, animate])

  const accent = ACCENT[config.automata_type] || '#00d4ff'
  const totalGenerations = data?.total_generations ?? 1

  const ruleLabel = data
    ? data.automata_type === 'elementary'
      ? `Rule ${data.rule}`
      : data.rule
        ? String(data.rule)
        : data.automata_type.replace(/_/g, ' ')
    : null

  return (
    <div className="app">
      <Starfield />

      {/* ── Header ── */}
      <header className="app-header">
        <button className="sidebar-toggle" onClick={() => setSidebarOpen((v) => !v)} title="Toggle sidebar">
          <span /><span /><span />
        </button>

        <div className="logo">
          <span className="logo-hex" style={{ color: accent }}>⬡</span>
          <h1>Cellular Automata <span className="logo-sub">Explorer</span></h1>
        </div>

        <div className="header-badges">
          {data && !isStale && (
            <>
              <span className="badge" style={{ borderColor: accent, color: accent }}>{ruleLabel}</span>
              {data.automata_type === 'life_3d' ? (
                <span className="badge badge-dim">{data.grid_size}³ grid</span>
              ) : data.automata_type === 'epidemic' ? (
                <>
                  <span className="badge badge-dim">{Object.keys(data.countries_meta ?? {}).length} countries</span>
                  <span className="badge badge-dim">
                    {data.forecast_weeks > 0 ? `${data.forecast_weeks} forecast weeks` : 'Historical only'}
                  </span>
                  <span className="badge badge-dim">
                    {data.ai_translation?.source === 'openai'
                      ? `OpenAI ${data.ai_translation.model}`
                      : 'Heuristic CA translator'}
                  </span>
                </>
              ) : (
                <span className="badge badge-dim">
                  {data.width}{data.automata_type !== 'elementary' ? `×${data.height}` : ''} cells
                </span>
              )}
              <span className="badge badge-dim">{data.total_generations} {data.automata_type === 'epidemic' ? 'weeks' : 'generations'}</span>
            </>
          )}
          {isStale && data && (
            <span className="badge badge-stale">Config changed</span>
          )}
        </div>

        <div className="header-actions">
          {data && !['image_ca','epidemic','life_3d'].includes(data.automata_type) && (
            <button
              className={`view3d-btn ${view3D ? 'active' : ''}`}
              onClick={() => setView3D(v => !v)}
              title="Toggle 3D terrain view"
              style={view3D ? { borderColor: accent, color: accent } : {}}
            >
              {view3D ? '2D' : '3D'}
            </button>
          )}
          {data && (
            <button className="clear-btn" onClick={() => { setData(null); setCurrentGen(0); setIsStale(false); setIsPlaying(false); setView3D(false) }}
              title="Clear simulation">
              ✕ Clear
            </button>
          )}
          <button className="run-btn" onClick={handleCompute} disabled={isLoading}
            style={{ '--accent': accent }}>
            {isLoading ? <span className="spinner" /> : <>⚡ Run Simulation</>}
          </button>
        </div>
      </header>

      <div className="app-body">
        {/* ── Sidebar ── */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <RuleSelector config={config} onChange={handleConfigChange} rulesData={rulesData} />
        </aside>

        {/* ── Main ── */}
        <main className="main-content">
          {error && <div className="error-banner">⚠ {error}</div>}

          {data?.automata_type === 'epidemic' ? (
            <EpidemicView data={data} currentGen={currentGen} />
          ) : (data?.cells_3d || view3D) && data ? (
            <Canvas3D data={data} currentGen={currentGen} />
          ) : (
            <AutomataCanvas
              data={data}
              currentGen={currentGen}
              isStale={isStale}
              onRun={handleCompute}
            />
          )}

          {data && (
            <>
              <Timeline
                currentGen={currentGen}
                totalGenerations={totalGenerations}
                onChange={(g) => { setCurrentGen(g); setIsPlaying(false) }}
                accent={accent}
              />
              <Controls
                isPlaying={isPlaying}
                onPlay={() => {
                  if (currentGen >= totalGenerations - 1) setCurrentGen(0)
                  setIsPlaying(true)
                }}
                onPause={() => setIsPlaying(false)}
                onStop={handleStop}
                onRefresh={handleRefresh}
                onStepBack={() => { setIsPlaying(false); setCurrentGen((g) => Math.max(0, g - 1)) }}
                onStepForward={() => { setIsPlaying(false); setCurrentGen((g) => Math.min(totalGenerations - 1, g + 1)) }}
                onReset={() => { setIsPlaying(false); setCurrentGen(0) }}
                looping={looping}
                onToggleLoop={() => setLooping((v) => !v)}
                speed={speed}
                onSpeedChange={setSpeed}
                currentGen={currentGen}
                totalGenerations={totalGenerations}
                frameLabel={data.automata_type === 'epidemic' ? 'Week' : 'Gen'}
                disabled={!data}
                accent={accent}
              />
            </>
          )}

          {!data && !isLoading && (
            <div className="welcome-hint">
              <span>Choose an automata type on the left, then click</span>
              <button className="run-btn-inline" onClick={handleCompute} style={{ '--accent': accent }}>
                ⚡ Run Simulation
              </button>
            </div>
          )}

          {isLoading && (
            <div className="loading-overlay-main">
              <div className="loading-pulse" style={{ borderColor: accent, color: accent }}>
                <span className="loading-spinner" style={{ borderTopColor: accent }} />
                <span>Computing…</span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
