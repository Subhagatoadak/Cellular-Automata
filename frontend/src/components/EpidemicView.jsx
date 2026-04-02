import { useRef, useEffect } from 'react'

// Equirectangular projection: (lat, lon) → (x, y) in canvas pixels
function project(lat, lon, W, H) {
  const x = ((lon + 180) / 360) * W
  const y = ((90 - lat) / 180) * H
  return [x, y]
}

// Map active_per_million to a color (blue → yellow → red, log scale)
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

export default function EpidemicView({ data, currentGen }) {
  const canvasRef    = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !data) return

    const W = container.clientWidth  || 800
    const H = container.clientHeight || 480
    canvas.width  = W
    canvas.height = H

    const ctx = canvas.getContext('2d')
    const frame = data.states?.[currentGen]
    if (!frame) return

    const meta   = data.countries_meta ?? {}
    const maxPop = Math.max(...Object.values(meta).map(m => m.pop_m), 1)

    // ── Background ────────────────────────────────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
    bgGrad.addColorStop(0, '#010418')
    bgGrad.addColorStop(1, '#020c24')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, W, H)

    // ── Ocean regions tint ────────────────────────────────────────────────────
    const oceanGrad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)/1.5)
    oceanGrad.addColorStop(0, 'rgba(5,20,60,0.5)')
    oceanGrad.addColorStop(1, 'rgba(0,5,30,0)')
    ctx.fillStyle = oceanGrad
    ctx.fillRect(0, 0, W, H)

    // ── Lat/lon grid ──────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(20,60,130,0.35)'
    ctx.lineWidth = 0.5
    for (let lon = -180; lon <= 180; lon += 30) {
      const [gx] = project(0, lon, W, H)
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke()
    }
    for (let lat = -90; lat <= 90; lat += 30) {
      const [, gy] = project(lat, 0, W, H)
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke()
    }

    // Equator highlight
    const [, eqY] = project(0, 0, W, H)
    ctx.strokeStyle = 'rgba(40,100,200,0.45)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, eqY); ctx.lineTo(W, eqY); ctx.stroke()

    // Prime meridian
    const [pmX] = project(0, 0, W, H)
    ctx.beginPath(); ctx.moveTo(pmX, 0); ctx.lineTo(pmX, H); ctx.stroke()

    // ── Country bubbles ───────────────────────────────────────────────────────
    const countries = frame.countries ?? {}
    const countryNames = Object.keys(countries)

    // Sort: draw low-infection first, high last (so hot spots are on top)
    const sorted = [...countryNames].sort((a, b) => {
      const aA = countries[a]?.active_per_m ?? 0
      const bA = countries[b]?.active_per_m ?? 0
      return aA - bA
    })

    for (const name of sorted) {
      const cdata = countries[name]
      const m = meta[name]
      if (!m || !cdata) continue

      const [cx, cy] = project(m.lat, m.lon, W, H)
      const activePerM = cdata.active_per_m ?? 0
      const vacPct     = cdata.vacc_pct ?? 0
      const [r, g, b]  = infColor(activePerM)

      const radius = Math.max(4, Math.sqrt(m.pop_m / maxPop) * Math.min(W, H) * 0.065)

      // Vaccination arc (green outer ring)
      if (vacPct > 5) {
        ctx.shadowBlur = 0
        ctx.strokeStyle = `rgba(50,220,80,${Math.min(0.85, vacPct / 80)})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy, radius + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (vacPct / 100))
        ctx.stroke()
      }

      // Glow for high infection
      const glowIntensity = Math.min(activePerM / 3000, 1)
      ctx.shadowBlur = radius * (1.5 + glowIntensity * 3)
      ctx.shadowColor = `rgba(${r},${g},${b},${0.4 + glowIntensity * 0.5})`

      // Radial gradient bubble
      const bGrad = ctx.createRadialGradient(
        cx - radius * 0.3, cy - radius * 0.3, 0,
        cx, cy, radius
      )
      const alpha = 0.72 + glowIntensity * 0.25
      bGrad.addColorStop(0, `rgba(${Math.min(r+90,255)},${Math.min(g+90,255)},${Math.min(b+90,255)},${alpha})`)
      bGrad.addColorStop(1, `rgba(${r},${g},${b},${alpha * 0.65})`)
      ctx.fillStyle = bGrad
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      // Country name label for larger countries
      if (radius > 9) {
        ctx.font = `${Math.max(7, Math.min(10, radius * 0.85))}px Inter, sans-serif`
        ctx.fillStyle = 'rgba(220,235,255,0.85)'
        ctx.textAlign = 'center'
        ctx.fillText(name.length > 10 ? name.slice(0, 10) + '…' : name, cx, cy + radius + 10)
      }
    }

    // ── Phase / date badge (top center) ───────────────────────────────────────
    const isForecast = frame.is_forecast ?? false
    const dateStr    = frame.date ?? ''
    const phaseLabel = frame.label ?? frame.phase ?? ''
    const badgeW = Math.min(260, W * 0.38), badgeH = 46
    const badgeX = W / 2 - badgeW / 2, badgeY = 10

    ctx.fillStyle = isForecast ? 'rgba(180,50,0,0.82)' : 'rgba(10,60,160,0.82)'
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 10)
    ctx.fill()

    ctx.font = `bold ${Math.max(11, Math.min(13, W * 0.016))}px Inter, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.fillText(`${isForecast ? '🔮 Forecast' : '📅 Historical'} · ${phaseLabel}`, W/2, badgeY + 18)

    ctx.font = `${Math.max(9, Math.min(11, W * 0.013))}px Inter, sans-serif`
    ctx.fillStyle = 'rgba(200,220,255,0.9)'
    ctx.fillText(`${dateStr}  ·  Week ${frame.week ?? currentGen}`, W/2, badgeY + 34)

    // ── Legend panel (bottom left) ────────────────────────────────────────────
    const legX = 10, legY = H - 130, legW = 210, legH = 120
    ctx.fillStyle = 'rgba(2,8,32,0.80)'
    roundRect(ctx, legX, legY, legW, legH, 8)
    ctx.fill()

    ctx.font = `bold 11px Inter, sans-serif`
    ctx.fillStyle = 'rgba(160,200,255,0.9)'
    ctx.textAlign = 'left'
    ctx.fillText('Active infection rate', legX + 8, legY + 16)

    // Color gradient bar
    const barX = legX + 8, barY = legY + 22, barW2 = legW - 16, barH2 = 11
    const colorBar = ctx.createLinearGradient(barX, 0, barX + barW2, 0)
    colorBar.addColorStop(0,   '#0066ff')
    colorBar.addColorStop(0.4, '#ffcc00')
    colorBar.addColorStop(1,   '#ff2020')
    ctx.fillStyle = colorBar
    ctx.fillRect(barX, barY, barW2, barH2)

    ctx.font = '9px Inter, sans-serif'
    ctx.fillStyle = 'rgba(160,200,255,0.7)'
    ctx.textAlign = 'left';  ctx.fillText('Low',   barX,            barY + barH2 + 11)
    ctx.textAlign = 'center';ctx.fillText('Medium', barX + barW2/2, barY + barH2 + 11)
    ctx.textAlign = 'right'; ctx.fillText('High',  barX + barW2,   barY + barH2 + 11)

    // Global stats
    const g_cases  = frame.global_cases  ?? 0  // millions
    const g_deaths = frame.global_deaths ?? 0  // millions
    const g_vacc   = frame.global_vacc_pct ?? 0

    ctx.textAlign = 'left'
    ctx.font = '10px Inter, monospace'

    ctx.fillStyle = 'rgba(255,180,80,0.92)'
    ctx.fillText(`Cases: ${g_cases.toFixed(1)}M cumulative`, legX + 8, legY + 68)
    ctx.fillStyle = 'rgba(255,100,100,0.92)'
    ctx.fillText(`Deaths: ${g_deaths.toFixed(2)}M cumulative`, legX + 8, legY + 84)
    ctx.fillStyle = 'rgba(80,230,100,0.92)'
    ctx.fillText(`Vaccinated: ${g_vacc.toFixed(1)}% global`, legX + 8, legY + 100)

    const circleR = 5
    ctx.fillStyle = 'rgba(50,200,80,0.75)'
    ctx.beginPath(); ctx.arc(legX + 8 + circleR, legY + 112, circleR, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(160,200,255,0.7)'
    ctx.font = '9px Inter, sans-serif'
    ctx.fillText('Green arc = vaccination %', legX + 18, legY + 116)

    // ── Real data overlay (bottom right) ─────────────────────────────────────
    if (data.real_data && !isForecast) {
      const rd     = data.real_data
      const wk     = frame.week ?? currentGen
      const rdCases  = rd.cases?.[wk]  ?? null
      const rdDeaths = rd.deaths?.[wk] ?? null
      if (rdCases !== null) {
        const rdW = Math.min(200, W * 0.27), rdH = 68
        const rdX = W - rdW - 10, rdY = H - rdH - 10
        ctx.fillStyle = 'rgba(2,8,32,0.80)'
        roundRect(ctx, rdX, rdY, rdW, rdH, 8)
        ctx.fill()

        ctx.font = 'bold 10px Inter, sans-serif'
        ctx.fillStyle = 'rgba(100,180,255,0.95)'
        ctx.textAlign = 'left'
        ctx.fillText('WHO Real Data', rdX + 8, rdY + 16)

        ctx.font = '10px Inter, monospace'
        ctx.fillStyle = 'rgba(255,200,100,0.90)'
        ctx.fillText(`Cases:  ${rdCases.toLocaleString()}`, rdX + 8, rdY + 34)
        ctx.fillStyle = 'rgba(255,120,120,0.90)'
        ctx.fillText(`Deaths: ${rdDeaths?.toLocaleString() ?? '—'}`, rdX + 8, rdY + 50)

        ctx.font = '8px Inter, sans-serif'
        ctx.fillStyle = 'rgba(100,150,255,0.6)'
        ctx.fillText('source: disease.sh', rdX + 8, rdY + 63)
      }
    }

  }, [data, currentGen])

  return (
    <div ref={containerRef} className="canvas-container epidemic-view">
      <canvas ref={canvasRef} className="automata-canvas epidemic-canvas" />
    </div>
  )
}
