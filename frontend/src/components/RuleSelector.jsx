import { useState } from 'react'
import CustomRuleBuilder from './CustomRuleBuilder'

const TYPE_COLORS = {
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

const TYPE_DIM = {
  elementary:   '1D',
  game_of_life: '2D',
  brians_brain: '2D',
  cyclic:       '2D',
  langtons_ant: '2D',
  custom_2d:    '2D',
  bacteria:     'BIO',
  traffic:      'SIM',
  image_ca:     'ART',
  life_3d:      '3D',
  epidemic:     'GEO',
}

// ─── Rule bitmap for elementary 1D ───────────────────────────────────────────
function RuleBitmap({ rule }) {
  const patterns = ['111', '110', '101', '100', '011', '010', '001', '000']
  return (
    <div className="rule-bitmap">
      <div className="rb-header">
        <span>Pattern (left, center, right) → Output</span>
      </div>
      {patterns.map((pat, i) => {
        const bit = (rule >> (7 - i)) & 1
        return (
          <div key={pat} className={`rule-bit-cell ${bit ? 'rb-on' : 'rb-off'}`}>
            <div className="rule-bit-pattern">
              {pat.split('').map((b, j) => (
                <span key={j} className={`bit-dot ${b === '1' ? 'on' : 'off'}`} />
              ))}
            </div>
            <div className="rb-arrow">→</div>
            <div className={`rule-bit-output ${bit ? 'on' : 'off'}`} />
          </div>
        )
      })}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RuleSelector({ config, onChange, rulesData }) {
  const [customRule, setCustomRule] = useState(String(config.rule ?? 110))
  const accent = TYPE_COLORS[config.automata_type] || '#00d4ff'

  const handleTypeChange = (type) => {
    const genMap = {
      elementary: 160, game_of_life: 200, brians_brain: 150, cyclic: 200,
      langtons_ant: 400, custom_2d: 200, bacteria: 150, traffic: 200,
      image_ca: 120, life_3d: 80, epidemic: 320,
    }
    const base = {
      automata_type: type,
      initial_state: type === 'elementary' ? 'single_cell' : 'random',
      rule: 110,
      width: ['life_3d','epidemic'].includes(type) ? 120 : 120,
      height: ['life_3d','epidemic'].includes(type) ? 80 : 80,
      generations: genMap[type] ?? 160,
      num_states: 8,
      threshold: 1,
      neighborhood: 'moore',
      num_ants: 1,
      bs_rule: 'B3/S23',
      density: type === 'life_3d' ? 0.10 : 0.3,
      // bacteria defaults
      num_strains: 3,
      spread_rate: 0.55,
      death_rate: 0.08,
      nutrient_density: 0.15,
      // traffic defaults
      num_lanes: 4,
      car_density: 0.25,
      max_speed: 3,
      brake_prob: 0.15,
      light_period: 12,
      // image_ca defaults
      palette_name: 'cosmic',
      image_rule: 'cyclic',
      seed_type: 'random',
      // life_3d defaults
      grid_size: 18,
      rule_3d: '445',
    }
    onChange(base)
  }

  const handlePreset = (preset) => {
    const update = { ...preset }
    delete update.name
    if (update.rule !== undefined) setCustomRule(String(update.rule))
    onChange(update)
  }

  const types   = rulesData?.automata_types ?? []
  const presets = rulesData?.presets?.[config.automata_type] ?? []

  return (
    <div className="rule-selector">

      {/* ── Type selector ─── */}
      <div className="section">
        <div className="section-label">Automata Type</div>
        <div className="type-grid">
          {types.map((t) => {
            const active = config.automata_type === t.id
            return (
              <button
                key={t.id}
                className={`type-card ${active ? 'active' : ''}`}
                style={active ? { borderColor: TYPE_COLORS[t.id], boxShadow: `0 0 12px ${TYPE_COLORS[t.id]}44` } : {}}
                onClick={() => handleTypeChange(t.id)}
              >
                <span
                  className="type-card-dim"
                  style={{ background: TYPE_COLORS[t.id], color: '#000' }}
                >
                  {TYPE_DIM[t.id]}
                </span>
                <span className="type-card-name" style={active ? { color: TYPE_COLORS[t.id] } : {}}>
                  {t.name}
                </span>
              </button>
            )
          })}
        </div>
        {types.find((t) => t.id === config.automata_type) && (
          <p className="type-desc">{types.find((t) => t.id === config.automata_type).description}</p>
        )}
      </div>

      {/* ── Elementary: rule picker + bitmap ─── */}
      {config.automata_type === 'elementary' && (
        <div className="section">
          <div className="section-label">Rule (0 – 255)</div>
          <div className="rule-input-row">
            <input
              type="number" min={0} max={255}
              value={customRule}
              onChange={(e) => {
                setCustomRule(e.target.value)
                const n = parseInt(e.target.value, 10)
                if (!isNaN(n) && n >= 0 && n <= 255) onChange({ rule: n })
              }}
              className="rule-number-input"
              style={{ borderColor: accent }}
            />
            <div className="rule-number-display" style={{ color: accent }}>#{config.rule}</div>
          </div>
          <input type="range" min={0} max={255} value={config.rule}
            className="rule-slider" style={{ accentColor: accent }}
            onChange={(e) => { setCustomRule(e.target.value); onChange({ rule: parseInt(e.target.value) }) }}
          />
          <RuleBitmap rule={config.rule} />
        </div>
      )}

      {/* ── Cyclic: num_states + threshold ─── */}
      {config.automata_type === 'cyclic' && (
        <div className="section">
          <div className="section-label">Cyclic Parameters</div>
          <div className="field">
            <label>States: {config.num_states}</label>
            <input type="range" min={3} max={20} value={config.num_states}
              style={{ accentColor: accent }}
              onChange={(e) => onChange({ num_states: parseInt(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Threshold: {config.threshold}</label>
            <input type="range" min={1} max={6} value={config.threshold}
              style={{ accentColor: accent }}
              onChange={(e) => onChange({ threshold: parseInt(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Neighborhood</label>
            <div className="radio-row">
              {['moore', 'vonneumann'].map((nb) => (
                <label key={nb} className={`radio-label ${config.neighborhood === nb ? 'active' : ''}`}
                  style={config.neighborhood === nb ? { borderColor: accent, color: accent } : {}}>
                  <input type="radio" name="nb" value={nb}
                    checked={config.neighborhood === nb}
                    onChange={() => onChange({ neighborhood: nb })}
                  />
                  {nb === 'moore' ? 'Moore (8)' : 'Von Neumann (4)'}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Langton's Ant: num_ants ─── */}
      {config.automata_type === 'langtons_ant' && (
        <div className="section">
          <div className="section-label">Ants</div>
          <div className="field">
            <label>Number of ants: {config.num_ants}</label>
            <input type="range" min={1} max={8} value={config.num_ants}
              style={{ accentColor: accent }}
              onChange={(e) => onChange({ num_ants: parseInt(e.target.value) })}
            />
          </div>
          <p className="type-desc">
            Each ant turns right on white cells and left on black cells, flipping the cell color.
            After ~10,000 steps a single ant enters an infinite periodic "highway".
            Multiple ants create chaotic interaction patterns.
          </p>
        </div>
      )}

      {/* ── Custom 2D: B/S rule builder ─── */}
      {config.automata_type === 'custom_2d' && (
        <div className="section">
          <CustomRuleBuilder bsRule={config.bs_rule} onChange={onChange} />
        </div>
      )}

      {/* ── Bacteria params ─── */}
      {config.automata_type === 'bacteria' && (
        <div className="section">
          <div className="section-label">Bacterial Culture Parameters</div>
          <div className="bacteria-legend">
            {[
              {col:'#20cc40',label:'Strain A — aggressive spreader'},
              {col:'#cc8010',label:'Strain B — nutrient dependent'},
              {col:'#9010cc',label:'Strain C — resistant'},
              {col:'#80dd30',label:'Nutrient patches'},
              {col:'#553322',label:'Dead / consumed cells'},
            ].map(e => (
              <div key={e.label} className="bact-legend-row">
                <span className="bact-dot" style={{background:e.col}} />
                <span>{e.label}</span>
              </div>
            ))}
          </div>
          <SliderField label={`Strains: ${config.num_strains}`} min={1} max={3} value={config.num_strains}
            accent={accent} onChange={v => onChange({num_strains:v})} />
          <SliderField label={`Spread rate: ${Math.round(config.spread_rate*100)}%`}
            min={10} max={95} value={Math.round(config.spread_rate*100)}
            accent={accent} onChange={v => onChange({spread_rate:v/100})} />
          <SliderField label={`Death rate: ${Math.round(config.death_rate*100)}%`}
            min={0} max={50} value={Math.round(config.death_rate*100)}
            accent={accent} onChange={v => onChange({death_rate:v/100})} />
          <SliderField label={`Nutrient density: ${Math.round(config.nutrient_density*100)}%`}
            min={0} max={50} value={Math.round(config.nutrient_density*100)}
            accent={accent} onChange={v => onChange({nutrient_density:v/100})} />
        </div>
      )}

      {/* ── Traffic params ─── */}
      {config.automata_type === 'traffic' && (
        <div className="section">
          <div className="section-label">Traffic Parameters</div>
          <div className="bacteria-legend">
            {[
              {col:'#1050ee',label:'Slow car (speed 1)'},
              {col:'#10dd60',label:'Medium car (speed 2)'},
              {col:'#ee3010',label:'Fast car (speed 3)'},
              {col:'#00cc33',label:'Green light (H traffic)'},
              {col:'#cc1010',label:'Red light (V traffic)'},
            ].map(e => (
              <div key={e.label} className="bact-legend-row">
                <span className="bact-dot" style={{background:e.col}} />
                <span>{e.label}</span>
              </div>
            ))}
          </div>
          <SliderField label={`Lanes: ${config.num_lanes}`} min={2} max={8} value={config.num_lanes}
            accent={accent} onChange={v => onChange({num_lanes:v})} />
          <SliderField label={`Car density: ${Math.round(config.car_density*100)}%`}
            min={5} max={80} value={Math.round(config.car_density*100)}
            accent={accent} onChange={v => onChange({car_density:v/100})} />
          <SliderField label={`Max speed: ${config.max_speed}`} min={1} max={5} value={config.max_speed}
            accent={accent} onChange={v => onChange({max_speed:v})} />
          <SliderField label={`Brake prob: ${Math.round(config.brake_prob*100)}%`}
            min={0} max={50} value={Math.round(config.brake_prob*100)}
            accent={accent} onChange={v => onChange({brake_prob:v/100})} />
          <SliderField label={`Light period: ${config.light_period}`} min={4} max={40} value={config.light_period}
            accent={accent} onChange={v => onChange({light_period:v})} />
        </div>
      )}

      {/* ── Image CA params ─── */}
      {config.automata_type === 'image_ca' && (
        <div className="section">
          <div className="section-label">Image Formation Parameters</div>
          <div className="field">
            <label>Color Palette</label>
            <div className="palette-grid">
              {['cosmic','fire','ocean','forest','neon','magma'].map(p => (
                <button key={p}
                  className={`palette-btn ${config.palette_name===p?'active':''}`}
                  style={config.palette_name===p ? {borderColor:accent} : {}}
                  onClick={() => onChange({palette_name:p})}>
                  <span className={`palette-swatch pal-${p}`} />
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Evolution Rule</label>
            {[
              {v:'cyclic',      label:'Cyclic Spirals',    desc:'Self-organizing rotating waves'},
              {v:'smooth_life', label:'Smooth Life',       desc:'Organic membranes and blobs'},
              {v:'diffusion',   label:'Diffusion',         desc:'Ink-drop spreading patterns'},
              {v:'turing',      label:'Turing Patterns',   desc:'Reaction-diffusion spots & stripes'},
            ].map(r => (
              <label key={r.v} className={`radio-label-block ${config.image_rule===r.v?'active':''}`}
                style={config.image_rule===r.v?{borderColor:accent}:{}}>
                <input type="radio" name="imgRule" value={r.v}
                  checked={config.image_rule===r.v}
                  onChange={() => onChange({image_rule:r.v})} />
                <span className="rlb-name">{r.label}</span>
                <span className="rlb-desc">{r.desc}</span>
              </label>
            ))}
          </div>
          <div className="field">
            <label>Seed Pattern</label>
            <select className="select-input" value={config.seed_type}
              onChange={e => onChange({seed_type:e.target.value})}>
              <option value="random">Random noise</option>
              <option value="center_burst">Center burst (rings)</option>
              <option value="gradient">Diagonal gradient</option>
              <option value="stripes">Vertical stripes</option>
            </select>
          </div>
          <SliderField label={`Color states: ${config.num_states}`}
            min={4} max={20} value={config.num_states}
            accent={accent} onChange={v => onChange({num_states:v})} />
        </div>
      )}

      {/* ── 3D Game of Life params ─── */}
      {config.automata_type === 'life_3d' && (
        <div className="section">
          <div className="section-label">3D Rule Variant</div>
          {[
            {v:'445',        label:'445',        desc:'Classic sparse — birth on 4, survive on 4-5'},
            {v:'5766',       label:'5766',        desc:'Dense structures — birth 5-6, survive 6-8'},
            {v:'B5S45',      label:'B5/S45',      desc:'Life-like growth — birth 5, survive 4-5'},
            {v:'amoeba',     label:'Amoeba',      desc:'Blob dynamics — birth 3-5, survive 4-8'},
            {v:'crystal',    label:'Crystal',     desc:'Crystal growth — birth 6, survive 5-7'},
            {v:'pyroclastic',label:'Pyroclastic', desc:'Explosive — birth 4-7, survive 6-9'},
          ].map(r => (
            <label key={r.v} className={`radio-label-block ${config.rule_3d===r.v?'active':''}`}
              style={config.rule_3d===r.v?{borderColor:accent}:{}}>
              <input type="radio" name="rule3d" value={r.v}
                checked={config.rule_3d===r.v}
                onChange={() => onChange({rule_3d:r.v})} />
              <span className="rlb-name">{r.label}</span>
              <span className="rlb-desc">{r.desc}</span>
            </label>
          ))}
          <div className="section-label" style={{marginTop:'12px'}}>Grid Size</div>
          <SliderField label={`${config.grid_size}³ = ${config.grid_size**3} cells`}
            min={8} max={26} step={2}
            value={config.grid_size} accent={accent} onChange={v => onChange({grid_size:v})} />
          <SliderField label={`Seed density: ${Math.round((config.density||0.10)*100)}%`}
            min={3} max={25} value={Math.round((config.density||0.10)*100)}
            accent={accent} onChange={v => onChange({density:v/100})} />
          <p className="type-desc">
            Drag to rotate · point-sprite glow rendering · 26-neighbor Moore neighborhood
          </p>
        </div>
      )}

      {/* ── Epidemic params ─── */}
      {config.automata_type === 'epidemic' && (
        <div className="section">
          <div className="section-label">COVID-19 Simulation</div>
          <div className="epi-info-box">
            <div className="epi-info-row"><span className="epi-dot" style={{background:'#0066ff'}} />Low infection rate</div>
            <div className="epi-info-row"><span className="epi-dot" style={{background:'#ffcc00'}} />Moderate spread</div>
            <div className="epi-info-row"><span className="epi-dot" style={{background:'#ff2020'}} />High infection rate</div>
            <div className="epi-info-row"><span className="epi-dot" style={{background:'#33cc33'}} />Vaccination arc</div>
          </div>
          <div className="field" style={{marginTop:'10px'}}>
            <label>Simulation horizon</label>
            <div className="radio-row" style={{flexDirection:'column',gap:'6px'}}>
              {[
                {v:130, label:'Wave Focus (2020–2022)'},
                {v:200, label:'Historic (2019–2023)'},
                {v:260, label:'To Present (2019–2024)'},
                {v:320, label:'Full Story (2019–2026)'},
              ].map(o => (
                <label key={o.v} className={`radio-label ${config.generations===o.v?'active':''}`}
                  style={config.generations===o.v?{borderColor:accent,color:accent}:{}}>
                  <input type="radio" name="epiHorizon" value={o.v}
                    checked={config.generations===o.v}
                    onChange={() => onChange({generations:o.v})} />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
          <p className="type-desc">
            SEIR-CA model with 50 countries. Fetches real WHO data from disease.sh.
            Includes 8 epidemic phases: Pre-pandemic → Lockdowns → Vaccines → Delta → Omicron → Endemic → Forecast.
          </p>
        </div>
      )}

      {/* ── Presets ─── */}
      {presets.length > 0 && (
        <div className="section">
          <div className="section-label">Presets</div>
          <div className="preset-list">
            {presets.map((p) => (
              <button key={p.name} className="preset-btn" onClick={() => handlePreset(p)}>
                <span className="preset-dot" style={{ background: accent }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Grid / simulation config ─── */}
      {!['life_3d', 'epidemic'].includes(config.automata_type) && (
      <div className="section">
        <div className="section-label">Grid & Simulation</div>

        {config.automata_type === 'elementary' ? (
          <>
            <SliderField label="Width" min={50} max={250} step={10}
              value={config.width} accent={accent} onChange={v => onChange({width:v})} />
            <SliderField label="Generations" min={50} max={500} step={10}
              value={config.generations} accent={accent} onChange={v => onChange({generations:v})} />
            <div className="field">
              <label>Initial State</label>
              <select value={config.initial_state}
                onChange={e => onChange({initial_state:e.target.value})} className="select-input">
                <option value="single_cell">Single center cell</option>
                <option value="random">Random</option>
                <option value="alternating">Alternating</option>
                <option value="two_cells">Two cells</option>
              </select>
            </div>
            {config.initial_state === 'random' && (
              <SliderField label={`Density ${Math.round(config.density*100)}%`}
                min={5} max={95} value={Math.round(config.density*100)}
                accent={accent} onChange={v => onChange({density:v/100})} />
            )}
          </>
        ) : config.automata_type === 'langtons_ant' ? (
          <>
            <SliderField label="Width"  min={40} max={250} step={5}
              value={config.width} accent={accent} onChange={v => onChange({width:v})} />
            <SliderField label="Height" min={40} max={200} step={5}
              value={config.height} accent={accent} onChange={v => onChange({height:v})} />
            <SliderField label="Steps"  min={100} max={600} step={50}
              value={config.generations} accent={accent} onChange={v => onChange({generations:v})} />
          </>
        ) : config.automata_type === 'traffic' ? (
          <>
            <SliderField label="Width"  min={30} max={200} step={5}
              value={config.width} accent={accent} onChange={v => onChange({width:v})} />
            <SliderField label="Height" min={30} max={150} step={5}
              value={config.height} accent={accent} onChange={v => onChange({height:v})} />
            <SliderField label="Steps"  min={50} max={600} step={10}
              value={config.generations} accent={accent} onChange={v => onChange({generations:v})} />
          </>
        ) : config.automata_type === 'image_ca' ? (
          <>
            <SliderField label="Width"  min={40} max={200} step={10}
              value={config.width} accent={accent} onChange={v => onChange({width:v})} />
            <SliderField label="Height" min={40} max={150} step={10}
              value={config.height} accent={accent} onChange={v => onChange({height:v})} />
            <SliderField label="Frames" min={20} max={300} step={10}
              value={config.generations} accent={accent} onChange={v => onChange({generations:v})} />
          </>
        ) : (
          <>
            <SliderField label="Width"  min={20} max={200} step={5}
              value={config.width} accent={accent} onChange={v => onChange({width:v})} />
            <SliderField label="Height" min={20} max={150} step={5}
              value={config.height} accent={accent} onChange={v => onChange({height:v})} />
            <SliderField label="Generations" min={50} max={600} step={10}
              value={config.generations} accent={accent} onChange={v => onChange({generations:v})} />
            {!['cyclic','bacteria'].includes(config.automata_type) && (
              <SliderField label={`Density ${Math.round(config.density*100)}%`}
                min={5} max={90} value={Math.round(config.density*100)}
                accent={accent} onChange={v => onChange({density:v/100})} />
            )}
          </>
        )}
      </div>
      )}

      {/* life_3d generation count is in the 3D params section */}
      {config.automata_type === 'life_3d' && (
        <div className="section">
          <div className="section-label">Generations</div>
          <SliderField label={`${config.generations} frames`}
            min={20} max={150} step={10}
            value={config.generations} accent={accent} onChange={v => onChange({generations:v})} />
        </div>
      )}

    </div>
  )
}

function SliderField({ label, min, max, step = 1, value, accent, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="slider-row">
        <input type="range" min={min} max={max} step={step} value={value}
          style={{ accentColor: accent }}
          onChange={(e) => onChange(parseInt(e.target.value))}
        />
        <span>{value}</span>
      </div>
    </div>
  )
}
