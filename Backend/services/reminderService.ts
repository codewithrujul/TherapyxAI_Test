import { supabaseAdmin } from "../db/supabaseClient";
import { 
    send15MinReminderEmail, 
    sendBookingExpiredEmailToPatient, 
    sendPendingRequestReminderToPractitioner 
} from "./notificationService";

/**
 * Checks for upcoming confirmed/pending appointments starting in <= 15 minutes
 * and sends reminder emails to both patient and practitioner exactly once per recipient.
 */
export async function checkAndSend15MinReminders(): Promise<void> {
    try {
        const now = new Date();
        const fifteenMinsLater = new Date(now.getTime() + 15 * 60 * 1000);

        // Fetch active appointments starting between now and 15 mins from now
        const { data: appointments, error } = await supabaseAdmin
            .from("appointments")
            .select("*, therapists (id, full_name, email), profiles:user_id (id, name, email)")
            .in("status", ["confirmed", "pending"])
            .gte("start_time", now.toISOString())
            .lte("start_time", fifteenMinsLater.toISOString());

        if (error) {
            console.error("[ReminderService] Query error:", error.message);
            return;
        }

        if (!appointments || appointments.length === 0) {
            return;
        }

        for (const apt of appointments) {
            // Exclude if reminder was already sent
            if (apt.reminder_sent === true) {
                continue;
            }

            const therapist = apt.therapists || {};
            const user = apt.profiles || {};

            const userEmail = user.email;
            const therapistEmail = therapist.email;

            if (!userEmail || !therapistEmail) {
                console.warn(`[ReminderService] Missing recipient email for apt ${apt.id}. User: ${userEmail}, Therapist: ${therapistEmail}`);
                continue;
            }

            // Mark reminder_sent as true FIRST to guarantee single execution
            try {
                await supabaseAdmin
                    .from("appointments")
                    .update({ reminder_sent: true, updated_at: new Date().toISOString() })
                    .eq("id", apt.id);
            } catch (uErr: any) {
                console.error(`[ReminderService] Failed to set reminder_sent flag for apt ${apt.id}:`, uErr?.message || uErr);
            }

            console.log(`[ReminderService] Triggering 15-min reminder emails for appointment ${apt.appointment_number || apt.id}`);

            send15MinReminderEmail({
                userEmail,
                userName: user.name || "Client",
                therapistEmail,
                therapistName: therapist.full_name || "Practitioner",
                appointmentNumber: apt.appointment_number || apt.id,
                startTime: apt.start_time,
                endTime: apt.end_time,
                sessionType: apt.session_type || "video",
                feeAmount: apt.fee_amount || 0,
                googleMeetUrl: apt.google_meet_url || apt.meeting_link || "",
            }).catch(err => {
                console.error(`[ReminderService] Error sending 15-min reminder email for ${apt.id}:`, err?.message || err);
            });
        }
    } catch (err: any) {
        console.error("[ReminderService] Interval check failed:", err?.message || err);
    }
}

/**
 * Idempotently auto-expires pending booking requests whose start time has passed.
 * For multi-session packages, if Session 1 or any pending session expires, remaining pending package sessions are also cancelled.
 */
export async function checkAndExpirePendingRequests(): Promise<void> {
    try {
        const now = new Date().toISOString();

        // Fetch all pending appointments where start_time <= now
        const { data: expiredApts, error } = await supabaseAdmin
            .from("appointments")
            .select("*, therapists(id, full_name, email), profiles:user_id(id, name, email)")
            .eq("status", "pending")
            .lte("start_time", now);

        if (error) {
            console.error("[ReminderService] checkAndExpirePendingRequests query error:", error.message);
            return;
        }

        if (!expiredApts || expiredApts.length === 0) return;

        for (const apt of expiredApts) {
            console.log(`[ReminderService] Auto-expiring unconfirmed pending appointment ${apt.appointment_number || apt.id}`);

            // Mark appointment status as cancelled / expired
            await supabaseAdmin
                .from("appointments")
                .update({ status: "cancelled", updated_at: new Date().toISOString() })
                .eq("id", apt.id);

            // If part of a package, cancel remaining pending sessions & mark package record as cancelled
            if (apt.package_id) {
                await supabaseAdmin
                    .from("appointments")
                    .update({ status: "cancelled", updated_at: new Date().toISOString() })
                    .eq("package_id", apt.package_id)
                    .eq("status", "pending");

                await supabaseAdmin
                    .from("appointment_packages")
                    .update({ status: "cancelled", updated_at: new Date().toISOString() })
                    .eq("id", apt.package_id);
            }

            // Send notification to patient
            const user = apt.profiles || {};
            const therapist = apt.therapists || {};
            if (user.email) {
                sendBookingExpiredEmailToPatient({
                    userEmail: user.email,
                    userName: user.name || "Client",
                    therapistEmail: therapist.email || "",
                    therapistName: therapist.full_name || "Practitioner",
                    appointmentNumber: apt.appointment_number || apt.id,
                    startTime: apt.start_time,
                    endTime: apt.end_time,
                    sessionType: apt.session_type || "video",
                    feeAmount: apt.fee_amount || 0,
                }).catch(err => console.error(`[ReminderService] Error sending booking expired email for ${apt.id}:`, err));
            }
        }
    } catch (err: any) {
        console.error("[ReminderService] checkAndExpirePendingRequests error:", err?.message || err);
    }
}

/**
 * Sends reminder notifications to practitioners for unconfirmed pending booking requests.
 */
export async function checkAndSendPendingRemindersToPractitioners(): Promise<void> {
    try {
        const now = new Date();
        const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const { data: pendingApts, error } = await supabaseAdmin
            .from("appointments")
            .select("*, therapists(id, full_name, email), profiles:user_id(id, name, email)")
            .eq("status", "pending")
            .gte("start_time", now.toISOString())
            .lte("start_time", next24Hours.toISOString());

        if (error || !pendingApts) return;

        for (const apt of pendingApts) {
            if (apt.pending_reminder_sent === true) continue;

            const therapist = apt.therapists || {};
            const user = apt.profiles || {};
            if (!therapist.email) continue;

            // Mark flag first to guarantee single execution
            try {
                await supabaseAdmin
                    .from("appointments")
                    .update({ pending_reminder_sent: true, updated_at: new Date().toISOString() })
                    .eq("id", apt.id);
            } catch (uErr: any) {
                console.error(`[ReminderService] Failed to set pending_reminder_sent flag for apt ${apt.id}:`, uErr);
            }

            sendPendingRequestReminderToPractitioner({
                userEmail: user.email || "",
                userName: user.name || "Client",
                therapistEmail: therapist.email,
                therapistName: therapist.full_name || "Practitioner",
                appointmentNumber: apt.appointment_number || apt.id,
                startTime: apt.start_time,
                endTime: apt.end_time,
                sessionType: apt.session_type || "video",
                feeAmount: apt.fee_amount || 0,
            }).catch(err => console.error("[ReminderService] Pending reminder error:", err));
        }
    } catch (err: any) {
        console.error("[ReminderService] checkAndSendPendingRemindersToPractitioners error:", err);
    }
}

let reminderInterval: NodeJS.Timeout | null = null;

export function startReminderScheduler(intervalMs: number = 60000): void {
    if (reminderInterval) {
        console.log("[ReminderService] Scheduler already running.");
        return;
    }

    console.log(`[ReminderService] Starting appointment reminder & auto-expiry scheduler (interval: ${intervalMs}ms)...`);
    
    // Initial check on server startup
    checkAndSend15MinReminders().catch(err => console.error("[ReminderService] Initial check error:", err));
    checkAndExpirePendingRequests().catch(err => console.error("[ReminderService] Expiry check error:", err));
    checkAndSendPendingRemindersToPractitioners().catch(err => console.error("[ReminderService] Pending reminder error:", err));

    // Recurring check every intervalMs (60 seconds)
    reminderInterval = setInterval(() => {
        checkAndSend15MinReminders().catch(err => console.error("[ReminderService] Recurring check error:", err));
        checkAndExpirePendingRequests().catch(err => console.error("[ReminderService] Expiry check error:", err));
        checkAndSendPendingRemindersToPractitioners().catch(err => console.error("[ReminderService] Pending reminder error:", err));
    }, intervalMs);
}

export function stopReminderScheduler(): void {
    if (reminderInterval) {
        clearInterval(reminderInterval);
        reminderInterval = null;
        console.log("[ReminderService] Scheduler stopped.");
    }
}

