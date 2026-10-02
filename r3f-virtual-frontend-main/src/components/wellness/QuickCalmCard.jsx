import { useState, useEffect, useRef } from 'react';
import { playTick, hapticPhase, playComplete } from '../../lib/feedback';

const BREATH_PHASES = ['Inhale', 'Hold', 'Exhale', 'Hold'];
const BREATH_HINTS  = ['breathe in slowly…', 'hold gently…', 'breathe out slowly…', 'rest quietly…'];
const BREATH_COLORS = ['#38bdf8', '#1687d8', '#0f6bb2', '#7dd3fc'];
const BREATH_CYCLES = 4;
const PHASE_SECS    = 4;
const CYCLE_SECS    = BREATH_PHASES.length * PHASE_SECS; // 16
const TOTAL_SECS    = CYCLE_SECS * BREATH_CYCLES;        // 64

const BLOB_SCALE = [1.22, 1.22, 0.82, 0.82];

function blobPath(radii, cx, cy) {
  const n = radii.length;
  const pts = radii.map((r, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
  let d = `M ${pts[0][0]},${pts[0][1]} `;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]} `;
  }
  return d + 'Z';
}

const BLOB_VARIANTS = [
  [46, 50, 42, 48, 44, 52, 40, 47],
  [50, 44, 48, 40, 52, 42, 49, 45],
  [42, 48, 52, 44, 46, 40, 50, 47],
  [48, 42, 46, 50, 40, 48, 44, 52],
  [44, 52, 40, 46, 48, 44, 50, 42],
].map((radii) => blobPath(radii, 50, 50));
const BLOB_ANIM_VALUES = [...BLOB_VARIANTS, BLOB_VARIANTS[0]].join(';');
const BLOB_KEYSPLINES  = Array(BLOB_VARIANTS.length).fill('0.45 0 0.55 1').join(';');

function BlobBreathVisual({ phaseColor, scale, countDown, phaseLabel, size }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: `scale(${scale})`, transition: 'transform 4s cubic-bezier(0.45,0,0.55,1)' }}
      >
        <svg width={size} height={size} viewBox="0 0 100 100" overflow="visible">
          <circle cx="50" cy="50" r="46" fill={phaseColor} opacity="0.14"
                  style={{ transition: 'fill 1.4s ease', filter: 'blur(6px)' }} />
          <path
            fill={phaseColor}
            fillOpacity="0.9"
            style={{ transition: 'fill 1.4s ease', filter: `drop-shadow(0 6px 18px ${phaseColor}66)` }}
          >
            <animate attributeName="d" values={BLOB_ANIM_VALUES} dur="7s"
                     repeatCount="indefinite" calcMode="spline" keySplines={BLOB_KEYSPLINES} />
          </path>
        </svg>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-bold tabular-nums transition-colors"
              style={{ color: '#fff', lineHeight: 1, textShadow: '0 1px 6px rgba(0,0,0,0.25)' }}>
          {countDown}
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest transition-colors"
              style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
          {phaseLabel}
        </span>
      </div>
    </div>
  );
}

const FLOWER_PETAL_COUNT = 8;
const FLOWER_OPENNESS = [1, 1, 0.32, 0.32];
const FLOWER_PETAL_PATH = 'M50,50 C44,38 42,20 50,6 C58,20 56,38 50,50 Z';

function FlowerBreathVisual({ phaseColor, openness, countDown, phaseLabel, size }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: `scale(${openness})`, transition: 'transform 4s cubic-bezier(0.45,0,0.55,1)' }}
      >
        <svg width={size} height={size} viewBox="0 0 100 100" overflow="visible">
          <circle cx="50" cy="50" r="40" fill={phaseColor} opacity="0.12"
                  style={{ transition: 'fill 1.4s ease', filter: 'blur(8px)' }} />
          {Array.from({ length: FLOWER_PETAL_COUNT }).map((_, i) => {
            const angle = (i * 360) / FLOWER_PETAL_COUNT;
            return (
              <g key={i} transform={`rotate(${angle} 50 50)`}>
                <g>
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    values="-3 50 50;3 50 50;-3 50 50"
                    dur="5s"
                    begin={`${i * 0.18}s`}
                    repeatCount="indefinite"
                    calcMode="spline"
                    keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
                  />
                  <path
                    d={FLOWER_PETAL_PATH}
                    fill={phaseColor}
                    fillOpacity="0.88"
                    style={{ transition: 'fill 1.4s ease' }}
                  />
                </g>
              </g>
            );
          })}
          <circle cx="50" cy="50" r="7" fill="#fff" fillOpacity="0.9"
                  style={{ filter: `drop-shadow(0 2px 6px ${phaseColor}88)` }} />
        </svg>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-bold tabular-nums transition-colors"
              style={{ color: '#fff', lineHeight: 1, textShadow: '0 1px 6px rgba(0,0,0,0.35)' }}>
          {countDown}
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest transition-colors"
              style={{ color: 'rgba(255,255,255,0.9)', textShadow: '0 1px 4px rgba(0,0,0,0.35)' }}>
          {phaseLabel}
        </span>
      </div>
    </div>
  );
}

const BREATH_VISUAL = 'blob';

export default function QuickCalmCard({ onOpenAuth }) {
  const [active,    setActive]    = useState(false);
  const [elapsed,   setElapsed]   = useState(0);
  const [done,      setDone]      = useState(false);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      setElapsed(e => {
        const next = e + 1;
        if (next >= TOTAL_SECS) { setActive(false); setDone(true); return 0; }
        return next;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [active, elapsed]);

  const phaseIdx    = Math.floor(elapsed / PHASE_SECS) % BREATH_PHASES.length;
  const countDown   = PHASE_SECS - (elapsed % PHASE_SECS);
  const cyclesDone  = Math.floor(elapsed / CYCLE_SECS);
  const phaseColor  = BREATH_COLORS[phaseIdx];
  const blobScale   = active ? BLOB_SCALE[phaseIdx] : 1;
  const openness    = active ? FLOWER_OPENNESS[phaseIdx] : 1;
  const VISUAL_BOX  = 172;

  const prevPhaseRef = useRef(phaseIdx);
  useEffect(() => {
    if (!active) { prevPhaseRef.current = phaseIdx; return; }
    if (prevPhaseRef.current !== phaseIdx) {
      playTick();
      hapticPhase();
      prevPhaseRef.current = phaseIdx;
    }
  }, [phaseIdx, active]);

  useEffect(() => {
    if (done) playComplete();
  }, [done]);

  function start()   { setElapsed(0); setActive(true); setDone(false); }
  function stop()    { setActive(false); setElapsed(0); }

  return (
    <div
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl glass-card p-5 transition-all duration-300 hover:shadow-elevated"
    >
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl"
           style={{ background: 'rgb(var(--c-primary) / 0.14)' }} />

      {/* Done state */}
      {done && !active && (
        <div className="relative flex h-full flex-col items-center justify-center gap-4 text-center">
          <span className="text-3xl">🌿</span>
          <div>
            <p className="text-sm font-semibold text-slate-800">Complete</p>
            <p className="mt-1 text-xs text-slate-500">4 cycles complete</p>
          </div>
          <button
            onClick={start}
            className="w-full rounded-lg py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white transition-all shadow-xs"
          >
            Try again
          </button>

          {/* Sign In Prompt for Guest Users */}
          <div
            onClick={() => onOpenAuth && onOpenAuth()}
            className={`w-full p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 transition-all ${
              onOpenAuth ? 'cursor-pointer hover:border-slate-300' : ''
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-xs font-medium text-slate-700 text-left">
                Sign in for all mindful exercises
              </p>
            </div>
            {onOpenAuth && (
              <span className="text-xs font-medium text-sky-700 shrink-0">
                Sign in →
              </span>
            )}
          </div>
        </div>
      )}

      {/* Idle state */}
      {!active && !done && (
        <div className="relative flex h-full flex-col items-start gap-4 justify-between">
          <div className="flex w-full items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Breathing exercise</p>
              <h3 className="text-lg font-bold text-slate-900">Box Breathing</h3>
              <p className="mt-1 text-xs text-slate-500">Inhale · Hold · Exhale · Hold</p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="badge-muted">4 cycles</span>
                <span className="badge-muted">~64s total</span>
              </div>
            </div>
          </div>

          {/* Sign In Prompt for Guest Users */}
          <div
            onClick={() => onOpenAuth && onOpenAuth()}
            className={`w-full p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 transition-all ${
              onOpenAuth ? 'cursor-pointer hover:border-slate-300' : ''
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-xs font-medium text-slate-700 text-left">
                Sign in for all mindful exercises
              </p>
            </div>
            {onOpenAuth && (
              <span className="text-xs font-medium text-sky-700 shrink-0">
                Sign in →
              </span>
            )}
          </div>

          <button
            onClick={start}
            className="w-full rounded-lg py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white transition-all shadow-xs"
          >
            Start
          </button>
        </div>
      )}

      {/* Active state */}
      {active && (
        <div className="relative flex h-full flex-col items-center justify-between gap-2">
          <div className="w-full h-0.5 rounded-full bg-border/40 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000"
                 style={{ width: `${(elapsed / TOTAL_SECS) * 100}%`, background: phaseColor }} />
          </div>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: BREATH_CYCLES }).map((_, i) => (
              <span key={i} className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: i === cyclesDone ? 16 : 6,
                      background: i < cyclesDone
                        ? phaseColor
                        : i === cyclesDone
                        ? phaseColor + '80'
                        : 'rgba(113,122,139,0.25)',
                    }} />
            ))}
          </div>

          {BREATH_VISUAL === 'flower' ? (
            <FlowerBreathVisual
              phaseColor={phaseColor} openness={openness}
              countDown={countDown} phaseLabel={BREATH_PHASES[phaseIdx]} size={VISUAL_BOX}
            />
          ) : (
            <BlobBreathVisual
              phaseColor={phaseColor} scale={blobScale}
              countDown={countDown} phaseLabel={BREATH_PHASES[phaseIdx]} size={VISUAL_BOX}
            />
          )}

          <p className="text-xs text-muted-foreground -mt-1 transition-all duration-500">
            {BREATH_HINTS[phaseIdx]}
          </p>

          <button
            onClick={stop}
            className="w-full rounded-2xl border border-border/60 bg-card/80 py-2 text-xs font-semibold text-muted-foreground transition-all hover:bg-secondary/70 hover:text-foreground"
          >
            Stop
          </button>
        </div>
      )}
    </div>
  );
}
