import React, { useState } from 'react';
import { API_BASE } from '../../config';

const VOICE_OPTIONS = [
  'Excellent (Clear & Natural)',
  'Good (Understandable)',
  'Average (Slight Lag/Distortion)',
  'Needs Improvement',
];

const ACCURACY_OPTIONS = [
  'Highly Accurate & Empathetic',
  'Satisfactory',
  'Occasionally Off-Topic',
  'Needs Improvement',
];

const MODAL_OPTIONS = [
  'Seamless & Fast',
  'Responsive',
  'Slow / Minor Bugs',
  'Needs Improvement',
];

const THERAPIST_OPTIONS = [
  'Very Easy to Book',
  'Good Selection of Specialists',
  'Needs More Therapists',
  'Needs Improvement',
];

export default function PlatformFeedbackModal({ isOpen, onClose, userId, guestName }) {
  const [voiceQuality, setVoiceQuality] = useState('Excellent (Clear & Natural)');
  const [modelAccuracy, setModelAccuracy] = useState('Highly Accurate & Empathetic');
  const [modalSupport, setModalSupport] = useState('Seamless & Fast');
  const [therapistIntegration, setTherapistIntegration] = useState('Very Easy to Book');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          guestName: guestName || 'Guest User',
          voiceQuality,
          modelAccuracy,
          modalSupport,
          therapistIntegration,
          comments,
        }),
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Feedback submit error:', err);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-primary/20 bg-card p-6 sm:p-7 shadow-elevated transition-all">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          ✕
        </button>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 animate-fade-in">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 text-2xl font-bold">
              ✓
            </div>
            <h3 className="text-xl font-bold text-foreground">Thank You for Your Feedback!</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xs leading-relaxed">
              Your insights help us continuously improve our voice models, platform speed, and therapist experience.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Header */}
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-primary/15 text-primary border border-primary/20">
                <span>💬</span>
                <span>Platform Feedback</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Your feedback is valuable to us
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tell us how TherapyxAI is performing across key areas of your experience.
              </p>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* Question 1: Voice Quality */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>🎙️</span> <span>Voice Quality</span>
                </label>
                <select
                  value={voiceQuality}
                  onChange={(e) => setVoiceQuality(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-border/70 bg-card text-foreground focus:ring-2 focus:ring-primary/40 font-medium"
                >
                  {VOICE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Question 2: Model Accuracy */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>🤖</span> <span>Model Accuracy</span>
                </label>
                <select
                  value={modelAccuracy}
                  onChange={(e) => setModelAccuracy(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-border/70 bg-card text-foreground focus:ring-2 focus:ring-primary/40 font-medium"
                >
                  {ACCURACY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Question 3: Modal Support */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>⚡</span> <span>Modal & App Performance</span>
                </label>
                <select
                  value={modalSupport}
                  onChange={(e) => setModalSupport(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-border/70 bg-card text-foreground focus:ring-2 focus:ring-primary/40 font-medium"
                >
                  {MODAL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Question 4: Therapist Integration */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>🩺</span> <span>Therapist Integration</span>
                </label>
                <select
                  value={therapistIntegration}
                  onChange={(e) => setTherapistIntegration(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-border/70 bg-card text-foreground focus:ring-2 focus:ring-primary/40 font-medium"
                >
                  {THERAPIST_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Custom Comments Text Box */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>✍️</span> <span>Additional Feedback or Suggestions</span>
                </label>
                <textarea
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Share any detailed thoughts, suggestions, or issues you encountered..."
                  className="w-full p-3 text-xs rounded-xl border border-border/70 bg-card text-foreground focus:ring-2 focus:ring-primary/40 font-medium shadow-sm"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold border border-border/70 bg-card text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-primary-foreground shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                style={{ backgroundImage: 'var(--gradient-primary)' }}
              >
                <span>{submitting ? 'Submitting...' : 'Submit Feedback'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
