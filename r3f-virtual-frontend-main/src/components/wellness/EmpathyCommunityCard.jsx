export default function EmpathyCommunityCard({ onShareFeedback }) {
  return (
    <div className="glass-card relative overflow-hidden rounded-3xl p-6 sm:p-8 text-center border border-primary/20 bg-gradient-to-b from-primary/5 via-card to-card shadow-md flex flex-col items-center justify-between h-full w-full">
      <div className="relative z-10 flex flex-col items-center gap-3 my-auto">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary text-xl shadow-soft">
          💬
        </span>
        <div className="space-y-1.5 max-w-md">
          <h3 className="font-sans text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Your feedback is valuable to us
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Help us shape TherapyxAI by rating voice quality, AI model accuracy, modal performance, and therapist features.
          </p>
        </div>
      </div>
      <div className="pt-4 relative z-10 w-full">
        <button
          type="button"
          onClick={onShareFeedback}
          className="w-full py-3 px-5 rounded-2xl text-xs font-bold text-primary-foreground shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
          style={{ backgroundImage: 'var(--gradient-primary)' }}
        >
          <span>Share Platform Feedback</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
