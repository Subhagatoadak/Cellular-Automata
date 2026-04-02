export default function Timeline({ currentGen, totalGenerations, onChange, accent }) {
  const pct = totalGenerations > 1 ? (currentGen / (totalGenerations - 1)) * 100 : 0

  return (
    <div className="timeline-wrap">
      <span className="timeline-label">0</span>
      <div className="timeline-track">
        <div
          className="timeline-fill"
          style={{ width: `${pct}%`, background: accent }}
        />
        <input
          type="range"
          min={0}
          max={totalGenerations - 1}
          value={currentGen}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="timeline-input"
          style={{ accentColor: accent }}
        />
      </div>
      <span className="timeline-label">{totalGenerations}</span>
    </div>
  )
}
