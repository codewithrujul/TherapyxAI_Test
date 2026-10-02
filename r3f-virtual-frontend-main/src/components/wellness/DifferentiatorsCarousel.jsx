function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

const DIFFERENTIATORS = [
  {
    title: 'Voice-first, not text-first',
    desc: 'Most AI tools are built around typing. TherapyxAI leads with natural spoken conversation in English, Hindi, or Marathi.',
    tint: '#38bdf8',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor" />
        <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
        <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="8"  y1="22" x2="16" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: 'Built only for emotional support',
    desc: "General AI tools juggle code, essays, and research. TherapyxAI doesn't try to do anything else, just you, heard.",
    tint: '#1687d8',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"
              stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
  },
  {
    title: 'Remembers your emotional journey',
    desc: 'Generic chat forgets everything between sessions. TherapyxAI tracks how you feel over time, not just what you said.',
    tint: '#0f6bb2',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Private and judgment-free by design',
    desc: 'Your conversations are end-to-end encrypted and never used to train on you. This is a space to feel, not to perform.',
    tint: '#0ea5e9',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
  },
];

export default function DifferentiatorsCarousel() {
  return (
    <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center animate-fade-up">

      {/* ── LEFT COLUMN: Headline section ── */}
      <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left gap-3 w-full">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-primary/15 text-primary border border-primary/20">
          <span>✨</span>
          <span>NOT JUST ANOTHER AI CHATBOT</span>
        </div>
        <h3 className="font-sans text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground leading-tight">
          What makes <span className="gradient-text">TherapyxAI</span> different
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto lg:mx-0 mt-1">
          Designed specifically for emotional wellness, natural spoken conversations, and private emotional memory that grows with you over time.
        </p>
      </div>

      {/* ── RIGHT COLUMN: 2x2 Grid of Animated Cards ── */}
      <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5 w-full">
        {DIFFERENTIATORS.map((d, i) => (
          <div
            key={i}
            className="glass-card group relative flex flex-col gap-3.5 overflow-hidden rounded-3xl p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated hover:border-primary/40"
            style={{
              background: `linear-gradient(160deg, ${hexToRgba(d.tint, 0.04)} 0%, transparent 50%)`,
            }}
          >
            <span
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl text-white transition-transform duration-300 group-hover:scale-110"
              style={{
                background: `linear-gradient(135deg, ${d.tint}, ${hexToRgba(d.tint, 0.75)})`,
                boxShadow: `0 6px 16px -4px ${hexToRgba(d.tint, 0.5)}`,
              }}
            >
              {d.icon}
            </span>
            <h4 className="relative font-sans text-base font-bold text-foreground tracking-tight">{d.title}</h4>
            <p className="relative text-xs sm:text-sm leading-relaxed text-muted-foreground">{d.desc}</p>
          </div>
        ))}
      </div>

    </section>
  );
}
