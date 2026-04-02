import { useState } from 'react'

const FAMOUS = [
  { rule: 'B3/S23',      name: "Conway's Life",  desc: "The classic. Gliders, oscillators, infinite complexity." },
  { rule: 'B36/S23',     name: 'HighLife',        desc: "Like Life but with self-replicating spaceships." },
  { rule: 'B2/S',        name: 'Seeds',           desc: "Every cell dies instantly. Creates explosive birth cascades." },
  { rule: 'B3/S12345',   name: 'Maze',            desc: "Grows labyrinthine corridors from sparse seeds." },
  { rule: 'B3678/S34678',name: 'Day & Night',     desc: "Dead and alive regions behave identically — perfect symmetry." },
  { rule: 'B35678/S5678',name: 'Diamoeba',        desc: "Diamond-shaped amoeba blobs that drift and divide." },
  { rule: 'B368/S245',   name: 'Morley',          desc: "Has gliders and complex periodic objects." },
  { rule: 'B1357/S1357', name: 'Replicator',      desc: "Exponential self-replication — everything copies itself." },
  { rule: 'B3/S45678',   name: 'Long Life',       desc: "Stable structures persist much longer than in standard Life." },
  { rule: 'B34/S34',     name: '34 Life',         desc: "Slow, clumpy — forms large stable regions." },
]

function parseBSRule(str) {
  const s = str.toUpperCase().replace(/\s/g, '')
  if (!s.includes('/')) return null
  const [bp, sp] = s.split('/')
  const birth = (bp?.replace('B', '') || '').split('').filter(c => /\d/.test(c)).map(Number)
  const surv  = (sp?.replace('S', '') || '').split('').filter(c => /\d/.test(c)).map(Number)
  return { birth: [...new Set(birth)].sort(), surv: [...new Set(surv)].sort() }
}

function RuleViz({ ruleStr }) {
  const parsed = parseBSRule(ruleStr)
  if (!parsed) return null
  const { birth, surv } = parsed

  return (
    <div className="rule-viz">
      <div className="rule-viz-row">
        <span className="rv-label rv-birth">Born</span>
        <div className="rv-cells">
          {Array.from({ length: 9 }, (_, n) => (
            <div key={n} className={`rv-cell ${birth.includes(n) ? 'on' : 'off'}`}>
              <span className="rv-num">{n}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rule-viz-row">
        <span className="rv-label rv-surv">Survive</span>
        <div className="rv-cells">
          {Array.from({ length: 9 }, (_, n) => (
            <div key={n} className={`rv-cell ${surv.includes(n) ? 'on' : 'off'}`}>
              <span className="rv-num">{n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CustomRuleBuilder({ bsRule, onChange }) {
  const [input, setInput] = useState(bsRule || 'B3/S23')
  const [error, setError] = useState('')

  const validate = (val) => {
    setInput(val)
    const parsed = parseBSRule(val)
    if (!parsed) {
      setError('Use format: B{digits}/S{digits}  e.g. B3/S23')
      return
    }
    setError('')
    const canonical = `B${parsed.birth.join('')}/S${parsed.surv.join('')}`
    onChange({ bs_rule: canonical })
  }

  const pick = (rule) => {
    setInput(rule)
    setError('')
    onChange({ bs_rule: rule })
  }

  return (
    <div className="custom-rule-builder">
      {/* Guide */}
      <div className="crb-guide">
        <div className="crb-guide-title">How B/S notation works</div>
        <div className="crb-guide-body">
          <p>
            Each cell checks how many of its <strong>8 neighbors</strong> are alive (0–8).
          </p>
          <div className="crb-notation">
            <div className="crb-notation-item">
              <span className="crb-tag crb-tag-b">B</span>
              <span><strong>Born:</strong> dead cell with exactly these many live neighbors becomes alive</span>
            </div>
            <div className="crb-notation-item">
              <span className="crb-tag crb-tag-s">S</span>
              <span><strong>Survive:</strong> live cell with exactly these many live neighbors stays alive</span>
            </div>
          </div>
          <p className="crb-example">
            <code>B3/S23</code> → born with 3 neighbors, survives with 2 or 3.<br />
            This is Conway's Game of Life.
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="crb-input-wrap">
        <label className="crb-input-label">Rule string</label>
        <input
          className={`crb-input ${error ? 'crb-input-err' : ''}`}
          value={input}
          onChange={(e) => validate(e.target.value)}
          placeholder="B3/S23"
          spellCheck={false}
        />
        {error && <div className="crb-error">{error}</div>}
      </div>

      {/* Live visualization */}
      <RuleViz ruleStr={input} />

      {/* Famous rules */}
      <div className="crb-famous-label">Famous rules — click to use</div>
      <div className="crb-famous">
        {FAMOUS.map((f) => (
          <button
            key={f.rule}
            className={`crb-famous-btn ${input === f.rule ? 'active' : ''}`}
            onClick={() => pick(f.rule)}
            title={f.desc}
          >
            <span className="crb-famous-name">{f.name}</span>
            <code className="crb-famous-code">{f.rule}</code>
          </button>
        ))}
      </div>
    </div>
  )
}
