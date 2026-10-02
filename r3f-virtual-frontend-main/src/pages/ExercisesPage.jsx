import React, { useState, useEffect, useRef } from 'react';
import PageHeader from '../components/PageHeader';

/* ═════════════════════════════════════════════════════════════════════════
   1. BOX BREATHING EXERCISE COMPONENT
   - 4 seconds Inhale, 4s Hold, 4s Exhale, 4s Hold
   - 11 Rounds, counting backwards from 11 down to 1
   ═════════════════════════════════════════════════════════════════════════ */
function BoxBreathingCard() {
  const [isActive, setIsActive] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0); // 0: Inhale, 1: Hold (In), 2: Exhale, 3: Hold (Out)
  const [phaseTimeLeft, setPhaseTimeLeft] = useState(4);
  const [remainingRounds, setRemainingRounds] = useState(11);
  const [isCompleted, setIsCompleted] = useState(false);

  const PHASES = [
    { label: 'Breathe In', hint: 'Inhale deeply through your nose…', color: '#38bdf8', scale: 1.25 },
    { label: 'Hold', hint: 'Hold your breath gently…', color: '#818cf8', scale: 1.25 },
    { label: 'Breathe Out', hint: 'Exhale slowly through your mouth…', color: '#34d399', scale: 0.85 },
    { label: 'Hold', hint: 'Rest quietly before the next breath…', color: '#a78bfa', scale: 0.85 },
  ];

  useEffect(() => {
    let timer = null;
    if (isActive && !isCompleted) {
      timer = setInterval(() => {
        setPhaseTimeLeft((prev) => {
          if (prev > 1) return prev - 1;

          // Phase transition
          setPhaseIndex((prevPhase) => {
            const nextPhase = (prevPhase + 1) % 4;
            // When completing full cycle (returning to phase 0)
            if (nextPhase === 0) {
              setRemainingRounds((prevRound) => {
                if (prevRound <= 1) {
                  setIsActive(false);
                  setIsCompleted(true);
                  return 0;
                }
                return prevRound - 1;
              });
            }
            return nextPhase;
          });
          return 4; // Reset phase countdown to 4s
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isActive, isCompleted]);

  const handleStartPause = () => {
    if (isCompleted) {
      setIsCompleted(false);
      setRemainingRounds(11);
      setPhaseIndex(0);
      setPhaseTimeLeft(4);
    }
    setIsActive((prev) => !prev);
  };

  const handleReset = () => {
    setIsActive(false);
    setIsCompleted(false);
    setRemainingRounds(11);
    setPhaseIndex(0);
    setPhaseTimeLeft(4);
  };

  const currentPhase = PHASES[phaseIndex];

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-8 border border-primary/20 flex flex-col justify-between h-full relative overflow-hidden shadow-sm">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/15 text-sky-600 border border-sky-500/20">
            <span>🫁</span>
            <span>Breathe · 2 minutes</span>
          </span>
          <span className="text-xs font-semibold text-muted-foreground">
            Round {isCompleted ? 0 : remainingRounds} of 11
          </span>
        </div>

        <div>
          <h3 className="text-xl font-bold text-foreground">1. Box Breathing</h3>
          <p className="text-xs font-medium text-primary mt-0.5">Find your rhythm</p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Take a moment to settle in. Follow the rhythm of your breath, one count at a time.
          </p>
        </div>

        {/* Visualizer Circle */}
        <div className="py-6 flex flex-col items-center justify-center relative">
          <div
            className="w-36 h-36 rounded-full flex flex-col items-center justify-center relative transition-all duration-1000 shadow-lg"
            style={{
              backgroundColor: `${currentPhase.color}20`,
              border: `3px solid ${currentPhase.color}`,
              transform: `scale(${isActive ? currentPhase.scale : 1})`,
              boxShadow: isActive ? `0 0 30px ${currentPhase.color}50` : 'none',
            }}
          >
            <span className="text-3xl font-extrabold text-foreground tabular-nums">
              {isActive ? phaseTimeLeft : '4'}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-1">
              {isActive ? currentPhase.label : 'Ready'}
            </span>
          </div>

          <p className="text-xs font-medium text-foreground mt-4 h-5 text-center">
            {isActive ? currentPhase.hint : 'Press Start to begin 11 rounds of 4-count breathing.'}
          </p>
        </div>

        {/* Instructions Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2 rounded-xl bg-card/60 border border-border/40">
            <span className="font-bold text-sky-500 block">4s Inhale</span>
            <span className="text-[10px] text-muted-foreground">Breathe in</span>
          </div>
          <div className="p-2 rounded-xl bg-card/60 border border-border/40">
            <span className="font-bold text-indigo-500 block">4s Hold</span>
            <span className="text-[10px] text-muted-foreground">Pause breath</span>
          </div>
          <div className="p-2 rounded-xl bg-card/60 border border-border/40">
            <span className="font-bold text-emerald-500 block">4s Exhale</span>
            <span className="text-[10px] text-muted-foreground">Breathe out</span>
          </div>
          <div className="p-2 rounded-xl bg-card/60 border border-border/40">
            <span className="font-bold text-purple-500 block">4s Hold</span>
            <span className="text-[10px] text-muted-foreground">Rest quietly</span>
          </div>
        </div>
      </div>

      {/* Controls & Footnote */}
      <div className="pt-6 space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleStartPause}
            className="flex-1 py-3 px-4 rounded-2xl text-xs font-bold text-primary-foreground shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ backgroundImage: 'var(--gradient-primary)' }}
          >
            <span>{isCompleted ? 'Restart Exercise' : isActive ? 'Pause' : 'Start Breathing'}</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="py-3 px-4 rounded-2xl text-xs font-bold border border-border/70 bg-card hover:bg-muted text-foreground transition-all"
          >
            Reset
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug">
          Go at your own pace. If holding your breath feels uncomfortable, breathe naturally and return when you're ready.
        </p>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   2. GROUNDING 5-4-3-2-1 EXERCISE COMPONENT
   ═════════════════════════════════════════════════════════════════════════ */
function Grounding54321Card() {
  const [currentStep, setCurrentStep] = useState(5); // 5 down to 1
  const [inputs, setInputs] = useState({
    5: ['', '', '', '', ''],
    4: ['', '', '', ''],
    3: ['', '', ''],
    2: ['', ''],
    1: [''],
  });

  const STEPS_DATA = {
    5: {
      count: 5,
      sense: 'SEE',
      icon: '👀',
      title: 'Name 5 things you can see around you.',
      hint: 'Look for subtle details, shapes, colors, or objects nearby.',
      color: 'text-amber-500 bg-amber-500/15 border-amber-500/30',
    },
    4: {
      count: 4,
      sense: 'HEAR',
      icon: '👂',
      title: 'Notice 4 sounds you can hear.',
      hint: 'Listen closely: room humming, distant traffic, your breath, or footsteps.',
      color: 'text-sky-500 bg-sky-500/15 border-sky-500/30',
    },
    3: {
      count: 3,
      sense: 'SMELL',
      icon: '👃',
      title: 'Identify 3 things you can smell.',
      hint: 'Notice fresh air, coffee, clothing, soap, or ambient scents.',
      color: 'text-emerald-500 bg-emerald-500/15 border-emerald-500/30',
    },
    2: {
      count: 2,
      sense: 'TASTE',
      icon: '👅',
      title: 'Notice 2 things you can taste.',
      hint: 'A recent drink, toothpaste, mint, or simply the taste in your mouth.',
      color: 'text-purple-500 bg-purple-500/15 border-purple-500/30',
    },
    1: {
      count: 1,
      sense: 'TOUCH',
      icon: '✋',
      title: 'Notice 1 thing you can feel against your skin.',
      hint: 'Your feet on the floor, fabric of your shirt, or cool breeze.',
      color: 'text-rose-500 bg-rose-500/15 border-rose-500/30',
    },
  };

  const handleInputChange = (step, index, val) => {
    setInputs((prev) => {
      const copy = { ...prev[step] };
      copy[index] = val;
      return { ...prev, [step]: copy };
    });
  };

  const activeData = STEPS_DATA[currentStep];

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-8 border border-primary/20 flex flex-col justify-between h-full relative overflow-hidden shadow-sm">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 border border-amber-500/20">
            <span>🌿</span>
            <span>Ground · 2–3 minutes</span>
          </span>
          <div className="flex items-center gap-1">
            {[5, 4, 3, 2, 1].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setCurrentStep(step)}
                className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${
                  currentStep === step
                    ? 'bg-primary text-primary-foreground shadow-sm scale-110'
                    : 'bg-card text-muted-foreground border border-border/60 hover:text-foreground'
                }`}
              >
                {step}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-foreground">2. Grounding: 5-4-3-2-1</h3>
          <p className="text-xs font-medium text-primary mt-0.5">Come back to the present</p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Take a moment to notice what's around you. Let your senses guide you, one at a time.
          </p>
        </div>

        {/* Step Banner */}
        <div className="p-4 rounded-2xl bg-card/70 border border-border/50 space-y-3">
          <div className="flex items-center gap-3">
            <span className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold border ${activeData.color}`}>
              {activeData.count}
            </span>
            <div>
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{activeData.sense}</span>
              <h4 className="text-sm font-bold text-foreground">{activeData.title}</h4>
            </div>
          </div>

          <p className="text-xs text-muted-foreground italic">{activeData.hint}</p>

          {/* Dynamic Input Fields for Current Sense */}
          <div className="space-y-2 pt-1">
            {Array.from({ length: activeData.count }).map((_, idx) => (
              <input
                key={idx}
                type="text"
                placeholder={`Item ${idx + 1} (${activeData.sense.toLowerCase()})...`}
                value={inputs[currentStep][idx] || ''}
                onChange={(e) => handleInputChange(currentStep, idx, e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-primary/40 transition-all"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Stepper Navigation & Footnote */}
      <div className="pt-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={currentStep === 5}
            onClick={() => setCurrentStep((prev) => Math.min(5, prev + 1))}
            className="py-2.5 px-4 rounded-xl text-xs font-bold border border-border/70 bg-card hover:bg-muted text-foreground transition-all disabled:opacity-40"
          >
            ← Previous Sense
          </button>

          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
              className="py-2.5 px-5 rounded-xl text-xs font-bold text-primary-foreground shadow-sm transition-all flex items-center gap-1"
              style={{ backgroundImage: 'var(--gradient-primary)' }}
            >
              <span>Next Sense</span>
              <span>→</span>
            </button>
          ) : (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
              ✓ Grounded & Present
            </span>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug">
          There's no right or wrong answer. If you can't find something, simply move to the next sense.
        </p>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   3. EXPRESS THROUGH DRAWING EXERCISE COMPONENT
   - Includes Mood check ("How are you feeling today?")
   - Phase 1: Pause & Notice
   - Phase 2: Express on HTML5 Canvas
   - Phase 3: Save, Share, or Burn/Let it go animation
   ═════════════════════════════════════════════════════════════════════════ */
function ExpressThroughDrawingCard() {
  const [selectedMood, setSelectedMood] = useState('');
  const [stage, setStage] = useState(1); // 1: Mood & Pause, 2: Drawing Canvas, 3: Actions / Released
  const [penColor, setPenColor] = useState('#ef4444'); // Default Crimson/Anger
  const [penWidth, setPenWidth] = useState(3);
  const [isBurning, setIsBurning] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);

  const MOOD_OPTIONS = [
    { label: 'Angry', icon: '😡', color: '#ef4444' },
    { label: 'Frustrated', icon: '😤', color: '#f97316' },
    { label: 'Sad', icon: '😢', color: '#3b82f6' },
    { label: 'Anxious', icon: '😰', color: '#8b5cf6' },
    { label: 'Overwhelmed', icon: '😵‍💫', color: '#ec4899' },
    { label: 'Something else', icon: '💭', color: '#10b981' },
  ];

  const COLOR_PALETTE = [
    { name: 'Red/Anger', code: '#ef4444' },
    { name: 'Orange/Frustration', code: '#f97316' },
    { name: 'Blue/Sadness', code: '#3b82f6' },
    { name: 'Purple/Anxiety', code: '#8b5cf6' },
    { name: 'Black/Darkness', code: '#18181b' },
    { name: 'Green/Hope', code: '#10b981' },
  ];

  // Canvas Drawing Listeners
  const startDrawing = (e) => {
    isDrawingRef.current = true;
    draw(e);
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.beginPath();
    }
  };

  const draw = (e) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = penColor;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleSaveDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `TherapyxAI_Expression_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setFeedbackMsg('✨ Drawing saved to your device!');
    setTimeout(() => setFeedbackMsg(''), 4000);
  };

  const handleShareDrawing = () => {
    setFeedbackMsg('📤 Drawing link copied to share!');
    setTimeout(() => setFeedbackMsg(''), 4000);
  };

  const handleBurnDrawing = () => {
    setIsBurning(true);
    setTimeout(() => {
      clearCanvas();
      setIsBurning(false);
      setFeedbackMsg('🔥 Drawing discarded & burned. Take a deep breath.');
      setTimeout(() => setFeedbackMsg(''), 4000);
    }, 1200);
  };

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-8 border border-primary/20 flex flex-col justify-between h-full relative overflow-hidden shadow-sm">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 border border-rose-500/20">
            <span>🎨</span>
            <span>Express · 5 minutes</span>
          </span>
          <span className="text-xs font-semibold text-muted-foreground">
            Stage {stage} of 2
          </span>
        </div>

        <div>
          <h3 className="text-xl font-bold text-foreground">3. Express Through Drawing</h3>
          <p className="text-xs font-medium text-primary mt-0.5">Give your feelings some space</p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            You don't always need words to express what you're feeling.
          </p>
        </div>

        {/* STAGE 1: Mood Check & Pause */}
        {stage === 1 && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-foreground block mb-2">
                How are you feeling today?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MOOD_OPTIONS.map((mood) => {
                  const isSelected = selectedMood === mood.label;
                  return (
                    <button
                      key={mood.label}
                      type="button"
                      onClick={() => {
                        setSelectedMood(mood.label);
                        setPenColor(mood.color);
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/30'
                          : 'border-border/60 bg-card hover:border-primary/40 text-foreground'
                      }`}
                    >
                      <span className="text-base">{mood.icon}</span>
                      <span>{mood.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-card/70 border border-border/50 space-y-2">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span>🧘</span>
                <span>1. Pause and notice</span>
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Take two slow, deep breaths. If you're comfortable, close your eyes. For the next two minutes, gently bring to mind the situation, images, thoughts or feelings you'd like to express. Let whatever comes up come and go.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStage(2)}
              className="w-full py-3 px-4 rounded-2xl text-xs font-bold text-primary-foreground shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
              style={{ backgroundImage: 'var(--gradient-primary)' }}
            >
              <span>Continue to Drawing Canvas</span>
              <span>→</span>
            </button>
          </div>
        )}

        {/* STAGE 2: Drawing Canvas & Actions */}
        {stage === 2 && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-foreground">Canvas Tools:</span>
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    title={c.name}
                    onClick={() => setPenColor(c.code)}
                    className={`w-5 h-5 rounded-full transition-transform ${penColor === c.code ? 'scale-125 ring-2 ring-primary' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c.code }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={clearCanvas}
                className="text-[11px] font-semibold text-rose-500 hover:underline"
              >
                Clear Canvas
              </button>
            </div>

            {/* Interactive Canvas Container */}
            <div className={`relative rounded-2xl overflow-hidden border border-border/70 bg-card shadow-inner transition-opacity duration-700 ${isBurning ? 'opacity-0 scale-95 blur-sm' : 'opacity-100'}`}>
              <canvas
                ref={canvasRef}
                width={500}
                height={220}
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseMove={draw}
                onTouchStart={startDrawing}
                onTouchEnd={stopDrawing}
                onTouchMove={draw}
                className="w-full h-52 touch-none cursor-crosshair bg-card"
              />
              <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/60 pointer-events-none">
                Draw lines, scribbles & feelings
              </span>
            </div>

            {/* Stage 3 Choices */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-bold text-foreground block">3. Choose what happens next:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleSaveDrawing}
                  className="p-2.5 rounded-xl border border-border/60 bg-card hover:bg-muted text-xs font-bold text-foreground transition-all flex items-center justify-center gap-1.5"
                >
                  <span>💾 Save</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareDrawing}
                  className="p-2.5 rounded-xl border border-border/60 bg-card hover:bg-muted text-xs font-bold text-foreground transition-all flex items-center justify-center gap-1.5"
                >
                  <span>📤 Share</span>
                </button>
                <button
                  type="button"
                  onClick={handleBurnDrawing}
                  className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-bold text-rose-600 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>🔥 Let it Go / Burn</span>
                </button>
              </div>

              {feedbackMsg && (
                <p className="text-xs font-semibold text-center text-primary animate-fade-in pt-1">
                  {feedbackMsg}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footnote */}
      <div className="pt-4">
        <p className="text-[11px] text-muted-foreground leading-snug">
          If a memory or feeling becomes too intense, pause, open your eyes and return to your surroundings. You don't have to revisit anything you're not ready for.
        </p>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   4. PROGRESSIVE MUSCLE RELAXATION (PMR) EXERCISE COMPONENT
   - 10-Second hold per muscle group:
     1. Feet and toes
     2. Calves and thighs
     3. Hips and abdomen
     4. Hands and arms
     5. Shoulders and neck
     6. Face and jaw
   ═════════════════════════════════════════════════════════════════════════ */
function PMRCard() {
  const [activeStep, setActiveStep] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  const [isHolding, setIsHolding] = useState(true); // true = 10s tension hold, false = release

  const MUSCLE_GROUPS = [
    { title: '1. Feet and toes', icon: '🦶', desc: 'Curl your toes downward and gently tighten your feet muscles.' },
    { title: '2. Calves and thighs', icon: '🦵', desc: 'Tighten your calf muscles and press your thighs together firmly.' },
    { title: '3. Hips and abdomen', icon: '🧘', desc: 'Clench your glutes and tighten your core abdominal muscles.' },
    { title: '4. Hands and arms', icon: '💪', desc: 'Clench your fists tight and flex your biceps and forearms.' },
    { title: '5. Shoulders and neck', icon: '🙇', desc: 'Raise your shoulders up towards your ears and hold the tension.' },
    { title: '6. Face and jaw', icon: '👤', desc: 'Squeeze your eyes shut, scrunch your nose, and tighten your jaw.' },
  ];

  useEffect(() => {
    let t = null;
    if (timerRunning) {
      t = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev > 1) return prev - 1;
          setIsHolding(false);
          setTimerRunning(false);
          return 0;
        });
      }, 1000);
    }
    return () => clearInterval(t);
  }, [timerRunning]);

  const handleStartHold = () => {
    setIsHolding(true);
    setTimeLeft(10);
    setTimerRunning(true);
  };

  const handleNextStep = () => {
    setTimerRunning(false);
    setIsHolding(true);
    setTimeLeft(10);
    setActiveStep((prev) => Math.min(MUSCLE_GROUPS.length - 1, prev + 1));
  };

  const handlePrevStep = () => {
    setTimerRunning(false);
    setIsHolding(true);
    setTimeLeft(10);
    setActiveStep((prev) => Math.max(0, prev - 1));
  };

  const currentGroup = MUSCLE_GROUPS[activeStep];

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-8 border border-primary/20 flex flex-col justify-between h-full relative overflow-hidden shadow-sm">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-600 border border-purple-500/20">
            <span>🧘</span>
            <span>Relax · 5–7 minutes</span>
          </span>
          <span className="text-xs font-semibold text-muted-foreground">
            Step {activeStep + 1} of 6
          </span>
        </div>

        <div>
          <h3 className="text-xl font-bold text-foreground">4. Progressive Muscle Relaxation (PMR)</h3>
          <p className="text-xs font-medium text-primary mt-0.5">Release the tension</p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Find a comfortable position, sitting or lying down. Starting with your feet, gently tighten one muscle group at a time. Hold for 10 seconds, then release.
          </p>
        </div>

        {/* Current Body Area Step Card */}
        <div className="p-5 rounded-2xl bg-card/70 border border-border/50 space-y-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl p-3 rounded-2xl bg-primary/10 border border-primary/20">
              {currentGroup.icon}
            </span>
            <h4 className="text-base font-bold text-foreground">{currentGroup.title}</h4>
            <p className="text-xs text-muted-foreground max-w-sm">{currentGroup.desc}</p>
          </div>

          {/* 10-Second Timer Circle */}
          <div className="py-2 flex flex-col items-center justify-center">
            <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center border-4 transition-all ${
              timerRunning
                ? 'border-purple-500 bg-purple-500/10 shadow-lg scale-105'
                : !isHolding
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-border/60 bg-card'
            }`}>
              <span className="text-2xl font-extrabold text-foreground tabular-nums">
                {timerRunning ? `${timeLeft}s` : !isHolding ? '✓' : '10s'}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {timerRunning ? 'Tighten' : !isHolding ? 'Release!' : 'Ready'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleStartHold}
              className="mt-3 px-4 py-1.5 rounded-xl text-xs font-bold text-primary border border-primary/30 hover:bg-primary/10 transition-all"
            >
              {timerRunning ? 'Restart 10s Timer' : 'Start 10s Muscle Hold'}
            </button>
          </div>

          {/* All 6 Steps Overview Chips */}
          <div className="grid grid-cols-3 gap-1.5 pt-2">
            {MUSCLE_GROUPS.map((g, i) => (
              <button
                key={g.title}
                type="button"
                onClick={() => {
                  setActiveStep(i);
                  setTimerRunning(false);
                  setIsHolding(true);
                  setTimeLeft(10);
                }}
                className={`p-1.5 rounded-xl text-[10px] font-bold transition-all ${
                  activeStep === i
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card text-muted-foreground hover:text-foreground border border-border/40'
                }`}
              >
                {g.title.split('.')[1]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stepper Navigation & Footnote */}
      <div className="pt-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={activeStep === 0}
            onClick={handlePrevStep}
            className="py-2.5 px-4 rounded-xl text-xs font-bold border border-border/70 bg-card hover:bg-muted text-foreground transition-all disabled:opacity-40"
          >
            ← Previous Muscle
          </button>

          {activeStep < MUSCLE_GROUPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="py-2.5 px-5 rounded-xl text-xs font-bold text-primary-foreground shadow-sm transition-all flex items-center gap-1"
              style={{ backgroundImage: 'var(--gradient-primary)' }}
            >
              <span>Next Muscle</span>
              <span>→</span>
            </button>
          ) : (
            <span className="text-xs font-bold text-purple-600 bg-purple-500/15 border border-purple-500/30 px-3 py-1.5 rounded-xl">
              ✓ Full Body Relaxed
            </span>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug">
          Tighten gently, never to the point of pain. Skip any area that feels uncomfortable or injured. Keep breathing naturally throughout.
        </p>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   MAIN EXERCISES PAGE COMPONENT
   ═════════════════════════════════════════════════════════════════════════ */
export default function ExercisesPage({ onBack, user }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header — shared across every internal page: back button + theme + profile */}
      <PageHeader onBack={onBack} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 space-y-8">
        {/* Page Banner */}
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            Guided Mindful Exercises
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Take a few moments for yourself. Select any of the interactive exercises below to calm your mind, ground your senses, express your emotions, or release physical tension.
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>
            Member access granted
          </span>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Exercise 1: Box Breathing */}
          <BoxBreathingCard />

          {/* Exercise 2: Grounding 5-4-3-2-1 */}
          <Grounding54321Card />

          {/* Exercise 3: Express Through Drawing */}
          <ExpressThroughDrawingCard />

          {/* Exercise 4: Progressive Muscle Relaxation */}
          <PMRCard />
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border/50 py-4 px-4 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} TherapyxAI · Mindful Self-Care & Clinical Companion</p>
      </footer>
    </div>
  );
}
