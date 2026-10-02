import { supabaseAdmin } from "../db/supabaseClient";

export interface CreateGoogleMeetOptions {
    appointmentId: string;
    startTime?: string;
    endTime?: string;
}

export interface GoogleMeetResult {
    success: boolean;
    googleMeetUrl?: string;
    spaceId?: string;
    googleMeetStatus: "created" | "failed" | "pending";
    isExisting?: boolean;
    error?: string;
}

/**
 * Obtains a fresh Google OAuth2 Access Token using the TherapyXAI server-side Refresh Token.
 */
export async function getGoogleAccessToken(): Promise<string | null> {
    const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
    const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN || "").trim();

    if (!clientId || !clientSecret || !refreshToken) {
        console.warn("[GoogleMeetService] Missing Google OAuth configuration: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN not set.");
        return null;
    }

    try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
            }),
        });

        const data = await response.json();

        if (!response.ok || !data.access_token) {
            console.error("[GoogleMeetService] Failed to obtain access token from Google:", data.error_description || data.error || response.statusText);
            return null;
        }

        return data.access_token;
    } catch (err: any) {
        console.error("[GoogleMeetService] Network error while fetching Google access token:", err?.message || err);
        return null;
    }
}

/**
 * Creates a Google Meet space using Google Meet REST API v2 for a TherapyxAI appointment.
 * Idempotent: If a Meet URL already exists for the given appointment, returns the existing URL.
 */
export async function createGoogleMeet(options: CreateGoogleMeetOptions): Promise<GoogleMeetResult> {
    const { appointmentId } = options;

    if (!appointmentId) {
        return {
            success: false,
            googleMeetStatus: "failed",
            error: "Appointment ID is required",
        };
    }

    try {
        // Step 1: Fetch existing appointment from Supabase
        const { data: appointment, error: fetchErr } = await supabaseAdmin
            .from("appointments")
            .select("id, google_meet_url, google_meet_space_id, google_meet_status, meeting_link")
            .eq("id", appointmentId)
            .maybeSingle();

        if (fetchErr || !appointment) {
            console.error("[GoogleMeetService] Appointment lookup failed:", fetchErr?.message || "Not found");
            return {
                success: false,
                googleMeetStatus: "failed",
                error: "Appointment not found",
            };
        }

        // Idempotency Protection: If Google Meet space is already created, return existing URL
        if (appointment.google_meet_url && appointment.google_meet_status === "created") {
            return {
                success: true,
                googleMeetUrl: appointment.google_meet_url,
                spaceId: appointment.google_meet_space_id,
                googleMeetStatus: "created",
                isExisting: true,
            };
        }

        // Step 2: Get OAuth Access Token for TherapyXAI Google Account
        const accessToken = await getGoogleAccessToken();

        if (!accessToken) {
            // Mark appointment google_meet_status as failed
            await supabaseAdmin
                .from("appointments")
                .update({ google_meet_status: "failed" })
                .eq("id", appointmentId);

            return {
                success: false,
                googleMeetStatus: "failed",
                error: "Google Meet API authentication unavailable. Please ensure TherapyXAI Google credentials are set.",
            };
        }

        // Step 3: Call Google Meet REST API v2 (POST https://meet.googleapis.com/v2/spaces)
        const response = await fetch("https://meet.googleapis.com/v2/spaces", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                config: {
                    accessType: "OPEN",
                },
            }),
        });

        const meetData = await response.json();

        if (!response.ok || !meetData.meetingUri) {
            console.error("[GoogleMeetService] Google Meet API space creation failed:", meetData.error?.message || response.statusText);

            // Save status as failed
            await supabaseAdmin
                .from("appointments")
                .update({ google_meet_status: "failed" })
                .eq("id", appointmentId);

            return {
                success: false,
                googleMeetStatus: "failed",
                error: "Could not generate Google Meet link at this moment.",
            };
        }

        const meetingUri = meetData.meetingUri;
        const spaceId = meetData.name || "";
        const createdAt = new Date().toISOString();

        // Step 4: Persist Google Meet details against appointment in Supabase
        const { error: updateErr } = await supabaseAdmin
            .from("appointments")
            .update({
                google_meet_space_id: spaceId,
                google_meet_url: meetingUri,
                google_meet_created_at: createdAt,
                google_meet_status: "created",
                meeting_link: meetingUri,
            })
            .eq("id", appointmentId);

        if (updateErr) {
            console.error("[GoogleMeetService] Failed to update appointment with Google Meet details:", updateErr.message);
        }

        return {
            success: true,
            googleMeetUrl: meetingUri,
            spaceId: spaceId,
            googleMeetStatus: "created",
        };
    } catch (err: any) {
        console.error("[GoogleMeetService] Unexpected error creating Google Meet:", err?.message || err);

        try {
            await supabaseAdmin
                .from("appointments")
                .update({ google_meet_status: "failed" })
                .eq("id", appointmentId);
        } catch {}

        return {
            success: false,
            googleMeetStatus: "failed",
            error: "An unexpected error occurred while setting up video meeting.",
        };
    }
}

/**
 * Retries Google Meet space creation for an existing appointment.
 * Verifies that the user requesting retry owns the appointment or is the assigned therapist.
 */
export async function retryGoogleMeetCreation(appointmentId: string, userId: string): Promise<GoogleMeetResult> {
    const { data: appointment, error } = await supabaseAdmin
        .from("appointments")
        .select("id, user_id, therapist_id")
        .eq("id", appointmentId)
        .maybeSingle();

    if (error || !appointment) {
        return {
            success: false,
            googleMeetStatus: "failed",
            error: "Appointment not found",
        };
    }

    // Authorization check
    if (appointment.user_id !== userId) {
        // Also check if user is the therapist
        const { data: therapist } = await supabaseAdmin
            .from("therapists")
            .select("id")
            .eq("id", appointment.therapist_id)
            .eq("user_id", userId)
            .maybeSingle();

        if (!therapist) {
            return {
                success: false,
                googleMeetStatus: "failed",
                error: "Unauthorized to modify meeting for this appointment",
            };
        }
    }

    return createGoogleMeet({ appointmentId });
}
