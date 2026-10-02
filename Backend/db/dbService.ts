import { UserMemory } from "../memory/memoService";
import { supabaseAdmin } from "./supabaseClient";
import { EMPTY_MEMORY } from "../memory/memoService";
import { decrypt, decryptJson, encrypt, encryptJson } from "../utils/encryption";

export interface UserProfileData {
    email:               string | null;
    name:                string | null;
    role:                string;
    languageCode:        string | null;
    reason:              string | null;
    gender:              string | null;
    profession:          string | null;
    ageGroup:            string | null;
    onboardingCompleted: boolean;
    onboardingSkipped:   boolean;
    isComplete:          boolean;
    completionPercentage: number;
}

interface ProfileRow {
    id:                   string;
    email:                string | null;
    name:                 string | null;
    role:                 string | null;
    languageCode:         string | null;
    why_here:             string | null;
    gender:               string | null;
    profession:           string | null;
    age_group:            string | null;
    onboarding_completed: boolean | null;
    onboarding_skipped:   boolean | null;
}

function mapProfileRow(row: ProfileRow | null): UserProfileData {
    const gender     = row?.gender     ?? null;
    const profession = row?.profession ?? null;
    const ageGroup   = row?.age_group  ?? null;
    const completedFields = [gender, profession, ageGroup].filter(Boolean).length;

    return {
        email:               row?.email ?? null,
        name:                row?.name ?? null,
        role:                row?.role ?? "patient",
        languageCode:        row?.languageCode ?? null,
        reason:              row?.why_here ?? null,
        gender,
        profession,
        ageGroup,
        onboardingCompleted: Boolean(row?.onboarding_completed),
        onboardingSkipped:   Boolean(row?.onboarding_skipped),
        isComplete:          Boolean(gender && profession && ageGroup),
        completionPercentage: Math.round((completedFields / 3) * 100),
    };
}

export async function fetchUserProfile(userId: string): Promise<UserProfileData> {
    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, email, name, role, languageCode, why_here, gender, profession, age_group, onboarding_completed, onboarding_skipped")
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        console.error(`[DB] fetchUserProfile failed  userId=${userId}  err=${error.message}`);
        throw new Error("Failed to fetch profile");
    }

    return mapProfileRow((data as ProfileRow | null) ?? null);
}

export async function upsertUserProfile(
    userId: string,
    userIdentity: { email: string; name?: string | null },
    profile: {
        languageCode?: string | null;
        reason?: string | null;
        gender?: string | null;
        profession?: string | null;
        ageGroup?: string | null;
        onboardingCompleted?: boolean;
        onboardingSkipped?: boolean;
    }
): Promise<UserProfileData> {
    const current = await fetchUserProfile(userId);
    const payload = {
        id:                   userId,
        email:                userIdentity.email,
        name:                 userIdentity.name ?? null,
        languageCode:         profile.languageCode === undefined ? current.languageCode : profile.languageCode,
        why_here:             profile.reason     === undefined ? current.reason     : profile.reason,
        gender:               profile.gender     === undefined ? current.gender     : profile.gender,
        profession:           profile.profession === undefined ? current.profession : profile.profession,
        age_group:            profile.ageGroup   === undefined ? current.ageGroup   : profile.ageGroup,
        onboarding_completed: profile.onboardingCompleted === undefined
            ? current.onboardingCompleted
            : profile.onboardingCompleted,
        onboarding_skipped: profile.onboardingSkipped === undefined
            ? current.onboardingSkipped
            : profile.onboardingSkipped,
        updated_at:           new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
        .from("profiles")
        .upsert(payload, { onConflict: "id" })
        .select("id, email, name, languageCode, why_here, gender, profession, age_group, onboarding_completed, onboarding_skipped")
        .single();

    if (error || !data) {
        console.error(`[DB] upsertUserProfile failed  userId=${userId}  err=${error?.message}`);
        throw new Error("Failed to update profile");
    }

    return mapProfileRow(data as ProfileRow);
}

// ─── Session lifecycle ────────────────────────────────────────────────────────

export async function createSessionInDB(userId: string, moodCheckin?: number, languageCode?: string): Promise<string> {
    const payload: Record<string, unknown> = { user_id: userId, status: "active", language_code: languageCode ?? "en-IN" };
    if (moodCheckin != null) payload.mood_checkin = moodCheckin;

    const { data, error } = await supabaseAdmin
        .from("sessions")
        .insert(payload)
        .select("id")
        .single();

    if (error || !data) {
        console.error(`[DB] createSession failed  userId=${userId}  err=${error?.message}`);
        throw new Error("Failed to create session");
    }

    console.log(`[DB] Session created  sessionId=${data.id}  userId=${userId}`);
    return data.id as string;
}

export async function createGuestSessionInDB(guestId: string, guestName: string, languageCode?: string): Promise<string> {
    const { data, error } = await supabaseAdmin
        .from("sessions")
        .insert({ guest_id: guestId, guest_name: guestName, status: "active", language_code: languageCode ?? "en-IN" })
        .select("id")
        .single();

    if (error || !data) {
        console.error(`[DB] createGuestSession failed  guestId=${guestId}  err=${error?.message}`);
        throw new Error("Failed to create guest session");
    }

    console.log(`[DB] Guest session created  sessionId=${data.id}  guestId=${guestId}  name=${guestName}`);
    return data.id as string;
}

export async function linkGuestSessionsToUser(guestId: string, userId: string): Promise<number> {
    const { data, error } = await supabaseAdmin
        .from("sessions")
        .update({ user_id: userId, guest_id: null, guest_name: null })
        .eq("guest_id", guestId)
        .select("id");

    if (error) {
        console.error(`[DB] linkGuestSessions failed  guestId=${guestId}  userId=${userId}  err=${error.message}`);
        return 0;
    }

    const count = data?.length ?? 0;
    console.log(`[DB] Guest sessions linked  guestId=${guestId}  userId=${userId}  count=${count}`);
    return count;
}

export async function endSessionInDB(sessionId: string, durationSecs: number | null = null): Promise<void> {
    const { error } = await supabaseAdmin
        .from("sessions")
        .update({
            status:        "completed",
            end_time:      new Date().toISOString(),
            duration_secs: durationSecs,
        })
        .eq("id", sessionId);

    if (error) {
        console.error(`[DB] endSession failed  sessionId=${sessionId}  err=${error.message}`);
        return;
    }

    console.log(`[DB] Session ended  sessionId=${sessionId}  duration=${durationSecs}s`);
}

// ─── Post-session mood checkout ("how do you feel now?") ─────────────────────
// Signed-in users: sessionId is the real DB row id (from /session/start), update directly.
// Guests: the frontend never learns the real DB session id (it's created server-side
// over the WS handshake), so we resolve it via guest_id — most recent row for that guest.
export async function updateMoodCheckout(
    { sessionId, guestId, moodCheckout }: { sessionId?: string; guestId?: string; moodCheckout: number }
): Promise<boolean> {
    if (sessionId) {
        const { data, error } = await supabaseAdmin
            .from("sessions")
            .update({ mood_checkout: moodCheckout })
            .eq("id", sessionId)
            .select("id");

        if (error) {
            console.error(`[DB] updateMoodCheckout failed  sessionId=${sessionId}  err=${error.message}`);
            return false;
        }
        if (data?.length) {
            console.log(`[DB] Mood checkout saved  sessionId=${sessionId}  mood=${moodCheckout}`);
            return true;
        }
        // Fall through to guestId lookup if no row matched (e.g. placeholder guest id was passed as sessionId)
    }

    if (guestId) {
        const { data: recent, error: findErr } = await supabaseAdmin
            .from("sessions")
            .select("id")
            .eq("guest_id", guestId)
            .order("start_time", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (findErr || !recent) {
            console.error(`[DB] updateMoodCheckout: no session found for guestId=${guestId}  err=${findErr?.message}`);
            return false;
        }

        const { error: updateErr } = await supabaseAdmin
            .from("sessions")
            .update({ mood_checkout: moodCheckout })
            .eq("id", recent.id);

        if (updateErr) {
            console.error(`[DB] updateMoodCheckout failed  guestId=${guestId}  sessionId=${recent.id}  err=${updateErr.message}`);
            return false;
        }
        console.log(`[DB] Mood checkout saved  guestId=${guestId}  sessionId=${recent.id}  mood=${moodCheckout}`);
        return true;
    }

    console.error(`[DB] updateMoodCheckout: neither a valid sessionId nor guestId was provided`);
    return false;
}

// ─── Startup cleanup — mark orphaned active sessions as completed ─────────────
// Called once on server start. Sessions left in "active" state from before a
// backend restart would otherwise accumulate huge duration_secs on next end call.
export async function cleanupOrphanedSessions(): Promise<void> {
    const { data, error } = await supabaseAdmin
        .from("sessions")
        .update({ status: "completed", end_time: new Date().toISOString(), duration_secs: null })
        .eq("status", "active")
        .select("id");

    if (error) {
        console.error(`[DB] cleanupOrphanedSessions failed  err=${error.message}`);
        return;
    }
    const n = data?.length ?? 0;
    if (n > 0) console.log(`[DB] Cleaned up ${n} orphaned session(s) from previous run`);
}

// ─── Chat messages ────────────────────────────────────────────────────────────

export async function saveChatMessage(
    sessionId: string,
    userId:    string,
    userMsg:   string,
    aiReply:   string,
    mode:      "chat" | "voice"
): Promise<void> {
    if (userId.startsWith("guest_")) {
        // Guest chats are kept in session memory only, UNLESS explicitly enabled.
        // When enabled they go to their own table (never chat_messages), encrypted with
        // the guest id as the key salt, exactly like registered users' messages.
        if (process.env.STORE_GUEST_CHATS !== "true") return;

        const { error: guestErr } = await supabaseAdmin
            .from("guest_chat_messages")
            .insert({
                session_id: sessionId,
                guest_id:   userId,
                user_msg:   encrypt(userMsg, userId),
                ai_reply:   encrypt(aiReply, userId),
                mode,
            });
        if (guestErr) {
            console.error(`[DB] saveChatMessage (guest) failed  sessionId=${sessionId}  err=${guestErr.message}`);
        }
        return;
    }

    const { error } = await supabaseAdmin
        .from("chat_messages")
        .insert({
            session_id: sessionId,
            user_id: userId,
            user_msg: encrypt(userMsg, userId),
            ai_reply: encrypt(aiReply, userId),
            mode,
        });

    if (error) {
        console.error(`[DB] saveChatMessage failed  sessionId=${sessionId}  err=${error.message}`);
    }
}

// ─── Session summary ──────────────────────────────────────────────────────────

export async function saveSessionSummary(
    sessionId: string,
    userId:    string,
    summary:   string,
    memories:  UserMemory
): Promise<void> {
    if (!summary.trim()) return;

    const { error } = await supabaseAdmin
        .from("session_summaries")
        .insert({
            session_id: sessionId,
            user_id:    userId,
            summary:    encrypt(summary, userId),
            memories:   encryptJson(memories, userId),
            updated_at: new Date().toISOString(),
        });

    if (error) {
        console.error(`[DB] saveSessionSummary failed  sessionId=${sessionId}  err=${error.message}`);
        return;
    }

    console.log(`[DB] Summary saved  sessionId=${sessionId}  length=${summary.length}`);
}

// ─── Session history ──────────────────────────────────────────────────────────

export async function fetchUserSessions(userId: string): Promise<Array<{
    id:            string;
    start_time:    string;
    end_time:      string | null;
    duration_secs: number | null;
    mood_checkin:  number | null;
    mood_checkout: number | null;
    summary:       string | null;
    mood:          string | null;
}>> {
    const { data: sessions, error } = await supabaseAdmin
        .from("sessions")
        .select("id, start_time, end_time, duration_secs, mood_checkin, mood_checkout")
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("start_time", { ascending: false });

    if (error || !sessions?.length) return [];

    const sessionIds = sessions.map(s => s.id);
    const { data: summaries } = await supabaseAdmin
        .from("session_summaries")
        .select("session_id, summary, memories")
        .in("session_id", sessionIds);

    const summaryMap = new Map((summaries ?? []).map(s => [s.session_id, s]));

    return sessions.map(s => {
        const row = summaryMap.get(s.id);
        const memories = row?.memories
            ? decryptJson<UserMemory>(row.memories, userId, EMPTY_MEMORY)
            : EMPTY_MEMORY;
        return {
            id:            s.id,
            start_time:    s.start_time,
            end_time:      s.end_time,
            duration_secs: s.duration_secs,
            mood_checkin:  s.mood_checkin ?? null,
            mood_checkout: s.mood_checkout ?? null,
            summary:       row?.summary ? decrypt(row.summary, userId) : null,
            mood:          memories.mood ?? null,
        };
    });
}

export async function fetchSessionDetail(sessionId: string, userId: string): Promise<{
    session:  { id: string; start_time: string; end_time: string | null; duration_secs: number | null; } | null;
    summary:  string | null;
    memories: UserMemory | null;
    messages: Array<{ user_msg: string; ai_reply: string; mode: string; }>;
}> {
    const { data: session, error: sessErr } = await supabaseAdmin
        .from("sessions")
        .select("id, start_time, end_time, duration_secs")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .single();

    if (sessErr || !session) {
        return { session: null, summary: null, memories: null, messages: [] };
    }

    const [{ data: sumRow }, { data: messages }] = await Promise.all([
        supabaseAdmin
            .from("session_summaries")
            .select("summary, memories")
            .eq("session_id", sessionId)
            .maybeSingle(),
        supabaseAdmin
            .from("chat_messages")
            .select("user_msg, ai_reply, mode")
            .eq("session_id", sessionId),
    ]);

    return {
        session,
        summary:  sumRow?.summary ? decrypt(sumRow.summary, userId) : null,
        memories: sumRow?.memories
            ? decryptJson<UserMemory>(sumRow.memories, userId, EMPTY_MEMORY)
            : null,
        messages: (messages ?? []).map((row) => ({
            ...row,
            user_msg: decrypt(row.user_msg, userId),
            ai_reply: decrypt(row.ai_reply, userId),
        })),
    };
}

// ─── Credits ─────────────────────────────────────────────────────────────────

export async function getCreditBalance(userId: string): Promise<number> {
    const { data, error } = await supabaseAdmin
        .from("user_credits")
        .select("balance_minutes")
        .eq("user_id", userId)
        .single();

    if (error || !data) return 0;
    return (data.balance_minutes as number) ?? 0;
}

export async function initUserCredits(userId: string, giftMinutes = 30): Promise<void> {
    const { error } = await supabaseAdmin
        .from("user_credits")
        .insert({
            user_id:          userId,
            balance_minutes:  giftMinutes,
            total_gifted:     giftMinutes,
            total_purchased:  0,
        });

    if (error) {
        console.error(`[DB] initUserCredits failed  userId=${userId}  err=${error.message}`);
        return;
    }

    await supabaseAdmin.from("credit_transactions").insert({
        user_id:     userId,
        amount:      giftMinutes,
        type:        "initial",
        description: "Welcome gift — 30 free minutes",
    });

    console.log(`[DB] Credits initialised  userId=${userId}  minutes=${giftMinutes}`);
}

export async function deductSessionCredits(userId: string, sessionId: string, minutes: number): Promise<void> {
    const { data, error } = await supabaseAdmin
        .from("user_credits")
        .select("balance_minutes")
        .eq("user_id", userId)
        .single();

    if (error || !data) {
        console.error(`[DB] deductSessionCredits — could not fetch balance  userId=${userId}`);
        return;
    }

    const current  = (data.balance_minutes as number) ?? 0;
    const deduct   = Math.min(minutes, current);   // never go below 0
    const newBal   = current - deduct;

    await supabaseAdmin
        .from("user_credits")
        .update({ balance_minutes: newBal, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

    await supabaseAdmin.from("credit_transactions").insert({
        user_id:     userId,
        session_id:  sessionId,
        amount:      -deduct,
        type:        "session",
        description: `Session deduction — ${deduct} min`,
    });

    console.log(`[DB] Credits deducted  userId=${userId}  deducted=${deduct}  remaining=${newBal}`);
}

// ─── Fetch previous session context ──────────────────────────────────────────

export async function fetchPreviousSessionSummary(userId: string): Promise<{
    summary: string;
    memory:  UserMemory;
}> {
    const { data, error } = await supabaseAdmin
        .from("session_summaries")
        .select("summary, memories")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (error) {
        if (error.code !== "PGRST116") {
            console.error(`[DB] fetchPreviousSummary failed  userId=${userId}  err=${error.message}`);
        }
        return { summary: "", memory: EMPTY_MEMORY };
    }

    const summary   = data?.summary ? decrypt(data.summary, userId) : "";
    const rawMemory = data?.memories
        ? decryptJson<UserMemory>(data.memories, userId, EMPTY_MEMORY)
        : EMPTY_MEMORY;
    // Merge with EMPTY_MEMORY so any fields missing from old DB rows get defaults
    const memory: UserMemory = { ...EMPTY_MEMORY, ...rawMemory };
    console.log(`[DB] Loaded previous summary  userId=${userId}  length=${summary.length}`);
    return { summary, memory };
}
