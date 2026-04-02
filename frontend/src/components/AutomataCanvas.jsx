import { useRef, useEffect, useCallback } from 'react'

const BG = {
  elementary:  '#03030f',
  game_of_life:'#020d05',
  brians_brain:'#03020e',
  cyclic:      '#040210',
  langtons_ant:'#080400',
  custom_2d:   '#07020e',
  bacteria:    '#020a02',
  traffic:     '#050508',
  image_ca:    '#000000',
}

// ─── 1D Elementary ────────────────────────────────────────────────────────────
function drawElementary(ctx, data, gen) {
  const { width, total_generations: totalGen, states } = data
  const W = ctx.canvas.width, H = ctx.canvas.height
  const cw = W / width, ch = H / totalGen
  ctx.fillStyle = BG.elementary
  ctx.fillRect(0, 0, W, H)
  for (let g = 0; g <= gen; g++) {
    const row = states[g], y = g * ch
    const ageFrac = (gen - g) / Math.max(gen + 1, 1)
    const lightness = 65 - ageFrac * 35
    const saturation = 95 - ageFrac * 45
    const alpha = Math.max(0.18, 1 - ageFrac * 0.75)
    const isRecent = ageFrac < 0.06
    ctx.globalAlpha = alpha
    for (let col = 0; col < width; col++) {
      if (!row[col]) continue
      const hue = (col / width) * 290 + 30
      const x = col * cw
      if (isRecent) { ctx.shadowBlur = 10; ctx.shadowColor = `hsl(${hue},100%,75%)` }
      else ctx.shadowBlur = 0
      ctx.fillStyle = `hsl(${hue},${saturation}%,${lightness}%)`
      ctx.fillRect(x, y, Math.max(cw - 0.4, 0.8), Math.max(ch - 0.4, 0.8))
    }
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0
  if (gen < totalGen) {
    const y = gen * ch
    const grad = ctx.createLinearGradient(0, y - ch*3, 0, y + ch*4)
    grad.addColorStop(0, 'transparent')
    grad.addColorStop(0.55, 'hsla(200,100%,60%,0.18)')
    grad.addColorStop(1, 'transparent')
    ctx.fillStyle = grad
    ctx.fillRect(0, y - ch*3, W, ch*7)
    ctx.shadowBlur = 6; ctx.shadowColor = 'hsla(200,100%,70%,0.9)'
    ctx.strokeStyle = 'hsla(200,100%,65%,0.7)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    ctx.shadowBlur = 0
  }
}

// ─── Game of Life ─────────────────────────────────────────────────────────────
function drawGameOfLife(ctx, data, gen) {
  const { width, height, states } = data
  const W = ctx.canvas.width, H = ctx.canvas.height
  const cw = W / width, ch = H / height
  ctx.fillStyle = BG.game_of_life; ctx.fillRect(0, 0, W, H)
  const curr = states[gen], prev = gen > 0 ? states[gen-1] : null
  const w = Math.max(cw - 0.5, 1), h = Math.max(ch - 0.5, 1), glow = cw > 3 ? 12 : 4
  for (let r = 0; r < curr.length; r++) {
    const row = curr[r], prevRow = prev?.[r]
    for (let c = 0; c < row.length; c++) {
      const alive = row[c], wasAlive = prevRow?.[c]
      const x = c * cw, y = r * ch
      if (alive) {
        if (wasAlive === 0) { ctx.shadowBlur = glow*2; ctx.shadowColor = '#aaffcc'; ctx.fillStyle = '#dfffee' }
        else { ctx.shadowBlur = glow; ctx.shadowColor = '#00ff88'; ctx.fillStyle = '#00ee7a' }
        ctx.fillRect(x, y, w, h)
      } else if (wasAlive) {
        ctx.globalAlpha = 0.22; ctx.shadowBlur = 3; ctx.shadowColor = '#003320'
        ctx.fillStyle = '#004d28'; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1
      }
    }
  }
  ctx.shadowBlur = 0
}

// ─── Brian's Brain ────────────────────────────────────────────────────────────
function drawBriansBrain(ctx, data, gen) {
  const { width, height, states } = data
  const W = ctx.canvas.width, H = ctx.canvas.height
  const cw = W / width, ch = H / height
  ctx.fillStyle = BG.brians_brain; ctx.fillRect(0, 0, W, H)
  const curr = states[gen], w = Math.max(cw - 0.5, 1), h = Math.max(ch - 0.5, 1)
  for (let r = 0; r < curr.length; r++) {
    for (let c = 0; c < curr[r].length; c++) {
      const cell = curr[r][c]; if (!cell) continue
      const x = c * cw, y = r * ch
      if (cell === 1) { ctx.shadowBlur = cw>3?16:6; ctx.shadowColor='#80b0ff'; ctx.fillStyle='#f0f6ff' }
      else { ctx.shadowBlur = cw>3?6:2; ctx.shadowColor='#2030aa'; ctx.fillStyle='#3050ee' }
      ctx.fillRect(x, y, w, h)
    }
  }
  ctx.shadowBlur = 0
}

// ─── Cyclic ───────────────────────────────────────────────────────────────────
function drawCyclic(ctx, data, gen) {
  const { width, height, states, num_states } = data
  const N = num_states || 8
  const W = ctx.canvas.width, H = ctx.canvas.height
  const cw = W / width, ch = H / height
  ctx.fillStyle = BG.cyclic; ctx.fillRect(0, 0, W, H)
  const curr = states[gen], w = Math.max(cw - 0.3, 0.8), h = Math.max(ch - 0.3, 0.8)
  const glow = cw > 3 ? 10 : 2
  for (let r = 0; r < curr.length; r++) {
    for (let c = 0; c < curr[r].length; c++) {
      const cell = curr[r][c], hue = (cell / N) * 360
      ctx.shadowBlur = glow; ctx.shadowColor = `hsl(${hue},100%,75%)`
      ctx.fillStyle = `hsl(${hue},90%,55%)`
      ctx.fillRect(c * cw, r * ch, w, h)
    }
  }
  ctx.shadowBlur = 0
}

// ─── Langton's Ant ────────────────────────────────────────────────────────────
function drawLangtonsAnt(ctx, data, gen) {
  const { width, height, states } = data
  const W = ctx.canvas.width, H = ctx.canvas.height
  const cw = W / width, ch = H / height
  ctx.fillStyle = BG.langtons_ant; ctx.fillRect(0, 0, W, H)
  const curr = states[gen], w = Math.max(cw - 0.4, 0.8), h = Math.max(ch - 0.4, 0.8)
  for (let r = 0; r < curr.length; r++) {
    for (let c = 0; c < curr[r].length; c++) {
      const cell = curr[r][c]; if (!cell) continue
      if (cell === 1) { ctx.shadowBlur = cw>3?6:2; ctx.shadowColor='#ff6600'; ctx.fillStyle='#cc5500' }
      else { ctx.shadowBlur = cw>3?20:8; ctx.shadowColor='#ff2060'; ctx.fillStyle='#ff2060' }
      ctx.fillRect(c * cw, r * ch, w, h)
    }
  }
  ctx.shadowBlur = 0
}

// ─── Custom 2D ────────────────────────────────────────────────────────────────
function drawCustom2D(ctx, data, gen) {
  const { width, height, states } = data
  const W = ctx.canvas.width, H = ctx.canvas.height
  const cw = W / width, ch = H / height
  ctx.fillStyle = BG.custom_2d; ctx.fillRect(0, 0, W, H)
  const curr = states[gen], prev = gen > 0 ? states[gen-1] : null
  const w = Math.max(cw - 0.5, 1), h = Math.max(ch - 0.5, 1), glow = cw > 3 ? 12 : 4
  for (let r = 0; r < curr.length; r++) {
    const row = curr[r], prevRow = prev?.[r]
    for (let c = 0; c < row.length; c++) {
      const alive = row[c], wasAlive = prevRow?.[c]
      const x = c * cw, y = r * ch
      if (alive) {
        if (wasAlive === 0) { ctx.shadowBlur=glow*2; ctx.shadowColor='#ffaaff'; ctx.fillStyle='#ffe0ff' }
        else { ctx.shadowBlur=glow; ctx.shadowColor='#cc44ff'; ctx.fillStyle='#aa33ee' }
        ctx.fillRect(x, y, w, h)
      } else if (wasAlive) {
        ctx.globalAlpha=0.2; ctx.fillStyle='#220033'; ctx.fillRect(x,y,w,h); ctx.globalAlpha=1
      }
    }
  }
  ctx.shadowBlur = 0
}

// ─── Bacteria — petri-dish look ───────────────────────────────────────────────
const BACTERIA_COLORS = {
  0: null,
  1: ['#20cc40','#10ee30','#aaffbb'],   // Strain A — green
  2: ['#cc8010','#ee9820','#ffddaa'],   // Strain B — amber
  3: ['#9010cc','#b030ee','#ddaaff'],   // Strain C — purple
  4: ['#80dd30','#99ff44','#ddffcc'],   // Nutrient — lime
  5: ['#553322','#442211','#887766'],   // Dead — brown
}

function drawBacteria(ctx, data, gen) {
  const { width, height, states } = data
  const W = ctx.canvas.width, H = ctx.canvas.height
  const cw = W / width, ch = H / height
  // Petri dish background
  ctx.fillStyle = '#020a02'; ctx.fillRect(0, 0, W, H)
  // Petri dish circle
  const cx = W/2, cy = H/2, rad = Math.min(W, H) * 0.48
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
  grad.addColorStop(0, 'rgba(20,60,20,0.4)')
  grad.addColorStop(1, 'rgba(0,10,0,0)')
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
  // Grid lines (petri dish grid)
  ctx.strokeStyle = 'rgba(40,80,40,0.2)'; ctx.lineWidth = 0.5
  for (let c2 = 0; c2 <= width; c2 += 5) {
    ctx.beginPath(); ctx.moveTo(c2*cw,0); ctx.lineTo(c2*cw,H); ctx.stroke()
  }
  for (let r2 = 0; r2 <= height; r2 += 5) {
    ctx.beginPath(); ctx.moveTo(0,r2*ch); ctx.lineTo(W,r2*ch); ctx.stroke()
  }

  const curr = states[gen]
  const w = Math.max(cw - 0.3, 0.8), h2 = Math.max(ch - 0.3, 0.8)
  for (let r = 0; r < curr.length; r++) {
    for (let c = 0; c < curr[r].length; c++) {
      const cell = curr[r][c]; if (!cell) continue
      const cols = BACTERIA_COLORS[cell]; if (!cols) continue
      const x = c * cw, y = r * ch
      ctx.shadowBlur = cell === 4 ? 3 : cell === 5 ? 0 : cw > 3 ? 10 : 3
      ctx.shadowColor = cols[2]
      ctx.fillStyle = cols[1]
      ctx.fillRect(x, y, w, h2)
    }
  }
  ctx.shadowBlur = 0

  // Legend overlay
  const entries = [{label:'Strain A',col:'#20cc40'},{label:'Strain B',col:'#cc8010'},{label:'Strain C',col:'#9010cc'},{label:'Nutrient',col:'#80dd30'},{label:'Dead',col:'#553322'}]
  ctx.font = `${Math.max(9,Math.min(13,cw*2))}px Inter, sans-serif`
  entries.forEach((e, i) => {
    const lx = 8, ly = 12 + i * 16
    ctx.fillStyle = e.col; ctx.fillRect(lx, ly, 8, 8)
    ctx.fillStyle = 'rgba(200,255,200,0.7)'; ctx.fillText(e.label, lx + 12, ly + 8)
  })
}

// ─── Traffic Flow ─────────────────────────────────────────────────────────────
function drawTraffic(ctx, data, gen) {
  const { width, height, states, h_lanes = [], v_lanes = [], traffic_stats = [] } = data
  const W = ctx.canvas.width, H = ctx.canvas.height
  const cw = W / width, ch = H / height

  // City-block background
  ctx.fillStyle = '#060609'; ctx.fillRect(0, 0, W, H)

  // Draw city blocks
  ctx.fillStyle = '#0d0d12'
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const onHLane = h_lanes.includes(r)
      const onVLane = v_lanes.includes(c)
      if (!onHLane && !onVLane) {
        ctx.fillRect(c*cw+0.5, r*ch+0.5, Math.max(cw-1,1), Math.max(ch-1,1))
      }
    }
  }

  // Road lanes (subtle stripe)
  ctx.fillStyle = 'rgba(30,30,50,0.8)'
  h_lanes.forEach(r => ctx.fillRect(0, r*ch, W, Math.max(ch,1)))
  v_lanes.forEach(c => ctx.fillRect(c*cw, 0, Math.max(cw,1), H))

  // Dashed center lines
  ctx.strokeStyle = 'rgba(60,60,80,0.5)'; ctx.lineWidth = 0.5; ctx.setLineDash([3,5])
  h_lanes.forEach(r => { ctx.beginPath(); ctx.moveTo(0,r*ch+ch/2); ctx.lineTo(W,r*ch+ch/2); ctx.stroke() })
  v_lanes.forEach(c => { ctx.beginPath(); ctx.moveTo(c*cw+cw/2,0); ctx.lineTo(c*cw+cw/2,H); ctx.stroke() })
  ctx.setLineDash([])

  const curr = states[gen]
  const w = Math.max(cw * 0.85, 1), h2 = Math.max(ch * 0.85, 1)
  const offX = (cw - w) / 2, offY = (ch - h2) / 2

  for (let r = 0; r < curr.length; r++) {
    for (let c = 0; c < curr[r].length; c++) {
      const cell = curr[r][c]; if (!cell) continue
      const x = c*cw + offX, y = r*ch + offY
      if (cell === 1) {
        ctx.shadowBlur = 6; ctx.shadowColor = '#2060ff'; ctx.fillStyle = '#1050ee'
      } else if (cell === 2) {
        ctx.shadowBlur = 8; ctx.shadowColor = '#20ff80'; ctx.fillStyle = '#10dd60'
      } else if (cell === 3) {
        ctx.shadowBlur = 12; ctx.shadowColor = '#ff4020'; ctx.fillStyle = '#ee3010'
      } else if (cell === 4) {
        // Green light
        ctx.shadowBlur = 16; ctx.shadowColor = '#00ff44'; ctx.fillStyle = '#00cc33'
      } else if (cell === 5) {
        // Red light
        ctx.shadowBlur = 16; ctx.shadowColor = '#ff2020'; ctx.fillStyle = '#cc1010'
      }
      ctx.fillRect(x, y, w, h2)
    }
  }
  ctx.shadowBlur = 0

  // Speedometer overlay
  const avg = traffic_stats[gen] ?? 0
  const maxSpeed = 3
  const speedPct = avg / maxSpeed
  const barW = Math.min(120, W * 0.3)
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(W - barW - 8, 8, barW, 20)
  const col = speedPct < 0.4 ? '#ff3030' : speedPct < 0.7 ? '#ffaa20' : '#20ff60'
  ctx.fillStyle = col
  ctx.fillRect(W - barW - 8, 8, barW * speedPct, 20)
  ctx.fillStyle = 'rgba(220,230,255,0.8)'
  ctx.font = '10px JetBrains Mono, monospace'
  ctx.fillText(`Avg speed: ${avg.toFixed(1)}`, W - barW - 6, 22)
}

// ─── Image CA — direct RGB ────────────────────────────────────────────────────
function drawImageCA(ctx, data, gen) {
  const { width, height, states } = data
  const W = ctx.canvas.width, H = ctx.canvas.height
  const rgb = states[gen]
  if (!rgb || !rgb.length) return

  const imgData = ctx.createImageData(width, height)
  for (let r = 0; r < rgb.length; r++) {
    const row = rgb[r]
    for (let c = 0; c < row.length; c++) {
      const px = (r * width + c) * 4
      const [rv, gv, bv] = row[c]
      imgData.data[px]   = rv
      imgData.data[px+1] = gv
      imgData.data[px+2] = bv
      imgData.data[px+3] = 255
    }
  }
  // Scale to canvas
  const offscreen = document.createElement('canvas')
  offscreen.width = width; offscreen.height = height
  offscreen.getContext('2d').putImageData(imgData, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
  ctx.drawImage(offscreen, 0, 0, W, H)
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────
function drawFrame(ctx, data, gen) {
  switch (data.automata_type) {
    case 'elementary':   drawElementary(ctx, data, gen); break
    case 'game_of_life': drawGameOfLife(ctx, data, gen); break
    case 'brians_brain': drawBriansBrain(ctx, data, gen); break
    case 'cyclic':       drawCyclic(ctx, data, gen); break
    case 'langtons_ant': drawLangtonsAnt(ctx, data, gen); break
    case 'custom_2d':    drawCustom2D(ctx, data, gen); break
    case 'bacteria':     drawBacteria(ctx, data, gen); break
    case 'traffic':      drawTraffic(ctx, data, gen); break
    case 'image_ca':     drawImageCA(ctx, data, gen); break
  }
}

function computeCanvasSize(containerW, containerH, data) {
  if (data.automata_type === 'elementary') {
    const cw = Math.max(1, Math.floor(containerW / data.width))
    const ch = Math.max(1, Math.floor(containerH / data.total_generations))
    const cs = Math.min(cw, ch, 10)
    return [data.width * cs, data.total_generations * cs]
  }
  if (data.automata_type === 'image_ca') {
    return [containerW, containerH]
  }
  const cw = Math.max(1, Math.floor(containerW / data.width))
  const ch = Math.max(1, Math.floor(containerH / data.height))
  const cs = Math.min(cw, ch, 14)
  return [data.width * cs, data.height * cs]
}

export default function AutomataCanvas({ data, currentGen, isStale, onRun }) {
  const canvasRef    = useRef(null)
  const containerRef = useRef(null)

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !data) return
    const [cw, ch] = computeCanvasSize(container.clientWidth, container.clientHeight, data)
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch }
    drawFrame(canvas.getContext('2d'), data, currentGen)
  }, [data, currentGen])

  useEffect(() => { render() }, [render])

  if (!data) {
    return (
      <div ref={containerRef} className="canvas-container">
        <div className="empty-state">
          <div className="empty-hexgrid">
            {Array.from({ length: 19 }).map((_, i) => (
              <div key={i} className={`hex-cell ${i === 9 ? 'hex-center' : ''}`} />
            ))}
          </div>
          <h3>No simulation running</h3>
          <p>Pick a rule from the sidebar and click <strong>Run Simulation</strong></p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="canvas-container">
      <canvas ref={canvasRef} className="automata-canvas" />
      {isStale && (
        <div className="stale-overlay">
          <div className="stale-badge">
            <span className="stale-icon">⚡</span>
            <span>Config changed — run to update</span>
            <button className="stale-run-btn" onClick={onRun}>Run</button>
          </div>
        </div>
      )}
    </div>
  )
}
