import { useRef, useEffect, useCallback } from 'react'

// ─── Vertex Shader (terrain) ─────────────────────────────────────────────────
const TERRAIN_VERT = `
attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec3 aCol;
uniform mat4 uMVP;
uniform float uTime;
varying vec3 vCol;
varying vec3 vNorm;
void main() {
  float w = sin(aPos.x * 2.5 + uTime) * 0.018 * aPos.y + cos(aPos.z * 2.5 + uTime * 0.7) * 0.018 * aPos.y;
  gl_Position = uMVP * vec4(aPos.x, aPos.y + w, aPos.z, 1.0);
  vCol = aCol;
  vNorm = aNorm;
}
`
const TERRAIN_FRAG = `
precision mediump float;
varying vec3 vCol;
varying vec3 vNorm;
uniform vec3 uLight;
uniform float uTime;
void main() {
  vec3 n = normalize(vNorm);
  float d = max(dot(n, normalize(uLight)), 0.0);
  float a = 0.38;
  float spec = pow(max(dot(reflect(-normalize(uLight), n), vec3(0,0,1)), 0.0), 20.0) * 0.3;
  float rim = pow(1.0 - max(dot(n, vec3(0,1,0)), 0.0), 3.0) * 0.25;
  float pulse = 0.5 + 0.5 * sin(uTime * 0.7);
  vec3 rimC = mix(vec3(0.0,0.4,1.0), vec3(0.4,0.0,1.0), pulse);
  gl_FragColor = vec4(vCol * (a + d) + vec3(spec) + rimC * rim, 1.0);
}
`

// ─── Point Sprite Shader (3D GoL) ─────────────────────────────────────────────
const POINT_VERT = `
attribute vec3 aPos;
attribute vec3 aCol;
uniform mat4 uMVP;
uniform float uPointSize;
varying vec3 vCol;
void main() {
  gl_Position = uMVP * vec4(aPos, 1.0);
  gl_PointSize = uPointSize / gl_Position.w;
  vCol = aCol;
}
`
const POINT_FRAG = `
precision mediump float;
varying vec3 vCol;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float r = length(uv);
  if (r > 0.5) discard;
  float glow = 1.0 - smoothstep(0.25, 0.5, r);
  gl_FragColor = vec4(vCol * glow + vec3(glow * 0.4), glow * glow);
}
`

// ─── mat4 helpers ─────────────────────────────────────────────────────────────
function mat4id() { const m = new Float32Array(16); m[0]=m[5]=m[10]=m[15]=1; return m }
function mul(out, a, b) {
  for (let i=0; i<4; i++) for (let j=0; j<4; j++) {
    let s=0; for (let k=0; k<4; k++) s+=a[k*4+i]*b[j*4+k]; out[j*4+i]=s
  }; return out
}
function perspective(m, fov, asp, n, f) {
  const t=1/Math.tan(fov/2); m.fill(0)
  m[0]=t/asp; m[5]=t; m[10]=(f+n)/(n-f); m[11]=-1; m[14]=2*f*n/(n-f); return m
}
function lookAt(m, ex,ey,ez, cx,cy,cz) {
  let fx=cx-ex,fy=cy-ey,fz=cz-ez, l=Math.hypot(fx,fy,fz); fx/=l;fy/=l;fz/=l
  let rx=0*fz-1*fy,ry=1*fx-0*fz,rz=0*fy-0*fx; l=Math.hypot(rx,ry,rz)||1; rx/=l;ry/=l;rz/=l
  const ox=ry*fz-rz*fy,oy=rz*fx-rx*fz,oz=rx*fy-ry*fx
  m[0]=rx;m[1]=ox;m[2]=-fx;m[3]=0
  m[4]=ry;m[5]=oy;m[6]=-fy;m[7]=0
  m[8]=rz;m[9]=oz;m[10]=-fz;m[11]=0
  m[12]=-(rx*ex+ry*ey+rz*ez);m[13]=-(ox*ex+oy*ey+oz*ez);m[14]=(fx*ex+fy*ey+fz*ez);m[15]=1
  return m
}
function rotY(m, a) {
  m.fill(0); m[5]=m[15]=1
  m[0]=Math.cos(a); m[2]=Math.sin(a); m[8]=-Math.sin(a); m[10]=Math.cos(a); return m
}

function mkProgram(gl, vs, fs) {
  const mkShader = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
    return s
  }
  const p = gl.createProgram()
  gl.attachShader(p, mkShader(gl.VERTEX_SHADER, vs))
  gl.attachShader(p, mkShader(gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p))
  return p
}

// ─── Terrain geometry builder ──────────────────────────────────────────────────
function buildTerrain(state2d, automataType, numStates) {
  if (!state2d || !state2d.length) return null
  const rows = state2d.length
  const cols = state2d[0]?.length ?? 0
  if (!cols) return null

  const sx = 2.0 / cols, sz = 2.0 / rows
  const pos=[], nrm=[], col=[], idx=[]

  const getH = (v) => {
    if (automataType==='elementary') return v*0.7
    if (automataType==='bacteria') return [0,0.22,0.28,0.32,0.15,0.05][v]??0
    if (automataType==='traffic') return [0,0.15,0.22,0.35,0.3,0.3][v]??0
    if (automataType==='cyclic') return (v/(numStates||8))*0.65
    if (automataType==='brians_brain') return v===1?0.8:v===2?0.35:0
    if (automataType==='langtons_ant') return v>=2?0.6:v*0.2
    return v*0.4
  }
  const getC = (v, r, c) => {
    const hf=c/cols, vf=r/rows
    switch(automataType) {
      case 'bacteria': return [[.04,.04,.08],[.1,.8,.2],[.8,.5,.1],[.7,.1,.9],[.6,.9,.4],[.25,.12,.08]][v]||[.5,.5,.5]
      case 'traffic':  return [[.08,.08,.1],[.1,.5,1],[.1,.9,.4],[1,.3,.1],[.1,1,.2],[1,.2,.1]][v]||[.2,.2,.2]
      case 'game_of_life': return v?[.1+vf*.3,.7+hf*.3,.5]:[.02,.05,.04]
      case 'custom_2d':    return v?[.4,.1+hf*.5,.8]:[.03,.02,.06]
      case 'brians_brain': return v===1?[.9,.95,1]:v===2?[.2,.3,.9]:[.02,.01,.06]
      case 'cyclic': { const h=(v/(numStates||8))*6,i=Math.floor(h),f=h-i; const p=0,q=1-f,t=f; return [[1,t,p],[q,1,p],[p,1,t],[p,q,1],[t,p,1],[1,p,q]][i%6].map(x=>x*.75+.1) }
      case 'elementary': return v?[.4+hf*.4,.6,.9]:[.02,.02,.06]
      case 'langtons_ant': return v>=2?[1,.25,.35]:v?[.8,.45,.1]:[.08,.04,.01]
      default: return [.5,.5,.5]
    }
  }

  const vIdx = (r,c) => r*(cols+1)+c
  for (let r=0;r<=rows;r++) for (let c=0;c<=cols;c++) {
    const rr=Math.min(r,rows-1),cc=Math.min(c,cols-1)
    const v=Array.isArray(state2d[rr])?state2d[rr][cc]:0
    pos.push(c*sx-1, getH(v), r*sz-1)
    nrm.push(0,1,0)
    col.push(...getC(v,rr,cc))
  }
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
    const a=vIdx(r,c),b=vIdx(r,c+1),d=vIdx(r+1,c),e=vIdx(r+1,c+1)
    idx.push(a,d,b,b,d,e)
  }
  // Normals from triangles
  for (let i=0;i<idx.length;i+=3) {
    const i0=idx[i]*3,i1=idx[i+1]*3,i2=idx[i+2]*3
    const ax=pos[i1]-pos[i0],ay=pos[i1+1]-pos[i0+1],az=pos[i1+2]-pos[i0+2]
    const bx=pos[i2]-pos[i0],by=pos[i2+1]-pos[i0+1],bz=pos[i2+2]-pos[i0+2]
    const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx
    for (const ii of [i0,i1,i2]) { nrm[ii]+=nx;nrm[ii+1]+=ny;nrm[ii+2]+=nz }
  }
  for (let i=0;i<nrm.length;i+=3) { const l=Math.hypot(nrm[i],nrm[i+1],nrm[i+2])||1; nrm[i]/=l;nrm[i+1]/=l;nrm[i+2]/=l }

  return {
    pos: new Float32Array(pos), nrm: new Float32Array(nrm),
    col: new Float32Array(col), idx: new Uint32Array(idx), count: idx.length,
  }
}

// ─── 3D GoL point cloud ────────────────────────────────────────────────────────
function build3DPoints(positions, gridSize) {
  if (!positions || !positions.length) return null
  const N = gridSize || 18
  const scale = 2.0 / N
  const pos = [], col = []
  for (const [x,y,z] of positions) {
    pos.push((x+.5)*scale - 1, (y+.5)*scale - 1, (z+.5)*scale - 1)
    const h=(x/N)*6, i=Math.floor(h), f=h-i
    const R=[[1,f,0],[1-f,1,0],[0,1,f],[0,1-f,1],[f,0,1],[1,0,1-f]][i%6]
    col.push(R[0]*.9+.1, R[1]*.9+.1, R[2]*.9+.1)
  }
  return { pos: new Float32Array(pos), col: new Float32Array(col), count: positions.length }
}

// ─── React component ──────────────────────────────────────────────────────────
export default function Canvas3D({ data, currentGen }) {
  const canvasRef  = useRef(null)
  const glRef      = useRef(null)
  const progsRef   = useRef({})
  const bufsRef    = useRef({})
  const rafRef     = useRef(null)
  const angleRef   = useRef(0)
  const geomRef    = useRef(null)
  const ptRef      = useRef(null)
  const dragRef    = useRef({ down:false, lastX:0 })
  const errRef     = useRef(null)

  // ── Init WebGL once ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias:true, alpha:false })
    if (!gl) { errRef.current = 'WebGL not supported in this browser'; return }
    gl.getExtension('OES_element_index_uint')

    try {
      progsRef.current.terrain = mkProgram(gl, TERRAIN_VERT, TERRAIN_FRAG)
      progsRef.current.points  = mkProgram(gl, POINT_VERT,   POINT_FRAG)
    } catch(e) { errRef.current = 'Shader error: '+e.message; return }

    glRef.current = gl
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0.03, 0.02, 0.14, 1)

    const b = bufsRef.current
    b.tPos=gl.createBuffer(); b.tNrm=gl.createBuffer()
    b.tCol=gl.createBuffer(); b.tIdx=gl.createBuffer()
    b.pPos=gl.createBuffer(); b.pCol=gl.createBuffer()

    // Mouse drag
    const onDown = e => { dragRef.current.down=true; dragRef.current.lastX=e.clientX }
    const onMove = e => {
      if (!dragRef.current.down) return
      angleRef.current += (e.clientX - dragRef.current.lastX) * 0.007
      dragRef.current.lastX = e.clientX
    }
    const onUp = () => { dragRef.current.down=false }
    canvas.addEventListener('mousedown',onDown)
    canvas.addEventListener('mousemove',onMove)
    window.addEventListener('mouseup',onUp)
    return () => {
      canvas.removeEventListener('mousedown',onDown)
      canvas.removeEventListener('mousemove',onMove)
      window.removeEventListener('mouseup',onUp)
      if(rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // ── Upload geometry when data/gen changes ──────────────────────────────────
  useEffect(() => {
    const gl = glRef.current
    if (!gl || !data) return

    const b = bufsRef.current
    if (data.cells_3d) {
      // 3D Game of Life
      const alive = data.states[currentGen]
      const pt = build3DPoints(alive, data.grid_size)
      ptRef.current = pt
      geomRef.current = null
      if (pt) {
        gl.bindBuffer(gl.ARRAY_BUFFER, b.pPos); gl.bufferData(gl.ARRAY_BUFFER, pt.pos, gl.DYNAMIC_DRAW)
        gl.bindBuffer(gl.ARRAY_BUFFER, b.pCol); gl.bufferData(gl.ARRAY_BUFFER, pt.col, gl.DYNAMIC_DRAW)
      }
    } else {
      // 2D-based terrain
      const state2d = data.automata_type === 'elementary'
        ? [data.states[currentGen]]
        : data.states[currentGen]
      if (!state2d) return
      const g = buildTerrain(state2d, data.automata_type, data.num_states)
      geomRef.current = g
      ptRef.current   = null
      if (g) {
        gl.bindBuffer(gl.ARRAY_BUFFER, b.tPos); gl.bufferData(gl.ARRAY_BUFFER, g.pos, gl.DYNAMIC_DRAW)
        gl.bindBuffer(gl.ARRAY_BUFFER, b.tNrm); gl.bufferData(gl.ARRAY_BUFFER, g.nrm, gl.DYNAMIC_DRAW)
        gl.bindBuffer(gl.ARRAY_BUFFER, b.tCol); gl.bufferData(gl.ARRAY_BUFFER, g.col, gl.DYNAMIC_DRAW)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.tIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.DYNAMIC_DRAW)
      }
    }
  }, [data, currentGen])

  // ── Render loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    const gl = glRef.current
    if (!gl) return

    const proj = new Float32Array(16), view = new Float32Array(16)
    const rot  = new Float32Array(16), mv   = new Float32Array(16), mvp = new Float32Array(16)
    let t = 0

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)
      t += 0.016

      const canvas = canvasRef.current
      if (!canvas) return
      const W = canvas.clientWidth, H = canvas.clientHeight
      if (canvas.width !== W || canvas.height !== H) { canvas.width=W; canvas.height=H }

      gl.viewport(0, 0, W, H)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

      if (!dragRef.current.down) angleRef.current += 0.005

      perspective(proj, Math.PI/4.2, W/H||1, 0.05, 30)
      lookAt(view, 0,1.85,3.0, 0,0.08,0)
      rotY(rot, angleRef.current)
      mul(mv, view, rot); mul(mvp, proj, mv)

      const b = bufsRef.current
      const progs = progsRef.current

      if (ptRef.current && progs.points) {
        // Point sprite path (3D GoL)
        const pt = ptRef.current
        const prog = progs.points
        gl.useProgram(prog)
        const uMVP  = gl.getUniformLocation(prog,'uMVP')
        const uPS   = gl.getUniformLocation(prog,'uPointSize')
        gl.uniformMatrix4fv(uMVP, false, mvp)
        gl.uniform1f(uPS, Math.max(W,H) * 0.04)

        const bindA = (buf, name, sz) => {
          const loc = gl.getAttribLocation(prog, name); if(loc<0) return
          gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc)
          gl.vertexAttribPointer(loc, sz, gl.FLOAT, false, 0, 0)
        }
        bindA(b.pPos,'aPos',3); bindA(b.pCol,'aCol',3)
        gl.drawArrays(gl.POINTS, 0, pt.count)

      } else if (geomRef.current && progs.terrain) {
        // Terrain path (2D types)
        const g = geomRef.current
        const prog = progs.terrain
        gl.useProgram(prog)
        const uMVP  = gl.getUniformLocation(prog,'uMVP')
        const uTime = gl.getUniformLocation(prog,'uTime')
        const uLight= gl.getUniformLocation(prog,'uLight')
        gl.uniformMatrix4fv(uMVP, false, mvp)
        gl.uniform1f(uTime, t)
        gl.uniform3f(uLight, Math.sin(t*.3)*1.5, 2.0, Math.cos(t*.3)*1.5)

        const bindA = (buf, name, sz) => {
          const loc = gl.getAttribLocation(prog, name); if(loc<0) return
          gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc)
          gl.vertexAttribPointer(loc, sz, gl.FLOAT, false, 0, 0)
        }
        bindA(b.tPos,'aPos',3); bindA(b.tNrm,'aNorm',3); bindA(b.tCol,'aCol',3)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.tIdx)
        gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_INT, 0)
      }
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  if (errRef.current) {
    return (
      <div className="canvas3d-wrap" style={{justifyContent:'center'}}>
        <div style={{color:'#ff6060',fontSize:'0.85rem',textAlign:'center',padding:'20px'}}>
          ⚠ 3D unavailable: {errRef.current}
        </div>
      </div>
    )
  }

  return (
    <div className="canvas3d-wrap">
      <canvas ref={canvasRef} className="canvas3d" style={{width:'100%',height:'100%'}} />
      <div className="canvas3d-hint">Drag to rotate · auto-rotating</div>
      {data?.cells_3d && (
        <div className="canvas3d-stats">
          {data.populations?.[currentGen] ?? 0} alive cells
          {data.born_counts?.[currentGen] ? ` · +${data.born_counts[currentGen]} born` : ''}
          {data.died_counts?.[currentGen] ? ` · -${data.died_counts[currentGen]} died` : ''}
        </div>
      )}
    </div>
  )
}
