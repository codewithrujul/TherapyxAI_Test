import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config';
import { supabase } from '../lib/supabaseClient';
import PageHeader from '../components/PageHeader';
import { formatINR } from '../lib/currency';

export default function AdminDashboardPage({ token, onBack, onSignOut }) {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'therapists' | 'requests'

  // Stats
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Users Tab State
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userVerifyFilter, setUserVerifyFilter] = useState('all');
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);

  // Therapists Tab State
  const [therapists, setTherapists] = useState([]);
  const [therapistsLoading, setTherapistsLoading] = useState(false);
  const [therapistSearch, setTherapistSearch] = useState('');
  const [therapistStatusFilter, setTherapistStatusFilter] = useState('all');
  const [therapistVerifyFilter, setTherapistVerifyFilter] = useState('all');
  const [therapistPage, setTherapistPage] = useState(1);
  const [therapistTotalPages, setTherapistTotalPages] = useState(1);

  // Onboarding Requests Tab State
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState('all');
  const [requestPage, setRequestPage] = useState(1);
  const [requestTotalPages, setRequestTotalPages] = useState(1);

  // Action Modals State
  const [viewingRequestDetails, setViewingRequestDetails] = useState(null);
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  // Helper headers
  const getHeaders = useCallback(() => {
    const activeTok = token || localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      ...(activeTok ? { Authorization: `Bearer ${activeTok}` } : {}),
    };
  }, [token]);

  // Show temporary toast
  const showToast = (msg, isError = false) => {
    setToastMsg({ text: msg, isError });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Verify Admin Auth Guard
  useEffect(() => {
    async function verifyAdmin() {
      try {
        setCheckingAuth(true);
        const { data: { session } } = await supabase.auth.getSession();
        const activeTok = token || session?.access_token || localStorage.getItem('accessToken');

        if (!activeTok) {
          setIsAdmin(false);
          setCheckingAuth(false);
          return;
        }

        const res = await fetch(`${API_BASE}/profile`, {
          headers: { Authorization: `Bearer ${activeTok}` },
        });

        if (res.ok) {
          const json = await res.json();
          setIsAdmin(json.profile?.role === 'admin');
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('[AdminDashboardPage] Auth error:', err);
        setIsAdmin(false);
      } finally {
        setCheckingAuth(false);
      }
    }

    verifyAdmin();
  }, [token]);

  // Fetch Stats Overview
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await fetch(`${API_BASE}/admin/stats`, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        setStats(json.stats);
      }
    } catch (err) {
      console.error('[AdminDashboardPage] fetchStats failed:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [getHeaders]);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const query = new URLSearchParams({
        page: userPage,
        limit: 10,
        search: userSearch,
        role: userRoleFilter,
        verificationStatus: userVerifyFilter,
      });

      const res = await fetch(`${API_BASE}/admin/users?${query}`, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        setUsers(json.users || []);
        setUserTotalPages(json.totalPages || 1);
      }
    } catch (err) {
      console.error('[AdminDashboardPage] fetchUsers failed:', err);
    } finally {
      setUsersLoading(false);
    }
  }, [userPage, userSearch, userRoleFilter, userVerifyFilter, getHeaders]);

  // Fetch Therapists
  const fetchTherapists = useCallback(async () => {
    try {
      setTherapistsLoading(true);
      const query = new URLSearchParams({
        page: therapistPage,
        limit: 10,
        search: therapistSearch,
        status: therapistStatusFilter,
        verificationStatus: therapistVerifyFilter,
      });

      const res = await fetch(`${API_BASE}/admin/therapists?${query}`, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        setTherapists(json.therapists || []);
        setTherapistTotalPages(json.totalPages || 1);
      }
    } catch (err) {
      console.error('[AdminDashboardPage] fetchTherapists failed:', err);
    } finally {
      setTherapistsLoading(false);
    }
  }, [therapistPage, therapistSearch, therapistStatusFilter, therapistVerifyFilter, getHeaders]);

  // Fetch Onboarding Requests
  const fetchRequests = useCallback(async () => {
    try {
      setRequestsLoading(true);
      const query = new URLSearchParams({
        page: requestPage,
        limit: 10,
        search: requestSearch,
        status: requestStatusFilter,
      });

      const res = await fetch(`${API_BASE}/admin/onboarding-requests?${query}`, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        setRequests(json.requests || []);
        setRequestTotalPages(json.totalPages || 1);
      }
    } catch (err) {
      console.error('[AdminDashboardPage] fetchRequests failed:', err);
    } finally {
      setRequestsLoading(false);
    }
  }, [requestPage, requestSearch, requestStatusFilter, getHeaders]);

  // Trigger data load based on tab
  useEffect(() => {
    if (!isAdmin) return;
    fetchStats();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'therapists') fetchTherapists();
    if (activeTab === 'requests') fetchRequests();
  }, [isAdmin, activeTab, fetchStats, fetchUsers, fetchTherapists, fetchRequests]);

  // Admin Action: Approve / Verify Onboarding Request
  const handleApproveOnboarding = async (reqId) => {
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/onboarding-requests/${reqId}/approve`, {
        method: 'POST',
        headers: getHeaders(),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to approve onboarding request');

      showToast('Therapist onboarding request approved and user role converted to therapist.');
      setViewingRequestDetails(null);
      fetchRequests();
      fetchStats();
    } catch (err) {
      showToast(err.message || 'Action failed', true);
    } finally {
      setActionLoading(false);
    }
  };

  // Admin Action: Reject request
  const handleConfirmReject = async () => {
    if (!rejectingRequest) return;
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/onboarding-requests/${rejectingRequest.id}/reject`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason: rejectionReason.trim() || undefined }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to reject request');

      showToast('Onboarding request rejected.');
      setRejectingRequest(null);
      setRejectionReason('');
      fetchRequests();
      fetchStats();
    } catch (err) {
      showToast(err.message || 'Action failed', true);
    } finally {
      setActionLoading(false);
    }
  };

  // Loading state
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground animate-pulse">
          <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>Authenticating Admin Portal...</span>
        </div>
      </div>
    );
  }

  // Access Denied Guard
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-red-500/30 bg-card p-8 shadow-2xl text-center space-y-6 animate-fade-up">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-foreground">Access Denied</h2>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Only platform administrators with the <code className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono">admin</code> role can access the Admin Management Portal.
            </p>
          </div>
          <button
            onClick={onBack}
            className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 transition-all shadow-md active:scale-95"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300">
      {/* Header — shared across every internal page: back button + theme + profile */}
      <PageHeader onBack={onBack} />

      {/* Page title + tab navigation + sign out — used to live in the header */}
      <div className="sticky top-[57px] z-30 backdrop-blur-md bg-background/80 border-b border-border/60 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <span>Admin Management Dashboard</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Admin Role
              </span>
            </h1>
          </div>
        </div>

        {/* Tab Navigation & Logout */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-2xl border border-border/50 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${activeTab === 'overview' ? 'bg-card text-foreground shadow-sm font-bold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${activeTab === 'users' ? 'bg-card text-foreground shadow-sm font-bold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Users List
          </button>
          <button
            onClick={() => setActiveTab('therapists')}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${activeTab === 'therapists' ? 'bg-card text-foreground shadow-sm font-bold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Therapists List
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${activeTab === 'requests' ? 'bg-card text-foreground shadow-sm font-bold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <span>Onboarding Requests</span>
            {stats?.pendingRequestsCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                {stats.pendingRequestsCount}
              </span>
            )}
          </button>
        </div>

        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
            title="Sign out of Admin Dashboard"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Sign Out</span>
          </button>
        )}
      </div>
      </div>

      {/* ── Toast Alert ── */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl border text-xs font-semibold shadow-xl flex items-center gap-2 animate-bounce ${toastMsg.isError ? 'bg-red-500/90 text-white border-red-400' : 'bg-emerald-600 text-white border-emerald-500'}`}>
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* ── Main Dashboard Body ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-up">
            <h2 className="text-lg font-bold text-foreground">Platform Metrics & Overview</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Users Stats Card */}
              <div className="p-6 rounded-3xl border border-border/60 bg-card shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Registered Users</span>
                  <span className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </span>
                </div>
                <div className="text-3xl font-extrabold text-foreground">{stats?.users?.total ?? 0}</div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                    ✓ {stats?.users?.verified ?? 0} Verified
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">
                    {stats?.users?.unverified ?? 0} Unverified
                  </span>
                </div>
              </div>

              {/* Therapists Stats Card */}
              <div className="p-6 rounded-3xl border border-border/60 bg-card shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Platform Therapists</span>
                  <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                  </span>
                </div>
                <div className="text-3xl font-extrabold text-foreground">{stats?.therapists?.total ?? 0}</div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                    ✓ {stats?.therapists?.verified ?? 0} Verified
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">
                    {stats?.therapists?.unverified ?? 0} Unverified
                  </span>
                </div>
              </div>

              {/* Pending Requests Stats Card */}
              <div className="p-6 rounded-3xl border border-amber-500/30 bg-amber-500/5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending Requests</span>
                  <span className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </span>
                </div>
                <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">{stats?.pendingRequestsCount ?? 0}</div>
                <p className="text-xs text-muted-foreground">Requests awaiting administrator review</p>
              </div>
            </div>
          </div>
        )}

        {/* USERS LIST TAB */}
        {activeTab === 'users' && (
          <div className="space-y-4 animate-fade-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-foreground">Registered Accounts</h2>
              
              {/* Filter Controls */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={userSearch}
                  onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
                  className="px-3 py-1.5 rounded-xl border border-border/60 bg-card text-foreground focus:outline-none focus:border-primary"
                />
                <select
                  value={userRoleFilter}
                  onChange={e => { setUserRoleFilter(e.target.value); setUserPage(1); }}
                  className="px-3 py-1.5 rounded-xl border border-border/60 bg-card text-foreground"
                >
                  <option value="all">All Roles</option>
                  <option value="patient">Patient (User)</option>
                  <option value="therapist">Therapist</option>
                  <option value="admin">Admin</option>
                </select>
                <select
                  value={userVerifyFilter}
                  onChange={e => { setUserVerifyFilter(e.target.value); setUserPage(1); }}
                  className="px-3 py-1.5 rounded-xl border border-border/60 bg-card text-foreground"
                >
                  <option value="all">All Verification</option>
                  <option value="verified">Verified Users</option>
                  <option value="unverified">Unverified Users</option>
                </select>
              </div>
            </div>

            {/* Users Data Table */}
            <div className="rounded-3xl border border-border/60 bg-card overflow-hidden shadow-sm">
              {usersLoading ? (
                <div className="p-8 text-center text-xs font-semibold text-muted-foreground animate-pulse">Loading users...</div>
              ) : users.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">No matching users found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider font-bold">
                      <tr>
                        <th className="px-6 py-3.5">User</th>
                        <th className="px-6 py-3.5">Role</th>
                        <th className="px-6 py-3.5">Verification Status</th>
                        <th className="px-6 py-3.5">Created Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-foreground">{u.name || 'Unnamed User'}</div>
                            <div className="text-muted-foreground font-mono text-[11px]">{u.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold capitalize ${u.role === 'admin' ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20' : u.role === 'therapist' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'}`}>
                              {u.role || 'patient'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {u.onboarding_completed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                ✓ Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                • Unverified
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {new Date(u.created_at || Date.now()).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              <div className="px-6 py-3 bg-muted/20 border-t border-border/40 flex items-center justify-between text-xs">
                <button
                  disabled={userPage <= 1}
                  onClick={() => setUserPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg border border-border/60 bg-card disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-muted-foreground font-medium">Page {userPage} of {userTotalPages}</span>
                <button
                  disabled={userPage >= userTotalPages}
                  onClick={() => setUserPage(p => p + 1)}
                  className="px-3 py-1 rounded-lg border border-border/60 bg-card disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* THERAPISTS LIST TAB */}
        {activeTab === 'therapists' && (
          <div className="space-y-4 animate-fade-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-foreground">Registered Therapists</h2>
              
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Search therapist name or title..."
                  value={therapistSearch}
                  onChange={e => { setTherapistSearch(e.target.value); setTherapistPage(1); }}
                  className="px-3 py-1.5 rounded-xl border border-border/60 bg-card text-foreground focus:outline-none focus:border-primary"
                />
                <select
                  value={therapistVerifyFilter}
                  onChange={e => { setTherapistVerifyFilter(e.target.value); setTherapistPage(1); }}
                  className="px-3 py-1.5 rounded-xl border border-border/60 bg-card text-foreground"
                >
                  <option value="all">All Verification</option>
                  <option value="verified">Verified Therapists</option>
                  <option value="unverified">Unverified Therapists</option>
                </select>
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card overflow-hidden shadow-sm">
              {therapistsLoading ? (
                <div className="p-8 text-center text-xs font-semibold text-muted-foreground animate-pulse">Loading therapists...</div>
              ) : therapists.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">No therapists found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider font-bold">
                      <tr>
                        <th className="px-6 py-3.5">Therapist</th>
                        <th className="px-6 py-3.5">Verification</th>
                        <th className="px-6 py-3.5">Account Status</th>
                        <th className="px-6 py-3.5">Rate</th>
                        <th className="px-6 py-3.5">Created Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {therapists.map(t => (
                        <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-foreground">{t.full_name}</div>
                            <div className="text-muted-foreground text-[11px]">{t.title} • {t.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            {t.is_verified ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                ✓ Verified Practitioner
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                • Unverified
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded bg-muted font-bold text-[10px] uppercase">{t.status}</span>
                          </td>
                          <td className="px-6 py-4 font-bold text-foreground">
                            {formatINR(t.hourly_rate)}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {new Date(t.created_at || Date.now()).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="px-6 py-3 bg-muted/20 border-t border-border/40 flex items-center justify-between text-xs">
                <button
                  disabled={therapistPage <= 1}
                  onClick={() => setTherapistPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg border border-border/60 bg-card disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-muted-foreground font-medium">Page {therapistPage} of {therapistTotalPages}</span>
                <button
                  disabled={therapistPage >= therapistTotalPages}
                  onClick={() => setTherapistPage(p => p + 1)}
                  className="px-3 py-1 rounded-lg border border-border/60 bg-card disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ONBOARDING REQUESTS TAB */}
        {activeTab === 'requests' && (
          <div className="space-y-4 animate-fade-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Incoming Onboarding Requests</h2>
                <p className="text-xs text-muted-foreground">Review user submitted therapist applications, inspect details, and approve or reject candidates.</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Search applicant name or email..."
                  value={requestSearch}
                  onChange={e => { setRequestSearch(e.target.value); setRequestPage(1); }}
                  className="px-3 py-1.5 rounded-xl border border-border/60 bg-card text-foreground focus:outline-none focus:border-primary"
                />
                <select
                  value={requestStatusFilter}
                  onChange={e => { setRequestStatusFilter(e.target.value); setRequestPage(1); }}
                  className="px-3 py-1.5 rounded-xl border border-border/60 bg-card text-foreground"
                >
                  <option value="all">All Request Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card overflow-hidden shadow-sm">
              {requestsLoading ? (
                <div className="p-8 text-center text-xs font-semibold text-muted-foreground animate-pulse">Loading onboarding requests...</div>
              ) : requests.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">No onboarding requests found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider font-bold">
                      <tr>
                        <th className="px-6 py-3.5">Applicant User</th>
                        <th className="px-6 py-3.5">Request Date</th>
                        <th className="px-6 py-3.5">Current Status</th>
                        <th className="px-6 py-3.5">User Role</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {requests.map(r => (
                        <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-foreground">{r.form_data?.fullName || r.profiles?.name || 'Applicant'}</div>
                            <div className="text-muted-foreground text-[11px] font-mono">{r.form_data?.email || r.profiles?.email}</div>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {new Date(r.requested_at || r.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold capitalize ${r.status === 'pending' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : r.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-red-500/10 text-red-600 border border-red-500/20'}`}>
                              {r.status === 'pending' ? '• Pending Admin Review' : r.status === 'approved' ? '✓ Approved & Converted' : '✕ Rejected'}
                            </span>
                            {r.rejection_reason && (
                              <div className="text-[10px] text-red-500 mt-1">Reason: {r.rejection_reason}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono text-[11px] capitalize">
                            {r.profiles?.role || 'patient'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {r.status === 'pending' && (
                              <div className="flex items-center justify-end gap-2">
                                {r.form_data && Object.keys(r.form_data).length > 0 && (
                                  <button
                                    onClick={() => setViewingRequestDetails(r)}
                                    className="px-3 py-1.5 rounded-xl border border-border/60 hover:bg-muted text-foreground font-bold text-[11px] transition-all"
                                  >
                                    View Details
                                  </button>
                                )}
                                <button
                                  disabled={actionLoading}
                                  onClick={() => handleApproveOnboarding(r.id)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                >
                                  Verify / Approve
                                </button>
                                <button
                                  disabled={actionLoading}
                                  onClick={() => setRejectingRequest(r)}
                                  className="px-3 py-1.5 rounded-xl border border-red-500/30 text-red-600 hover:bg-red-500/10 font-bold text-[11px] transition-all active:scale-95 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            )}

                            {(r.status === 'approved' || r.status === 'rejected') && (
                              <div className="flex items-center justify-end gap-2">
                                {r.form_data && Object.keys(r.form_data).length > 0 && (
                                  <button
                                    onClick={() => setViewingRequestDetails(r)}
                                    className="px-2.5 py-1 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground font-semibold text-[10px]"
                                  >
                                    View Details
                                  </button>
                                )}
                                <span className="text-[11px] font-medium text-muted-foreground capitalize">{r.status}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="px-6 py-3 bg-muted/20 border-t border-border/40 flex items-center justify-between text-xs">
                <button
                  disabled={requestPage <= 1}
                  onClick={() => setRequestPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg border border-border/60 bg-card disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-muted-foreground font-medium">Page {requestPage} of {requestTotalPages}</span>
                <button
                  disabled={requestPage >= requestTotalPages}
                  onClick={() => setRequestPage(p => p + 1)}
                  className="px-3 py-1 rounded-lg border border-border/60 bg-card disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* VIEW SUBMITTED DETAILS MODAL */}
      {viewingRequestDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-xl w-full rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-foreground">Submitted Application Details</h3>
                <p className="text-xs text-muted-foreground font-mono">{viewingRequestDetails.form_data?.email || viewingRequestDetails.profiles?.email}</p>
              </div>
              <button
                onClick={() => setViewingRequestDetails(null)}
                className="p-1 rounded-xl hover:bg-muted text-muted-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/40">
                <div><span className="text-muted-foreground">Applicant Name:</span> <strong className="text-foreground">{viewingRequestDetails.form_data?.fullName || viewingRequestDetails.profiles?.name}</strong></div>
                <div><span className="text-muted-foreground">Professional Title:</span> <strong className="text-foreground">{viewingRequestDetails.form_data?.title || '—'}</strong></div>
                <div><span className="text-muted-foreground">Years of Experience:</span> {viewingRequestDetails.form_data?.yearsOfExperience || 0} years</div>
                <div><span className="text-muted-foreground">Location:</span> {viewingRequestDetails.form_data?.addressCity || '—'}</div>
                <div><span className="text-muted-foreground">Hourly Rate:</span> {formatINR(viewingRequestDetails.form_data?.hourlyRate || 0)}</div>
                <div><span className="text-muted-foreground">Phone:</span> {viewingRequestDetails.form_data?.phone || '—'}</div>
              </div>

              {viewingRequestDetails.form_data?.shortHeadline && (
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase">Headline</label>
                  <p className="mt-1 p-2.5 rounded-xl bg-muted/30 border border-border/40 text-foreground">{viewingRequestDetails.form_data.shortHeadline}</p>
                </div>
              )}

              {viewingRequestDetails.form_data?.bio && (
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase">Biography</label>
                  <p className="mt-1 p-2.5 rounded-xl bg-muted/30 border border-border/40 text-foreground leading-relaxed whitespace-pre-wrap">{viewingRequestDetails.form_data.bio}</p>
                </div>
              )}

              {viewingRequestDetails.form_data?.specialties?.length > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase">Specialties</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {viewingRequestDetails.form_data.specialties.map(s => (
                      <span key={s} className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-semibold text-[11px]">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {viewingRequestDetails.form_data?.languages?.length > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase">Languages Spoken</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {viewingRequestDetails.form_data.languages.map(l => (
                      <span key={l} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">{l}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <button
                onClick={() => setViewingRequestDetails(null)}
                className="px-4 py-2 rounded-xl border border-border/60 bg-card hover:bg-muted text-xs font-bold text-foreground"
              >
                Close
              </button>

              {viewingRequestDetails.status === 'pending' && (
                <div className="flex items-center gap-2">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleApproveOnboarding(viewingRequestDetails.id)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold shadow-md active:scale-95 disabled:opacity-50"
                  >
                    Verify / Approve
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => {
                      setRejectingRequest(viewingRequestDetails);
                      setViewingRequestDetails(null);
                    }}
                    className="px-4 py-2 rounded-xl border border-red-500/30 text-red-600 hover:bg-red-500/10 text-xs font-bold transition-all disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl border border-border/80 bg-card p-6 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="text-base font-extrabold text-foreground">Reject Therapist Onboarding Request</h3>
            <p className="text-xs text-muted-foreground">
              Rejecting this request will inform <strong className="text-foreground">{rejectingRequest.form_data?.fullName || rejectingRequest.profiles?.name}</strong> that their request was not approved at this time.
            </p>

            <textarea
              rows={3}
              placeholder="Optional rejection feedback / reason..."
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border/60 bg-muted/50 text-foreground text-xs focus:outline-none focus:border-red-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingRequest(null)}
                className="px-4 py-2 rounded-xl border border-border/60 bg-card hover:bg-muted text-xs font-bold text-foreground"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 text-xs font-bold shadow-md active:scale-95 disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
