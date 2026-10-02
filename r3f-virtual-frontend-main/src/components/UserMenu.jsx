import { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "../theme";

import { API_BASE } from '../config';

// ── Streak calculator ─────────────────────────────────────────────────────────
function calcStreak(sessions) {
  if (!sessions?.length) return 0;

  // Collect unique calendar dates (local) from session start_times
  const dateSet = new Set(
    sessions.map(s => new Date(s.start_time).toLocaleDateString("en-CA")) // "YYYY-MM-DD"
  );

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toLocaleDateString("en-CA");
    if (dateSet.has(key)) {
      streak++;
    } else if (i > 0) {
      // Allow today to be missing (haven't done today's session yet)
      // but break on any earlier gap
      break;
    }
  }
  return streak;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function UserMenu({
  user,
  token,
  onSignOut,
  onOpenTherapistDashboard,
  onOpenAdminDashboard,
  onOpenTherapistOnboarding,
  onOpenMyProfile,
  isInTherapistPortal: propIsInTherapistPortal,
}) {
  const isPortal = propIsInTherapistPortal ?? (typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/therapist') ||
    window.location.pathname.includes('/therapist')
  ));
  const { t, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState(null); // { count }
  const [loading, setLoading] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch therapist onboarding request status
  const fetchOnboardingStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/therapist-onboarding/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setOnboardingStatus(json.request?.status || "none");
      }
    } catch {
      setOnboardingStatus("none");
    }
  }, [token]);

  // Fetch stats when dropdown opens
  const fetchStats = useCallback(async () => {
    if (!token || stats) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error();
      const { sessions } = await r.json();
      setStats({ count: sessions.length, streak: calcStreak(sessions) });
    } catch {
      setStats({ count: null, streak: null });
    } finally {
      setLoading(false);
    }
  }, [token, stats]);

  const handleOpen = () => {
    setOpen(p => !p);
    if (!open) {
      if (user.role !== 'therapist' && !isPortal) {
        fetchStats();
      }
      fetchOnboardingStatus();
    }
  };

  const handleRegisterAsTherapist = async () => {
    try {
      setRequestLoading(true);
      const res = await fetch(`${API_BASE}/therapist-onboarding/request`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to submit request");

      setOnboardingStatus("pending");
      setShowConfirmModal(true);
    } catch (err) {
      alert(err.message || "Could not submit therapist onboarding request.");
    } finally {
      setRequestLoading(false);
    }
  };

  const initials = (user.name || "U")
    .split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const firstName = user.name?.split(" ")[0] ?? "there";

  // ── Derived display ──
  const sessionLabel = loading ? "…" : stats?.count != null ? stats.count : "—";

  return (
    <div ref={ref} style={{ position: "relative" }}>

      {/* ── Trigger ── */}
      <button
        onClick={handleOpen}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "5px 10px 5px 5px",
          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
          border: `1px solid ${t.cardBorder}`,
          borderRadius: 10, cursor: "pointer",
          transition: "background .2s, border-color .2s", outline: "none",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background  = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";
          e.currentTarget.style.borderColor = t.cardBorderHover;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background  = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
          e.currentTarget.style.borderColor = t.cardBorder;
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: t.avatarGradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.03em",
        }}>{initials}</div>

        <span style={{
          fontSize: 13, fontWeight: 500, color: t.text,
          maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {firstName}
        </span>

        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          style={{
            color: t.textSubtle, flexShrink: 0,
            transition: "transform .2s",
            transform: open ? "rotate(180deg)" : "rotate(0)",
          }}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: "min(240px, calc(100vw - 24px))", zIndex: 100,
          background: t.cardBg, border: `1px solid ${t.cardBorder}`,
          borderRadius: 14, overflow: "hidden",
          boxShadow: isDark
            ? "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)"
            : "0 8px 32px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)",
        }}>

          {/* ── User info ── */}
          <div style={{
            padding: "14px 16px",
            borderBottom: `1px solid ${t.divider}`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: t.avatarGradient,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700, color: "#fff",
            }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: t.textBright,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {user.name}
              </div>
              <div style={{
                fontSize: 11, color: t.textSubtle,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                marginTop: 2,
              }}>
                {user.email}
              </div>
              {user.role === 'therapist' && (
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "#10b981",
                  marginTop: 3, display: "flex", alignItems: "center", gap: 4,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981" }} />
                  <span>Verified Practitioner</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Stats (Sessions count for patients only; streak removed) ── */}
          {user.role !== 'therapist' && !isPortal && (
            <div style={{
              display: "flex",
              borderBottom: `1px solid ${t.divider}`,
            }}>
              <StatCell
                value={sessionLabel}
                label="Sessions"
                icon={
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: t.accent }}>
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
                          stroke="currentColor" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
                t={t}
                divider={false}
              />
            </div>
          )}

          {/* ── Actions ── */}
          <div style={{ padding: "6px" }}>
            {user.role === 'admin' && (
              <MenuRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
                label="Admin Dashboard"
                color={t.accent || "#3b82f6"}
                hoverBg={isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)"}
                onClick={() => { setOpen(false); if (onOpenAdminDashboard) onOpenAdminDashboard(); }}
              />
            )}

            {user.role === 'therapist' && !isPortal && (
              <MenuRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
                label="Practitioner Portal"
                color="#10b981"
                hoverBg={isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.08)"}
                onClick={() => { setOpen(false); if (onOpenTherapistDashboard) onOpenTherapistDashboard(); }}
              />
            )}

            {user.role !== 'admin' && user.role !== 'therapist' && (
              <>
                {onboardingStatus === 'pending' && (
                  <div style={{ padding: "8px 10px", fontSize: 12, fontWeight: 600, color: "#d97706", background: "rgba(217,119,6,0.1)", borderRadius: 8, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d97706" }} />
                    <span>Practitioner onboarding request pending</span>
                  </div>
                )}

                {onboardingStatus !== 'pending' && (
                  <MenuRow
                    icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>}
                    label="Register as Practitioner"
                    color="#8b5cf6"
                    hoverBg={isDark ? "rgba(139,92,246,0.12)" : "rgba(139,92,246,0.08)"}
                    onClick={() => { setOpen(false); if (onOpenTherapistOnboarding) onOpenTherapistOnboarding(); }}
                  />
                )}
              </>
            )}

            {onOpenMyProfile && (
              <MenuRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>}
                label="View Profile"
                color="#0d9488"
                hoverBg={isDark ? "rgba(13,148,136,0.14)" : "rgba(13,148,136,0.08)"}
                onClick={() => { setOpen(false); onOpenMyProfile(); }}
              />
            )}

            <MenuRow
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
                        stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="16 17 21 12 16 7"
                        stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="21" y1="12" x2="9" y2="12"
                        stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
              label="Sign out"
              color={t.danger}
              hoverBg={isDark ? "rgba(200,74,74,0.1)" : "rgba(220,38,38,0.06)"}
              onClick={() => { setOpen(false); onSignOut(); }}
            />
          </div>
        </div>
      )}

      {/* ── Confirmation Modal ── */}
      {showConfirmModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div style={{
            maxWidth: 400, width: "100%", background: t.cardBg, border: `1px solid ${t.cardBorder}`,
            borderRadius: 20, padding: 24, textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.3)"
          }}>
            <div style={{
              width: 50, height: 50, margin: "0 auto 16px", borderRadius: "50%",
              background: "rgba(16,185,129,0.15)", color: "#10b981",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: t.textBright, marginBottom: 8 }}>
              Request Sent to Administrator
            </h3>
            <p style={{ fontSize: 13, color: t.textSubtle, lineHeight: 1.5, marginBottom: 20 }}>
              Your request for therapist onboarding has been sent to the administrator. You will be notified when your onboarding process is ready.
            </p>
            <button
              onClick={() => {
                setShowConfirmModal(false);
                setOpen(false);
                if (typeof window !== 'undefined' && window.location.pathname !== '/') {
                  window.location.href = '/';
                }
              }}
              style={{
                width: "100%", padding: "10px 16px", borderRadius: 12,
                background: "#8b5cf6", color: "#ffffff", border: "none",
                fontWeight: 700, fontSize: 13, cursor: "pointer"
              }}
            >
              Return to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCell({ value, label, icon, t }) {
  return (
    <div style={{
      flex: 1,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "12px 8px", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {icon}
        <span style={{
          fontSize: 16, fontWeight: 700, color: t.textBright,
          letterSpacing: "-0.01em",
        }}>{value}</span>
      </div>
      <span style={{ fontSize: 10, color: t.textSubtle, textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </span>
    </div>
  );
}

function MenuRow({ icon, label, color, hoverBg, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "12px 10px", minHeight: 44,
        background: hovered ? hoverBg : "transparent",
        border: "none", borderRadius: 8,
        cursor: "pointer", fontSize: 13, color,
        transition: "background .15s", textAlign: "left",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
