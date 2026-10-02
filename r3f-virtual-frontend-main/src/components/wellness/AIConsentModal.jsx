import React from 'react';
import { createPortal } from 'react-dom';

export default function AIConsentModal({ open, onAgree, onCancel, isGuest }) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-primary/25 bg-card p-6 sm:p-7 shadow-elevated transition-all flex flex-col gap-5">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary text-2xl shadow-soft">
            🛡️
          </div>
          <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-primary/15 text-primary border border-primary/20 uppercase tracking-wider">
            AI Safety & Service Terms
          </span>
          <h3 className="font-sans text-xl sm:text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {isGuest ? "Welcome to TherapyxAI" : "Important Terms & AI Disclosure"}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Please review and agree to our AI companion guidelines before starting your session.
          </p>
        </div>

        {/* ChatGPT style Bullet Points */}
        <div className="space-y-3.5 bg-muted/30 p-4 rounded-2xl border border-border/50 text-left max-h-[50vh] overflow-y-auto">
          
          {/* Point 1: AI Limitation */}
          <div className="flex items-start gap-3">
            <span className="text-lg shrink-0 mt-0.5">🤖</span>
            <div className="space-y-0.5">
              <h5 className="text-xs font-bold text-foreground">AI Model Capabilities</h5>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                TherapyxAI is powered by AI models designed for empathetic conversation. AI can make mistakes or provide inaccurate information. Always use personal discretion.
              </p>
            </div>
          </div>

          {/* Point 2: Not Replacement for Therapy */}
          <div className="flex items-start gap-3">
            <span className="text-lg shrink-0 mt-0.5">🩺</span>
            <div className="space-y-0.5">
              <h5 className="text-xs font-bold text-foreground">Not a Substitute for Therapy</h5>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                This service provides supportive guidance and self-reflection. It does <strong>not</strong> replace professional medical care, clinical diagnosis, or therapy from a licensed practitioner.
              </p>
            </div>
          </div>

          {/* Point 3: Emergency & Crisis */}
          <div className="flex items-start gap-3">
            <span className="text-lg shrink-0 mt-0.5">🆘</span>
            <div className="space-y-0.5">
              <h5 className="text-xs font-bold text-foreground">Emergency & Crisis Situations</h5>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                If you are experiencing a mental health emergency, thoughts of self-harm, or severe crisis, please immediately contact your local emergency hotline or crisis center.
              </p>
            </div>
          </div>

          {/* Point 4: Encrypted & Private */}
          <div className="flex items-start gap-3">
            <span className="text-lg shrink-0 mt-0.5">🔒</span>
            <div className="space-y-0.5">
              <h5 className="text-xs font-bold text-foreground">Privacy & Encrypted Space</h5>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Your conversations are processed in a secure, encrypted environment designed to protect your privacy.
              </p>
            </div>
          </div>

        </div>

        {/* Action Button: I Agree */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={onAgree}
            className="w-full py-3 px-5 rounded-2xl text-xs font-bold text-primary-foreground shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ backgroundImage: 'var(--gradient-primary)' }}
          >
            <span>I Agree & Continue</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              Cancel
            </button>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}
