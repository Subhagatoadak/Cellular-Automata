import { useEffect, useRef } from 'react'
import { feature } from 'topojson-client'
import worldAtlas from 'world-atlas/countries-110m.json'

const WORLD_FEATURES = feature(worldAtlas, worldAtlas.objects.countries).features

function project(lat, lon, width, height) {
  const x = ((lon + 180) / 360) * width
  const y = ((90 - lat) / 180) * height
  return [x, y]
}

function infColor(activePerM) {
  const t = Math.min(1, Math.log1p(activePerM / 50) / Math.log1p(200))
  let r, g, b
  if (t < 0.5) {
    const u = t * 2
    r = Math.round(u * 255)
    g = Math.round(102 + u * 98)
    b = Math.round(255 - u * 255)
  } else {
    const u = (t - 0.5) * 2
    r = 255
    g = Math.round(200 - u * 200)
    b = 0
  }
  return [r, g, b]
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function traceRing(ctx, ring, width, height) {
  ring.forEach(([lon, lat], idx) => {
    const [x, y] = project(lat, lon, width, height)
    if (idx === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
}

function drawWorldMap(ctx, width, height) {
  ctx.save()
  ctx.fillStyle = 'rgba(16, 42, 94, 0.95)'
  ctx.strokeStyle = 'rgba(145, 198, 255, 0.14)'
  ctx.lineWidth = 0.6

  WORLD_FEATURES.forEach(({ geometry }) => {
    if (!geometry) return
    ctx.beginPath()
    if (geometry.type === 'Polygon') {
      geometry.coordinates.forEach((ring) => traceRing(ctx, ring, width, height))
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach((poly) => poly.forEach((ring) => traceRing(ctx, ring, width, height)))
    }
    ctx.fill('evenodd')
    ctx.stroke()
  })
  ctx.restore()
}

function fmtTuning(label, value) {
  const pct = Math.round((value - 1) * 100)
  const sign = pct > 0 ? '+' : ''
  return `${label} ${sign}${pct}%`
}

export default function EpidemicView({ data, currentGen }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const frame = data?.states?.[currentGen]
  const stateMeta = data?.ca_states ?? []
  const stateMap = Object.fromEntries(stateMeta.map((state) => [state.label, state]))
  const stateCounts = Object.entries(frame?.state_counts ?? {}).sort((a, b) => b[1] - a[1])
  const hotspots = frame?.hotspots ?? []
  const translation = data?.ai_translation ?? {}
  const tuning = translation.tuning ?? {}

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !data || !frame) return

    const width = container.clientWidth || 800
    const height = container.clientHeight || 480
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    const meta = data.countries_meta ?? {}
    const maxPop = Math.max(...Object.values(meta).map((country) => country.pop_m), 1)

    const bg = ctx.createLinearGradient(0, 0, 0, height)
    bg.addColorStop(0, '#02081d')
    bg.addColorStop(0.55, '#071533')
    bg.addColorStop(1, '#020712')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    const ocean = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 1.3)
    ocean.addColorStop(0, 'rgba(18, 58, 132, 0.32)')
    ocean.addColorStop(1, 'rgba(2, 8, 24, 0)')
    ctx.fillStyle = ocean
    ctx.fillRect(0, 0, width, height)

    drawWorldMap(ctx, width, height)

    ctx.strokeStyle = 'rgba(58, 112, 185, 0.22)'
    ctx.lineWidth = 0.5
    for (let lon = -180; lon <= 180; lon += 30) {
      const [x] = project(0, lon, width, height)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let lat = -90; lat <= 90; lat += 30) {
      const [, y] = project(lat, 0, width, height)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    const countries = frame.countries ?? {}
    const countryNames = Object.keys(countries)
    const sorted = [...countryNames].sort((a, b) => (countries[a]?.active_per_m ?? 0) - (countries[b]?.active_per_m ?? 0))

    sorted.forEach((name) => {
      const cell = countries[name]
      const country = meta[name]
      if (!cell || !country) return

      const [cx, cy] = project(country.lat, country.lon, width, height)
      const activePerM = cell.active_per_m ?? 0
      const vacPct = cell.vacc_pct ?? 0
      const [r, g, b] = infColor(activePerM)
      const stateColor = stateMap[cell.ca_label]?.color ?? '#7aa8ff'
      const radius = Math.max(4, Math.sqrt(country.pop_m / maxPop) * Math.min(width, height) * 0.06)
      const glowIntensity = Math.min(activePerM / 3000, 1)

      if (vacPct > 5) {
        ctx.strokeStyle = `rgba(70, 226, 122, ${Math.min(0.85, vacPct / 85)})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy, radius + 4.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (vacPct / 100))
        ctx.stroke()
      }

      ctx.shadowBlur = radius * (1.4 + glowIntensity * 3)
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${0.35 + glowIntensity * 0.5})`
      const fill = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius)
      fill.addColorStop(0, `rgba(${Math.min(r + 85, 255)}, ${Math.min(g + 85, 255)}, ${Math.min(b + 85, 255)}, 0.92)`)
      fill.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.52)`)
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fill()

      ctx.shadowBlur = 0
      ctx.strokeStyle = stateColor
      ctx.lineWidth = 1.6 + glowIntensity
      ctx.beginPath()
      ctx.arc(cx, cy, radius + 1.5, 0, Math.PI * 2)
      ctx.stroke()

      if (radius > 8) {
        ctx.font = `${Math.max(7, Math.min(10, radius * 0.85))}px "JetBrains Mono", monospace`
        ctx.fillStyle = 'rgba(230, 240, 255, 0.82)'
        ctx.textAlign = 'center'
        ctx.fillText(name.length > 11 ? `${name.slice(0, 11)}…` : name, cx, cy + radius + 11)
      }
    })

    const badgeWidth = Math.min(280, width * 0.4)
    const badgeHeight = 48
    const badgeX = width / 2 - badgeWidth / 2
    const badgeY = 12
    ctx.fillStyle = frame.is_forecast ? 'rgba(180, 58, 24, 0.86)' : 'rgba(15, 78, 168, 0.82)'
    roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 12)
    ctx.fill()

    ctx.font = `bold ${Math.max(11, Math.min(13, width * 0.016))}px "JetBrains Mono", monospace`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.fillText(`${frame.is_forecast ? 'Forecast' : 'Historical'} · ${frame.label}`, width / 2, badgeY + 19)

    ctx.font = `${Math.max(9, Math.min(11, width * 0.013))}px "JetBrains Mono", monospace`
    ctx.fillStyle = 'rgba(214, 228, 255, 0.9)'
    ctx.fillText(`${frame.date} · Week ${frame.week}`, width / 2, badgeY + 35)

    const statsX = 12
    const statsY = height - 112
    const statsW = 214
    const statsH = 100
    ctx.fillStyle = 'rgba(3, 11, 28, 0.84)'
    roundRect(ctx, statsX, statsY, statsW, statsH, 12)
    ctx.fill()

    ctx.font = 'bold 11px "JetBrains Mono", monospace'
    ctx.fillStyle = 'rgba(166, 205, 255, 0.94)'
    ctx.textAlign = 'left'
    ctx.fillText('Global System State', statsX + 10, statsY + 16)

    ctx.font = '10px "JetBrains Mono", monospace'
    ctx.fillStyle = 'rgba(255, 196, 115, 0.95)'
    ctx.fillText(`Cases:   ${frame.global_cases.toFixed(1)}M`, statsX + 10, statsY + 40)
    ctx.fillStyle = 'rgba(255, 110, 110, 0.95)'
    ctx.fillText(`Deaths:  ${frame.global_deaths.toFixed(2)}M`, statsX + 10, statsY + 58)
    ctx.fillStyle = 'rgba(112, 230, 132, 0.95)'
    ctx.fillText(`Vacc:    ${frame.global_vacc_pct.toFixed(1)}%`, statsX + 10, statsY + 76)
    ctx.fillStyle = 'rgba(109, 210, 255, 0.95)'
    ctx.fillText(`Active:  ${frame.global_active.toFixed(2)}M`, statsX + 10, statsY + 94)

    if (data.real_data && !frame.is_forecast) {
      const realCases = data.real_data.cases?.[frame.week] ?? null
      const realDeaths = data.real_data.deaths?.[frame.week] ?? null
      if (realCases !== null) {
        const panelW = Math.min(228, width * 0.3)
        const panelH = 72
        const panelX = width - panelW - 14
        const panelY = height - panelH - 14
        ctx.fillStyle = 'rgba(3, 11, 28, 0.84)'
        roundRect(ctx, panelX, panelY, panelW, panelH, 12)
        ctx.fill()

        ctx.font = 'bold 10px "JetBrains Mono", monospace'
        ctx.fillStyle = 'rgba(109, 180, 255, 0.95)'
        ctx.fillText('Real Data Overlay', panelX + 10, panelY + 16)

        ctx.font = '10px "JetBrains Mono", monospace'
        ctx.fillStyle = 'rgba(255, 201, 108, 0.9)'
        ctx.fillText(`Cases:  ${realCases.toLocaleString()}`, panelX + 10, panelY + 38)
        ctx.fillStyle = 'rgba(255, 120, 120, 0.9)'
        ctx.fillText(`Deaths: ${realDeaths?.toLocaleString() ?? '—'}`, panelX + 10, panelY + 54)

        ctx.font = '8px "JetBrains Mono", monospace'
        ctx.fillStyle = 'rgba(124, 166, 228, 0.62)'
        ctx.fillText(`source: ${data.real_data.source}`, panelX + 10, panelY + 66)
      }
    }
  }, [data, frame, currentGen, stateMap])

  if (!frame) return null

  const translationLabel = translation.source === 'openai' ? 'OpenAI Pattern Translation' : 'CA Pattern Translation'

  return (
    <div className="canvas-container epidemic-view" ref={containerRef}>
      <canvas ref={canvasRef} className="epidemic-canvas" />

      <div className="epi-panel epi-panel-ai">
        <div className="epi-kicker">
          {translationLabel}
          {translation.model ? ` · ${translation.model}` : ''}
        </div>
        <div className="epi-title">{translation.headline || 'Country-cell states are steering the outbreak model.'}</div>
        <div className="epi-copy">{translation.summary}</div>
        <div className="epi-rule">{translation.cell_rule}</div>
        <div className="epi-tuning">
          {tuning.neighbor_weight && <span>{fmtTuning('Neighbor', tuning.neighbor_weight)}</span>}
          {tuning.travel_weight && <span>{fmtTuning('Travel', tuning.travel_weight)}</span>}
          {tuning.seasonality_weight && <span>{fmtTuning('Season', tuning.seasonality_weight)}</span>}
          {tuning.recovery_drag && <span>{fmtTuning('Recovery', tuning.recovery_drag)}</span>}
          {tuning.vaccination_shield && <span>{fmtTuning('Shield', tuning.vaccination_shield)}</span>}
        </div>
      </div>

      <div className="epi-panel epi-panel-forecast">
        <div className="epi-kicker">Forecast Window</div>
        <div className="epi-title">
          {frame.is_forecast ? 'Playback is inside forecast weeks.' : 'Playback is inside historical replay.'}
        </div>
        <div className="epi-copy">
          Present date: {data.present_date}
          <br />
          Forecast start: {data.forecast_start_date}
          <br />
          Forecast end: {data.forecast_end_date}
        </div>
        <div className="epi-footnote">{translation.forecast_focus}</div>
      </div>

      <div className="epi-panel epi-panel-states">
        <div className="epi-kicker">Country Cell States</div>
        <div className="epi-state-list">
          {stateCounts.slice(0, 4).map(([label, count]) => (
            <div key={label} className="epi-state-row">
              <span className="epi-state-dot" style={{ background: stateMap[label]?.color ?? '#88aaff' }} />
              <span>{label}</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
        <div className="epi-hotspots">
          {hotspots.slice(0, 4).map((spot) => (
            <div key={spot.country} className="epi-hotspot-row">
              <span>{spot.country}</span>
              <span>{spot.ca_label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
