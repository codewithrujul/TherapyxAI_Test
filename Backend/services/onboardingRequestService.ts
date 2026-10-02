import { supabaseAdmin } from "../db/supabaseClient";
import {
    sendNewOnboardingRequestNotificationToAdmin,
    sendOnboardingSubmissionEmailToUser,
    sendTherapistWelcomeEmail,
    sendOnboardingRejectionNotificationToUser,
} from "./notificationService";
import { upsertTherapistOnboarding, TherapistOnboardingInput } from "./therapistService";

export interface CreateOnboardingRequestResult {
    id: string;
    user_id: string;
    status: string;
    requested_at: string;
    form_data?: Record<string, any>;
}

/**
 * Creates/submits a new therapist onboarding request containing full therapist profile form data.
 * Enforces single active request rule at DB and service layer.
 */
export async function submitOnboardingForm(userId: string, formData: TherapistOnboardingInput) {
    // 1. Check if user already has an active request (pending or onboarding)
    const { data: existing, error: fetchErr } = await supabaseAdmin
        .from("therapist_onboarding_requests")
        .select("id, status")
        .eq("user_id", userId)
        .in("status", ["pending", "onboarding"])
        .maybeSingle();

    if (fetchErr) {
        console.error("[OnboardingRequestService] Fetch active request error:", fetchErr.message);
    }

    if (existing && existing.status === "pending") {
        throw new Error("Your request to onboard as a therapist has already been sent to the admin.");
    }

    // 2. Fetch user profile
    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email, name, role")
        .eq("id", userId)
        .maybeSingle();

    if (profile?.role === "therapist") {
        throw new Error("Your account is already registered as a therapist.");
    }

    const payload = {
        user_id: userId,
        status: "pending",
        form_data: formData,
        requested_at: new Date().toISOString(),
    };

    let data;
    if (existing && existing.status === "onboarding") {
        const { data: updated, error } = await supabaseAdmin
            .from("therapist_onboarding_requests")
            .update({
                status: "pending",
                form_data: formData,
                requested_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
            .select()
            .single();

        if (error) {
            console.error("[OnboardingRequestService] Update request error:", error.message);
            throw new Error(`Failed to submit onboarding request: ${error.message}`);
        }
        data = updated;
    } else {
        // 3. Insert onboarding request with form_data
        const { data: inserted, error } = await supabaseAdmin
            .from("therapist_onboarding_requests")
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.error("[OnboardingRequestService] Insert request error:", error.message);
            if (error.code === "23505" || error.message?.includes("idx_unique_active_therapist_request")) {
                throw new Error("Your request to onboard as a therapist has already been sent to the admin.");
            }
            throw new Error(`Failed to create onboarding request: ${error.message}`);
        }
        data = inserted;
    }

    const userName = formData.fullName || profile?.name || "Applicant User";
    const userEmail = formData.email || profile?.email || "applicant@example.com";

    // 4. Send email & notification to user: "Your request to onboard as a therapist has been sent to the admin. You will be notified when the admin approves your request."
    sendOnboardingSubmissionEmailToUser({
        userId,
        userName,
        userEmail,
    }).catch(err => console.error("[OnboardingRequestService] User submission email error:", err?.message || err));

    // 5. Notify admin
    sendNewOnboardingRequestNotificationToAdmin({
        userName,
        userEmail,
        requestedAt: data.requested_at,
    }).catch(err => console.error("[OnboardingRequestService] Admin notification error:", err?.message || err));

    return data;
}

/**
 * Legacy wrapper for creating simple onboarding request without initial form data.
 */
export async function createOnboardingRequest(userId: string) {
    return submitOnboardingForm(userId, {} as TherapistOnboardingInput);
}

/**
 * Fetches current onboarding request status for a specific user.
 */
export async function getUserOnboardingStatus(userId: string) {
    const { data, error } = await supabaseAdmin
        .from("therapist_onboarding_requests")
        .select("*")
        .eq("user_id", userId)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("[OnboardingRequestService] getUserOnboardingStatus error:", error.message);
        throw new Error("Failed to fetch onboarding request status");
    }

    return { request: data ?? null };
}

/**
 * Admin action: Approve/Verify an onboarding request.
 * Saves therapist profile, updates profile role to 'therapist', sets request status to 'approved', and sends welcome email.
 */
export async function adminApproveOnboarding(adminUserId: string, requestId: string) {
    // 1. Fetch request
    const { data: request, error: rErr } = await supabaseAdmin
        .from("therapist_onboarding_requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();

    if (rErr || !request) {
        throw new Error("Onboarding request not found");
    }

    if (request.status === "approved") {
        throw new Error("This onboarding request has already been approved.");
    }

    const formData: TherapistOnboardingInput = request.form_data || {};

    // 2. Upsert therapist profile details
    const therapistRecord = await upsertTherapistOnboarding(request.user_id, {
        ...formData,
        onboardingCompleted: true,
        onboardingStep: 5,
    });

    // 3. Update profiles role to 'therapist'
    const { error: roleErr } = await supabaseAdmin
        .from("profiles")
        .update({ role: "therapist" })
        .eq("id", request.user_id);

    if (roleErr) {
        console.error("[OnboardingRequestService] Failed to update user role:", roleErr.message);
        throw new Error(`Failed to update user role to therapist: ${roleErr.message}`);
    }

    // 4. Update request status to 'approved'
    const { data: approvedRequest, error: appErr } = await supabaseAdmin
        .from("therapist_onboarding_requests")
        .update({
            status: "approved",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .select()
        .single();

    if (appErr) {
        console.error("[OnboardingRequestService] Failed to mark request as approved:", appErr.message);
    }

    // 5. Send welcome email & notification
    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email, name")
        .eq("id", request.user_id)
        .maybeSingle();

    const userName = profile?.name || therapistRecord.full_name || "Doctor";
    const userEmail = profile?.email || therapistRecord.email || "therapist@example.com";

    sendTherapistWelcomeEmail({
        userId: request.user_id,
        userName,
        userEmail,
    }).catch(err => console.error("[OnboardingRequestService] Welcome email error:", err?.message || err));

    return {
        request: approvedRequest || request,
        therapist: therapistRecord,
    };
}

/**
 * Legacy start onboarding handler for backwards compatibility.
 */
export async function adminStartOnboarding(adminUserId: string, requestId: string) {
    return adminApproveOnboarding(adminUserId, requestId);
}

/**
 * Admin action: Reject an onboarding request.
 * Keeps user role as patient and notifies user with reason.
 */
export async function adminRejectOnboarding(adminUserId: string, requestId: string, reason?: string) {
    const { data: request, error: rErr } = await supabaseAdmin
        .from("therapist_onboarding_requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();

    if (rErr || !request) {
        throw new Error("Onboarding request not found");
    }

    if (request.status === "approved" || request.status === "rejected") {
        throw new Error(`This onboarding request has already been ${request.status}.`);
    }

    const { data: updated, error: uErr } = await supabaseAdmin
        .from("therapist_onboarding_requests")
        .update({
            status: "rejected",
            rejected_at: new Date().toISOString(),
            rejection_reason: reason || "Onboarding request was not approved at this time.",
            updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .select()
        .single();

    if (uErr) {
        throw new Error(`Failed to reject onboarding request: ${uErr.message}`);
    }

    // Notify user
    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email, name")
        .eq("id", request.user_id)
        .maybeSingle();

    if (profile) {
        sendOnboardingRejectionNotificationToUser({
            userId: request.user_id,
            userName: profile.name || "Valued User",
            userEmail: profile.email || "user@example.com",
            reason: reason || undefined,
        }).catch(err => console.error("[OnboardingRequestService] Non-blocking rejection notification error:", err?.message || err));
    }

    return updated;
}

/**
 * Legacy function wrapper.
 */
export async function completeUserOnboardingAndRole(userId: string, formData: TherapistOnboardingInput) {
    return submitOnboardingForm(userId, formData);
}
