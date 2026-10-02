// ─── Sensory feedback — soft sound + haptics for key moments ──────────────────
// Master switch: flip to false to disable all sound + haptic feedback app-wide,
// no matter what the user's own mute preference is set to.
export const FEEDBACK_ENABLED = true;
// Sound specifically didn't land well — disabled independently of haptics.
// Flip back to true (and re-add <SoundToggle /> in the header) to bring it back.
export const SOUND_ENABLED = false;

const SOUND_STORAGE_KEY = 'therapixai-sound-enabled';

export function isSoundEnabled() {
  if (!FEEDBACK_ENABLED || !SOUND_ENABLED) return false;
  const saved = localStorage.getItem(SOUND_STORAGE_KEY);
  return saved === null ? true : saved === 'true'; // on by default
}

export function setSoundEnabled(on) {
  localStorage.setItem(SOUND_STORAGE_KEY, on ? 'true' : 'false');
}

// ─── Tone engine — plain oscillators, no audio files needed ───────────────────
let audioCtx = null;
function getCtx() {
  if (!FEEDBACK_ENABLED) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq, duration, { type = 'sine', gain = 0.16, delay = 0 } = {}) {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + delay;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export function playSessionStart() {
  tone(523.25, 0.18);              // C5
  tone(659.25, 0.22, { delay: 0.09 }); // E5
}

export function playSessionEnd() {
  tone(659.25, 0.18);              // E5
  tone(523.25, 0.24, { delay: 0.09 }); // C5 — mirrors the start chime, descending
}

export function playTick() {
  tone(440, 0.1, { type: 'triangle', gain: 0.09 }); // breathing phase change
}

export function playPop() {
  tone(587.33, 0.15, { type: 'sine', gain: 0.14 }); // mood picked
}

export function playComplete() {
  tone(523.25, 0.2);
  tone(659.25, 0.2, { delay: 0.1 });
  tone(783.99, 0.35, { delay: 0.2 }); // full breathing cycle finished
}

// ─── Haptics — Android Chrome only; silently no-ops everywhere else ───────────
function vibrate(pattern) {
  if (!FEEDBACK_ENABLED) return;
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch { /* unsupported — ignore */ }
  }
}

export function hapticTap()   { vibrate(10); }
export function hapticPhase() { vibrate(15); }
export function hapticStart() { vibrate(20); }
export function hapticEnd()   { vibrate([15, 40, 15]); }
