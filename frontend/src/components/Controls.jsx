const SPEEDS = [1, 2, 5, 10, 20, 30, 60]

function Ico({ d, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d={d} />
    </svg>
  )
}

const D = {
  play:    'M8 5v14l11-7z',
  pause:   'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  stop:    'M6 6h12v12H6z',
  stepB:   'M6 6h2v12H6zm3.5 6 8.5 6V6z',
  stepF:   'M18 6h-2v12h2zm-3.5 6L6 6v12z',
  reset:   'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',
  loop:    'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z',
  refresh: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
}

export default function Controls({
  isPlaying, onPlay, onPause, onStop, onRefresh,
  onStepBack, onStepForward, onReset,
  looping, onToggleLoop,
  speed, onSpeedChange,
  frameLabel = 'Gen',
  currentGen, totalGenerations,
  disabled, accent,
}) {
  return (
    <div className="controls-bar">
      <div className="controls-row">

        {/* Left: playback */}
        <div className="btn-group">
          <button className="ctrl-btn" onClick={onReset} disabled={disabled} title="Go to start">
            <Ico d={D.reset} />
          </button>

          <button className="ctrl-btn" onClick={onStepBack}
            disabled={disabled || currentGen === 0} title="Step back">
            <Ico d={D.stepB} />
          </button>

          <button
            className={`ctrl-btn play-btn ${isPlaying ? 'active' : ''}`}
            onClick={isPlaying ? onPause : onPlay}
            disabled={disabled}
            title={isPlaying ? 'Pause' : 'Play'}
            style={!disabled ? { borderColor: accent, color: accent } : {}}
          >
            <Ico d={isPlaying ? D.pause : D.play} size={20} />
          </button>

          <button className="ctrl-btn" onClick={onStepForward}
            disabled={disabled || currentGen >= totalGenerations - 1} title="Step forward">
            <Ico d={D.stepF} />
          </button>

          {/* Stop — goes to gen 0 + stops */}
          <button className="ctrl-btn ctrl-btn-stop" onClick={onStop}
            disabled={disabled} title="Stop (reset to start)">
            <Ico d={D.stop} />
          </button>

          <button className={`ctrl-btn ${looping ? 'loop-active' : ''}`}
            onClick={onToggleLoop} disabled={disabled}
            title={looping ? 'Loop on' : 'Loop off'}
            style={looping ? { borderColor: accent, color: accent } : {}}>
            <Ico d={D.loop} />
          </button>
        </div>

        {/* Center: generation counter */}
        <div className="gen-info">
          <span className="gen-label">{frameLabel}</span>
          <span className="gen-value" style={{ color: accent }}>{currentGen + 1}</span>
          <span className="gen-sep">/</span>
          <span className="gen-total">{totalGenerations}</span>
        </div>

        {/* Right: refresh + speed */}
        <div className="right-ctrls">
          <button className="ctrl-btn ctrl-btn-refresh" onClick={onRefresh}
            disabled={disabled} title="Re-run simulation with same config">
            <Ico d={D.refresh} />
          </button>

          <div className="speed-ctrl">
            <span className="speed-label">Speed</span>
            <div className="speed-btns">
              {SPEEDS.map((s) => (
                <button key={s}
                  className={`speed-btn ${speed === s ? 'active' : ''}`}
                  onClick={() => onSpeedChange(s)}
                  style={speed === s ? { borderColor: accent, color: accent, background: `${accent}18` } : {}}>
                  {s >= 60 ? 'MAX' : `${s}×`}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
