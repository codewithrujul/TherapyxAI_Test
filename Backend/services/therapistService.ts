import { supabaseAdmin } from "../db/supabaseClient";
import {
    sendAppointmentConfirmationToUser,
    sendNewAppointmentNotificationToTherapist,
    sendTherapistConfirmedEmailToPatient,
    sendAppointmentCancellationToTherapist,
    sendAppointmentCancellationToUser,
    sendRescheduleEmailToPatient,
    sendRescheduleEmailToPractitioner,
} from "./notificationService";
import { createGoogleMeet } from "./googleMeetService";

export interface ListTherapistsFilter {
    search?: string;
    specialty?: string;
    language?: string;
    sessionType?: string;
    minRate?: number;
    maxRate?: number;
    sortBy?: "rating" | "rate_asc" | "rate_desc" | "experience";
    page?: number;
    limit?: number;
}

export interface TherapistOnboardingInput {
    fullName?: string;
    email?: string;
    phone?: string;
    gender?: string;
    dob?: string;
    profilePictureUrl?: string;
    addressCity?: string;
    addressCountry?: string;
    timezone?: string;

    title?: string;
    shortHeadline?: string;
    highestDegree?: string;
    universityInstitution?: string;
    licenseNumber?: string;
    licensingStateBoard?: string;
    licenseExpiryDate?: string;
    yearsOfExperience?: number;
    licenseDocumentUrl?: string;
    govIdDocumentUrl?: string;

    bio?: string;
    therapeuticApproaches?: string[];
    specialties?: string[];
    targetClients?: string[];
    languages?: string[];

    hourlyRate?: number;
    currency?: string;
    supportedSessionTypes?: string[];

    payoutBankName?: string;
    payoutAccountNumber?: string;
    payoutRoutingCode?: string;

    onboardingStep?: number;
    onboardingCompleted?: boolean;
}

export async function listTherapists(filter: ListTherapistsFilter) {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(50, Math.max(1, filter.limit ?? 10));
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
        .from("therapists")
        .select("*", { count: "exact" })
        .eq("status", "active")
        .eq("is_verified", true);

    if (filter.search) {
        const term = `%${filter.search.trim()}%`;
        query = query.or(`full_name.ilike.${term},title.ilike.${term},bio.ilike.${term},short_headline.ilike.${term}`);
    }

    if (filter.specialty) {
        query = query.contains("specialties", [filter.specialty]);
    }

    if (filter.language) {
        query = query.contains("languages", [filter.language]);
    }

    if (filter.sessionType) {
        query = query.contains("supported_session_types", [filter.sessionType]);
    }

    if (filter.minRate !== undefined) {
        query = query.gte("hourly_rate", filter.minRate);
    }

    if (filter.maxRate !== undefined) {
        query = query.lte("hourly_rate", filter.maxRate);
    }

    // Sorting
    switch (filter.sortBy) {
        case "rate_asc":
            query = query.order("hourly_rate", { ascending: true });
            break;
        case "rate_desc":
            query = query.order("hourly_rate", { ascending: false });
            break;
        case "experience":
            query = query.order("years_of_experience", { ascending: false });
            break;
        case "rating":
        default:
            query = query.order("rating", { ascending: false }).order("total_reviews", { ascending: false });
            break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
        console.error("[TherapistService] listTherapists error:", error.message);
        throw new Error(`Failed to fetch therapists: ${error.message}`);
    }

    return {
        therapists: data ?? [],
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
    };
}

export async function getTherapistById(therapistId: string) {
    const { data: therapist, error: therapistErr } = await supabaseAdmin
        .from("therapists")
        .select("*")
        .eq("id", therapistId)
        .maybeSingle();

    if (therapistErr || !therapist) {
        throw new Error("Therapist not found");
    }

    // Fetch availability schedule
    const { data: availability } = await supabaseAdmin
        .from("therapist_availability")
        .select("*")
        .eq("therapist_id", therapistId)
        .eq("is_active", true)
        .order("day_of_week", { ascending: true });

    // Fetch recent reviews
    const { data: reviews } = await supabaseAdmin
        .from("therapist_reviews")
        .select("id, rating, review_text, is_anonymous, created_at, user_id, profiles(name)")
        .eq("therapist_id", therapistId)
        .order("created_at", { ascending: false })
        .limit(10);

    return {
        therapist,
        availability: availability ?? [],
        reviews: (reviews ?? []).map(r => ({
            id: r.id,
            rating: r.rating,
            reviewText: r.review_text,
            createdAt: r.created_at,
            userName: r.is_anonymous ? "Anonymous Client" : (r.profiles as any)?.name ?? "Client",
        })),
    };
}

export async function getTherapistByUserId(userId: string) {
    const { data, error } = await supabaseAdmin
        .from("therapists")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        console.error("[TherapistService] getTherapistByUserId error:", error.message);
        throw new Error("Failed to fetch therapist profile");
    }

    return data;
}

export async function upsertTherapistOnboarding(userId: string | null | undefined, input: TherapistOnboardingInput) {
    const existing = userId ? await getTherapistByUserId(userId) : null;

    const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
    };
    if (userId) {
        payload.user_id = userId;
    }

    if (input.fullName !== undefined) payload.full_name = input.fullName;
    if (input.email !== undefined) payload.email = input.email;
    if (input.phone !== undefined) payload.phone = input.phone;
    if (input.gender !== undefined) payload.gender = input.gender;
    if (input.dob !== undefined) payload.dob = input.dob;
    if (input.profilePictureUrl !== undefined) payload.profile_picture_url = input.profilePictureUrl;
    if (input.addressCity !== undefined) payload.address_city = input.addressCity;
    if (input.addressCountry !== undefined) payload.address_country = input.addressCountry;
    if (input.timezone !== undefined) payload.timezone = input.timezone;

    if (input.title !== undefined) payload.title = input.title;
    if (input.shortHeadline !== undefined) payload.short_headline = input.shortHeadline;
    if (input.highestDegree !== undefined) payload.highest_degree = input.highestDegree;
    if (input.universityInstitution !== undefined) payload.university_institution = input.universityInstitution;
    if (input.licenseNumber !== undefined) payload.license_number = input.licenseNumber;
    if (input.licensingStateBoard !== undefined) payload.licensing_state_board = input.licensingStateBoard;
    if (input.licenseExpiryDate !== undefined) payload.license_expiry_date = input.licenseExpiryDate;
    if (input.yearsOfExperience !== undefined) payload.years_of_experience = input.yearsOfExperience;
    if (input.licenseDocumentUrl !== undefined) payload.license_document_url = input.licenseDocumentUrl;
    if (input.govIdDocumentUrl !== undefined) payload.gov_id_document_url = input.govIdDocumentUrl;

    if (input.bio !== undefined) payload.bio = input.bio;
    if (input.therapeuticApproaches !== undefined) payload.therapeutic_approaches = input.therapeuticApproaches;
    if (input.specialties !== undefined) payload.specialties = input.specialties;
    if (input.targetClients !== undefined) payload.target_clients = input.targetClients;
    if (input.languages !== undefined) payload.languages = input.languages;

    if (input.hourlyRate !== undefined) payload.hourly_rate = input.hourlyRate;
    if (input.currency !== undefined) payload.currency = input.currency;
    if (input.supportedSessionTypes !== undefined) payload.supported_session_types = input.supportedSessionTypes;

    if (input.payoutBankName !== undefined) payload.payout_bank_name = input.payoutBankName;
    if (input.payoutAccountNumber !== undefined) payload.payout_account_number = input.payoutAccountNumber;
    if (input.payoutRoutingCode !== undefined) payload.payout_routing_code = input.payoutRoutingCode;

    if (input.onboardingStep !== undefined) payload.onboarding_step = input.onboardingStep;
    if (input.onboardingCompleted !== undefined) {
        payload.onboarding_completed = input.onboardingCompleted;
        if (input.onboardingCompleted) {
            payload.verification_status = "approved";
            payload.is_verified = true;
            payload.status = "active";
        }
    } else {
        // Default to active & verified for dev testing convenience
        payload.status = "active";
        payload.is_verified = true;
        payload.verification_status = "approved";
    }

    let result;
    if (existing) {
        const { data, error } = await supabaseAdmin
            .from("therapists")
            .update(payload)
            .eq("id", existing.id)
            .select()
            .single();

        if (error) throw new Error(`Failed to update onboarding: ${error.message}`);
        result = data;
    } else {
        const { data, error } = await supabaseAdmin
            .from("therapists")
            .insert(payload)
            .select()
            .single();

        if (error) throw new Error(`Failed to save onboarding: ${error.message}`);
        result = data;
    }

    if (userId) {
        await supabaseAdmin
            .from("profiles")
            .update({ role: "therapist" })
            .eq("id", userId);
    }

    return result;
}

class AsyncLock {
    private queue: Promise<void> = Promise.resolve();

    async acquire<T>(fn: () => Promise<T>): Promise<T> {
        const res = this.queue.then(fn, fn);
        this.queue = res.then(() => {}, () => {});
        return res;
    }
}

const bookingLock = new AsyncLock();

export interface CreateAppointmentInput {
    therapistId: string;
    startTime: string;
    endTime: string;
    sessionType?: string;
    userNotes?: string;
    feeAmount: number;
    sessionCount?: number;
}

export interface ValidateRecurringSlotsInput {
    therapistId: string;
    startDate?: string;
    startTime?: string;
    startTimeISO?: string;
    endTimeISO?: string;
    sessionCount: number;
    userId?: string;
}

export interface GeneratedSessionSlot {
    sessionNumber: number;
    date: string;
    startTime: string;
    endTime: string;
    startTimeISO: string;
    endTimeISO: string;
    available: boolean;
    reason: "past" | "booked" | "user_conflict" | "unavailable" | null;
    displayDate?: string;
    displayTime?: string;
}

export interface ValidateRecurringSlotsResult {
    valid: boolean;
    sessions: GeneratedSessionSlot[];
    unavailableSessions: GeneratedSessionSlot[];
    message?: string;
}

export async function validateRecurringSlots(input: ValidateRecurringSlotsInput): Promise<ValidateRecurringSlotsResult> {
    if (!input.therapistId || !input.sessionCount) {
        throw new Error("Therapist ID and session count are required.");
    }

    const sessionCount = Number(input.sessionCount);
    if (![1, 3, 6, 9].includes(sessionCount)) {
        throw new Error("Session count must be 1, 3, 6, or 9.");
    }

    let initialStartISO = input.startTimeISO;
    let initialEndISO = input.endTimeISO;

    if (!initialStartISO && input.startDate && input.startTime) {
        const timePart = input.startTime.length === 5 ? `${input.startTime}:00` : input.startTime;
        const [h, m] = timePart.split(':').map(Number);
        const endH = (h + 1) % 24;
        const padH = String(h).padStart(2, '0');
        const padM = String(m || 0).padStart(2, '0');
        const padEndH = String(endH).padStart(2, '0');

        initialStartISO = new Date(`${input.startDate}T${padH}:${padM}:00+05:30`).toISOString();
        initialEndISO = new Date(`${input.startDate}T${padEndH}:${padM}:00+05:30`).toISOString();
    }

    if (!initialStartISO || !initialEndISO) {
        throw new Error("Start date/time and end date/time are required to generate recurring slots.");
    }

    const initialStartTs = new Date(initialStartISO).getTime();
    const initialEndTs = new Date(initialEndISO).getTime();

    if (isNaN(initialStartTs) || isNaN(initialEndTs)) {
        throw new Error("Invalid start or end time format.");
    }

    const { data: activeAvailability } = await supabaseAdmin
        .from("therapist_availability")
        .select("*")
        .eq("therapist_id", input.therapistId)
        .eq("is_active", true);

    const hasWorkingHours = (activeAvailability ?? []).length > 0;

    if (input.userId) {
        const { data: activeAppts } = await supabaseAdmin
            .from("appointments")
            .select("id")
            .eq("user_id", input.userId)
            .eq("therapist_id", input.therapistId)
            .in("status", ["pending", "confirmed"]);

        if (activeAppts && activeAppts.length > 0) {
            return {
                valid: false,
                sessions: [],
                unavailableSessions: [],
                message: "You already have active or upcoming session(s) with this therapist. You can book a new appointment only after all existing sessions with this therapist are completed.",
            };
        }
    }

    const sessions: GeneratedSessionSlot[] = [];
    const unavailableSessions: GeneratedSessionSlot[] = [];
    const nowTs = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < sessionCount; i++) {
        const slotStartTs = initialStartTs + (i * oneWeekMs);
        const slotEndTs = initialEndTs + (i * oneWeekMs);
        const slotStartISO = new Date(slotStartTs).toISOString();
        const slotEndISO = new Date(slotEndTs).toISOString();

        const startDateObj = new Date(slotStartISO);
        const dateStr = startDateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const startTimeStr = startDateObj.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
        const endDateObj = new Date(slotEndISO);
        const endTimeStr = endDateObj.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });

        const displayDate = startDateObj.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short', month: 'short', day: '2-digit' });
        const displayTime = startDateObj.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });

        let isAvailable = true;
        let reason: "past" | "booked" | "user_conflict" | "unavailable" | null = null;

        if (slotStartTs <= nowTs) {
            isAvailable = false;
            reason = "past";
        } else {
            if (hasWorkingHours) {
                const aptDateInIST = new Date(startDateObj.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
                const aptDayOfWeek = aptDateInIST.getDay();
                const dayWorkHours = (activeAvailability ?? []).filter(a => a.day_of_week === aptDayOfWeek);

                if (dayWorkHours.length === 0) {
                    isAvailable = false;
                    reason = "unavailable";
                } else {
                    const [aStartH, aStartM] = startTimeStr.split(':').map(Number);
                    const [aEndH, aEndM] = endTimeStr.split(':').map(Number);
                    const aStartMins = aStartH * 60 + aStartM;
                    const aEndMins = aEndH * 60 + aEndM;

                    const fitsInWorkingWindow = dayWorkHours.some(wh => {
                        const [wStartH, wStartM] = wh.start_time.split(':').map(Number);
                        const [wEndH, wEndM] = wh.end_time.split(':').map(Number);
                        const wStartMins = wStartH * 60 + (wStartM || 0);
                        const wEndMins = wEndH * 60 + (wEndM || 0);
                        return aStartMins >= wStartMins && aEndMins <= wEndMins;
                    });

                    if (!fitsInWorkingWindow) {
                        isAvailable = false;
                        reason = "unavailable";
                    }
                }
            }

            if (isAvailable) {
                const { data: timeOffConflicts } = await supabaseAdmin
                    .from("therapist_time_off")
                    .select("id")
                    .eq("therapist_id", input.therapistId)
                    .lt("start_datetime", slotEndISO)
                    .gt("end_datetime", slotStartISO);

                if (timeOffConflicts && timeOffConflicts.length > 0) {
                    isAvailable = false;
                    reason = "unavailable";
                }
            }

            if (isAvailable) {
                const { data: therapistConflicts } = await supabaseAdmin
                    .from("appointments")
                    .select("id")
                    .eq("therapist_id", input.therapistId)
                    .in("status", ["pending", "confirmed", "completed"])
                    .lt("start_time", slotEndISO)
                    .gt("end_time", slotStartISO);

                if (therapistConflicts && therapistConflicts.length > 0) {
                    isAvailable = false;
                    reason = "booked";
                }
            }

            if (isAvailable && input.userId) {
                const { data: userConflicts } = await supabaseAdmin
                    .from("appointments")
                    .select("id")
                    .eq("user_id", input.userId)
                    .in("status", ["pending", "confirmed", "completed"])
                    .lt("start_time", slotEndISO)
                    .gt("end_time", slotStartISO);

                if (userConflicts && userConflicts.length > 0) {
                    isAvailable = false;
                    reason = "user_conflict";
                }
            }
        }

        const slotObj: GeneratedSessionSlot = {
            sessionNumber: i + 1,
            date: dateStr,
            startTime: startTimeStr,
            endTime: endTimeStr,
            startTimeISO: slotStartISO,
            endTimeISO: slotEndISO,
            available: isAvailable,
            reason,
            displayDate,
            displayTime,
        };

        sessions.push(slotObj);
        if (!isAvailable) {
            unavailableSessions.push(slotObj);
        }
    }

    const valid = unavailableSessions.length === 0;

    return {
        valid,
        sessions,
        unavailableSessions,
        message: valid
            ? "All requested weekly sessions are available."
            : "Some of your selected weekly sessions are no longer available.",
    };
}

export async function createAppointment(userId: string, input: CreateAppointmentInput) {
    return bookingLock.acquire(async () => {
        if (!input.therapistId || !input.startTime || !input.endTime) {
            throw new Error("Therapist ID, start time, and end time are required.");
        }

        // 0. Enforce active booking restriction:
        // A user cannot book a new appointment or package with a therapist if they already have uncompleted (pending or confirmed) session(s) with that therapist.
        const { data: existingActive } = await supabaseAdmin
            .from("appointments")
            .select("id, status, start_time")
            .eq("user_id", userId)
            .eq("therapist_id", input.therapistId)
            .in("status", ["pending", "confirmed"]);

        if (existingActive && existingActive.length > 0) {
            throw new Error(
                "You already have active or upcoming session(s) with this therapist. You can book a new session only after all existing sessions with this therapist are completed."
            );
        }

        const sessionCount = input.sessionCount && input.sessionCount > 1 ? Number(input.sessionCount) : 1;

        // 1. Validate all requested slots using validateRecurringSlots
        const validation = await validateRecurringSlots({
            therapistId: input.therapistId,
            startTimeISO: input.startTime,
            endTimeISO: input.endTime,
            sessionCount,
            userId,
        });

        if (!validation.valid) {
            const un = validation.unavailableSessions[0];
            const unDateStr = un?.displayDate || un?.date || "selected slot";
            const unTimeStr = un?.displayTime || un?.startTime || "";
            throw new Error(
                `Some of your selected weekly sessions are no longer available.\n\nUnavailable:\n${unDateStr} · ${unTimeStr}\n\nPlease select another starting time.`
            );
        }

        // 2. Create parent package if sessionCount > 1
        let packageRecord: any = null;
        if (sessionCount > 1) {
            try {
                const { data: pkgData, error: pkgErr } = await supabaseAdmin
                    .from("therapy_booking_packages")
                    .insert({
                        user_id: userId,
                        therapist_id: input.therapistId,
                        total_sessions: sessionCount,
                        completed_sessions: 0,
                        remaining_sessions: sessionCount,
                        status: 'active',
                    })
                    .select()
                    .single();

                if (!pkgErr && pkgData) {
                    packageRecord = pkgData;
                }
            } catch (e: any) {
                console.warn("[TherapistService] therapy_booking_packages insert warning:", e?.message || e);
            }
        }

        // 3. Create all appointment records
        const createdAppointments: any[] = [];
        for (const slot of validation.sessions) {
            const payload = {
                user_id: userId,
                therapist_id: input.therapistId,
                start_time: slot.startTimeISO,
                end_time: slot.endTimeISO,
                session_type: input.sessionType ?? 'video',
                user_notes: input.userNotes ?? '',
                fee_amount: input.feeAmount ?? 0,
                status: 'pending',
                payment_status: 'pending',
                package_id: packageRecord?.id || null,
                session_number: slot.sessionNumber,
            };

            const { data, error } = await supabaseAdmin
                .from("appointments")
                .insert(payload)
                .select()
                .single();

            if (error) {
                console.error("[TherapistService] createAppointment insert error:", error.message);
                // Rollback created appointments and package if any error occurs
                for (const created of createdAppointments) {
                    await supabaseAdmin.from("appointments").delete().eq("id", created.id);
                }
                if (packageRecord?.id) {
                    await supabaseAdmin.from("therapy_booking_packages").delete().eq("id", packageRecord.id);
                }

                if (error.message?.includes("therapist") || error.code === "23505") {
                    throw new Error("This time slot is no longer available. Please select another time.");
                }
                throw new Error(`Failed to create appointment: ${error.message}`);
            }

            // Create Google Meet space for each created appointment
            try {
                const meetResult = await createGoogleMeet({
                    appointmentId: data.id,
                    startTime: slot.startTimeISO,
                    endTime: slot.endTimeISO,
                });

                if (meetResult.success) {
                    data.google_meet_url = meetResult.googleMeetUrl;
                    data.google_meet_space_id = meetResult.spaceId;
                    data.google_meet_status = meetResult.googleMeetStatus;
                    data.meeting_link = meetResult.googleMeetUrl;
                } else {
                    data.google_meet_status = meetResult.googleMeetStatus || "failed";
                }
            } catch (meetErr: any) {
                console.error("[TherapistService] Non-blocking Google Meet creation error:", meetErr?.message || meetErr);
                data.google_meet_status = "failed";
            }

            createdAppointments.push(data);
        }

        // Trigger non-blocking email notifications
        try {
            const { data: userProfile } = await supabaseAdmin
                .from("profiles")
                .select("email, name")
                .eq("id", userId)
                .maybeSingle();

            const { data: therapist } = await supabaseAdmin
                .from("therapists")
                .select("email, full_name")
                .eq("id", input.therapistId)
                .maybeSingle();

            const firstApt = createdAppointments[0];
            const userEmail = userProfile?.email || "patient@example.com";
            const userName = userProfile?.name || "Valued Client";
            const therapistEmail = therapist?.email || "therapist@example.com";
            const therapistName = therapist?.full_name || "Therapist";

            const notificationData = {
                userEmail,
                userName,
                therapistEmail,
                therapistName,
                appointmentNumber: firstApt.appointment_number || firstApt.id,
                startTime: firstApt.start_time,
                endTime: firstApt.end_time,
                sessionType: input.sessionType ?? 'video',
                feeAmount: (input.feeAmount ?? 0) * sessionCount,
                googleMeetUrl: firstApt.google_meet_url || firstApt.meeting_link || "",
            };

            Promise.all([
                sendAppointmentConfirmationToUser(notificationData),
                sendNewAppointmentNotificationToTherapist(notificationData)
            ]).catch(err => {
                console.error("[TherapistService] Non-blocking appointment email notification failed:", err?.message || err);
            });
        } catch (notifyErr: any) {
            console.error("[TherapistService] Non-blocking email trigger error:", notifyErr?.message || notifyErr);
        }

        const primaryApt = createdAppointments[0];
        return {
            ...primaryApt,
            package: packageRecord,
            appointments: createdAppointments,
            totalSessions: sessionCount,
        };
    });
}

/**
 * Fetches available and booked hourly slots for a therapist on a given date (in Asia/Kolkata timezone).
 */
export async function getTherapistBookedSlots(therapistId: string, dateStr: string, userId?: string) {
    if (!therapistId || !dateStr) {
        throw new Error("Therapist ID and date string (YYYY-MM-DD) are required.");
    }

    // Construct start of day and end of day in Asia/Kolkata timezone
    const dayStartISO = new Date(`${dateStr}T00:00:00+05:30`).toISOString();
    const dayEndISO = new Date(`${dateStr}T23:59:59+05:30`).toISOString();

    // 1. Fetch active appointments for therapist on that date
    const { data: therapistApts, error: tErr } = await supabaseAdmin
        .from("appointments")
        .select("id, start_time, end_time, status")
        .eq("therapist_id", therapistId)
        .in("status", ["pending", "confirmed", "completed"])
        .gte("start_time", dayStartISO)
        .lte("start_time", dayEndISO);

    if (tErr) {
        console.error("[TherapistService] getTherapistBookedSlots fetch error:", tErr.message);
    }

    // 2. If user is logged in, fetch user's active appointments on that date across all therapists
    let userApts: any[] = [];
    if (userId) {
        const { data: uApts } = await supabaseAdmin
            .from("appointments")
            .select("id, start_time, end_time, status")
            .eq("user_id", userId)
            .in("status", ["pending", "confirmed", "completed"])
            .gte("start_time", dayStartISO)
            .lte("start_time", dayEndISO);
        userApts = uApts ?? [];
    }

    // 3. Fetch therapist time-off / unavailability periods on that date
    const { data: timeOffList, error: toErr } = await supabaseAdmin
        .from("therapist_time_off")
        .select("id, start_datetime, end_datetime, reason")
        .eq("therapist_id", therapistId)
        .lt("start_datetime", dayEndISO)
        .gt("end_datetime", dayStartISO);

    if (toErr) {
        console.error("[TherapistService] getTherapistBookedSlots time-off fetch error:", toErr.message);
    }

    // 4. Fetch therapist general working hours (therapist_availability)
    const { data: generalAvailability, error: gaErr } = await supabaseAdmin
        .from("therapist_availability")
        .select("*")
        .eq("therapist_id", therapistId)
        .eq("is_active", true);

    if (gaErr) {
        console.error("[TherapistService] getTherapistBookedSlots availability fetch error:", gaErr.message);
    }

    const targetDateObj = new Date(`${dateStr}T12:00:00+05:30`);
    const dayOfWeek = targetDateObj.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    const hasWorkingHours = (generalAvailability ?? []).length > 0;
    const workingHoursForDay = (generalAvailability ?? []).filter((ga) => ga.day_of_week === dayOfWeek);

    // Generate standard hourly time slots from 8:00 AM to 11:00 PM IST (08:00 to 23:00 IST)
    const hourlyHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    const nowTs = Date.now();

    const slots = hourlyHours.map((hour) => {
        const padHour = String(hour).padStart(2, '0');
        const nextPadHour = String(hour + 1).padStart(2, '0');

        // Timeslot ISO in Asia/Kolkata
        const slotStartISO = new Date(`${dateStr}T${padHour}:00:00+05:30`).toISOString();
        const slotEndISO = new Date(`${dateStr}T${nextPadHour}:00:00+05:30`).toISOString();
        const slotStartTs = new Date(slotStartISO).getTime();
        const slotEndTs = new Date(slotEndISO).getTime();

        // 12-hour format string for UI display
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const nextDisplayHour = (hour + 1) % 12 === 0 ? 12 : (hour + 1) % 12;
        const nextAmpm = (hour + 1) >= 12 ? 'PM' : 'AM';

        const label = `${displayHour}:00 ${ampm} - ${nextDisplayHour}:00 ${nextAmpm}`;
        const timeValue = `${padHour}:00`;

        let isAvailable = true;
        let reason: "past" | "booked" | "user_conflict" | "unavailable" | null = null;

        if (slotStartTs <= nowTs) {
            isAvailable = false;
            reason = "past";
        } else {
            // Check general working hours if configured by therapist
            let isOutsideWorkingHours = false;
            if (hasWorkingHours) {
                if (workingHoursForDay.length === 0) {
                    isOutsideWorkingHours = true;
                } else {
                    const slotStartMins = hour * 60;
                    const slotEndMins = (hour + 1) * 60;

                    const fitsInWorkingWindow = workingHoursForDay.some((wh) => {
                        const [wStartH, wStartM] = wh.start_time.split(':').map(Number);
                        const [wEndH, wEndM] = wh.end_time.split(':').map(Number);
                        const wStartTotalMins = wStartH * 60 + (wStartM || 0);
                        const wEndTotalMins = wEndH * 60 + (wEndM || 0);

                        return slotStartMins >= wStartTotalMins && slotEndMins <= wEndTotalMins;
                    });

                    if (!fitsInWorkingWindow) {
                        isOutsideWorkingHours = true;
                    }
                }
            }

            if (isOutsideWorkingHours) {
                isAvailable = false;
                reason = "unavailable";
            } else {
                // Check therapist time-off / unavailability conflict
                const isTherapistTimeOff = (timeOffList ?? []).some((to) => {
                    const toStart = new Date(to.start_datetime).getTime();
                    const toEnd = new Date(to.end_datetime).getTime();
                    return toStart < slotEndTs && toEnd > slotStartTs;
                });

                if (isTherapistTimeOff) {
                    isAvailable = false;
                    reason = "unavailable";
                } else {
                    // Check therapist booked appointment conflict
                    const isTherapistBooked = (therapistApts ?? []).some((apt) => {
                        const aStart = new Date(apt.start_time).getTime();
                        const aEnd = new Date(apt.end_time).getTime();
                        return aStart < slotEndTs && aEnd > slotStartTs;
                    });

                    if (isTherapistBooked) {
                        isAvailable = false;
                        reason = "booked";
                    } else {
                        // Check user conflict
                        const isUserConflicting = userApts.some((apt) => {
                            const aStart = new Date(apt.start_time).getTime();
                            const aEnd = new Date(apt.end_time).getTime();
                            return aStart < slotEndTs && aEnd > slotStartTs;
                        });

                        if (isUserConflicting) {
                            isAvailable = false;
                            reason = "user_conflict";
                        }
                    }
                }
            }
        }

        return {
            label,
            timeValue,
            startTimeISO: slotStartISO,
            endTimeISO: slotEndISO,
            isAvailable,
            reason,
        };
    });

    return {
        date: dateStr,
        slots,
    };
}

/**
 * Validates and retrieves the meeting link for an appointment if the user is authorized
 * and the current time is within the appointment active window (startTime - 5m to endTime + 15m).
 */
export async function getAppointmentMeetingLink(appointmentId: string, userId: string, userRole?: string) {
    const { data: appointment, error } = await supabaseAdmin
        .from("appointments")
        .select("*, therapists (id, user_id, full_name)")
        .eq("id", appointmentId)
        .maybeSingle();

    if (error || !appointment) {
        throw new Error("Appointment not found");
    }

    // 1. Authorization check
    const isPatient = appointment.user_id === userId;
    const isTherapist = (appointment.therapists as any)?.user_id === userId;
    const isAdmin = userRole === "admin";

    if (!isPatient && !isTherapist && !isAdmin) {
        throw new Error("Unauthorized to access meeting link for this appointment");
    }

    // 2. Status check
    if (appointment.status === "cancelled") {
        throw new Error("This appointment has been cancelled. Meeting link is not active.");
    }

    // 3. Time Window Validation: Active starting 15 minutes before start time through appointment end time
    const nowTs = Date.now();
    const startTs = new Date(appointment.start_time).getTime();
    const endTs = new Date(appointment.end_time).getTime();
    const activeStartTs = startTs - 15 * 60 * 1000;
    const activeEndTs = endTs;

    if (nowTs < activeStartTs) {
        const startTimeStr = new Date(startTs).toLocaleString("en-US", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
        });
        throw new Error(`Meeting link is not active yet. Join Meeting button will activate 15 minutes before appointment start time (${startTimeStr} IST).`);
    }

    if (nowTs >= activeEndTs) {
        throw new Error("Session has ended. Meeting link is no longer active.");
    }

    const meetingUrl = appointment.google_meet_url || appointment.meeting_link;
    if (!meetingUrl) {
        throw new Error("Google Meet link is not ready yet. Please retry video generation.");
    }

    return {
        success: true,
        googleMeetUrl: meetingUrl,
        appointmentId: appointment.id,
        status: appointment.status,
    };
}

export async function getUserAppointments(userId: string) {
    const { data, error } = await supabaseAdmin
        .from("appointments")
        .select("*, therapists (id, full_name, title, profile_picture_url, hourly_rate, email, phone)")
        .eq("user_id", userId)
        .order("start_time", { ascending: false });

    if (error) {
        console.error("[TherapistService] getUserAppointments error:", error.message);
        throw new Error(`Failed to fetch user appointments: ${error.message}`);
    }

    return data ?? [];
}

export async function cancelAppointment(userId: string, appointmentId: string) {
    // Verify appointment belongs to user
    const { data: appointment, error: fetchErr } = await supabaseAdmin
        .from("appointments")
        .select("*")
        .eq("id", appointmentId)
        .eq("user_id", userId)
        .maybeSingle();

    if (fetchErr || !appointment) {
        throw new Error("Appointment not found or unauthorized");
    }

    if (appointment.status === "cancelled") {
        return appointment; // Already cancelled
    }

    // 24-Hour cancellation policy check
    const startTimeMs = new Date(appointment.start_time).getTime();
    const hoursUntilStart = (startTimeMs - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilStart < 24) {
        throw new Error("Cancellations are only permitted at least 24 hours prior to the scheduled session start time.");
    }

    const { data, error } = await supabaseAdmin
        .from("appointments")
        .update({
            status: "cancelled",
            cancelled_by: "user",
            updated_at: new Date().toISOString(),
        })
        .eq("id", appointmentId)
        .eq("user_id", userId)
        .select("*, therapists (id, full_name, title, profile_picture_url, hourly_rate)")
        .single();

    if (error) {
        console.error("[TherapistService] cancelAppointment error:", error.message);
        throw new Error(`Failed to cancel appointment: ${error.message}`);
    }

    if (data.package_id) {
        await supabaseAdmin
            .from("appointments")
            .update({
                status: "cancelled",
                cancelled_by: "user",
                updated_at: new Date().toISOString(),
            })
            .eq("package_id", data.package_id)
            .eq("user_id", userId);

        await supabaseAdmin
            .from("therapy_booking_packages")
            .update({
                status: "cancelled",
                updated_at: new Date().toISOString(),
            })
            .eq("id", data.package_id)
            .eq("user_id", userId);
    }

    // Trigger non-blocking cancellation email to therapist after DB update succeeds
    try {
        const { data: userProfile } = await supabaseAdmin
            .from("profiles")
            .select("email, name")
            .eq("id", userId)
            .maybeSingle();

        const therapist = (data as any)?.therapists || {};
        let therapistEmail = therapist.email;
        let therapistName = therapist.full_name;

        if (!therapistEmail && data.therapist_id) {
            const { data: tData } = await supabaseAdmin
                .from("therapists")
                .select("email, full_name")
                .eq("id", data.therapist_id)
                .maybeSingle();
            therapistEmail = tData?.email;
            therapistName = tData?.full_name;
        }

        if (therapistEmail) {
            sendAppointmentCancellationToTherapist({
                userEmail: userProfile?.email || "",
                userName: userProfile?.name || "Client",
                therapistEmail,
                therapistName: therapistName || "Therapist",
                appointmentNumber: data.appointment_number || data.id,
                startTime: data.start_time,
                endTime: data.end_time,
            }).catch(err => {
                console.error("[TherapistService] Non-blocking patient cancellation email to therapist failed:", err?.message || err);
            });
        }
    } catch (e: any) {
        console.error("[TherapistService] Error triggering patient cancellation email:", e?.message || e);
    }

    return data;
}

export async function getTherapistAssignedAppointments(userId: string) {
    const { data: therapist, error: tErr } = await supabaseAdmin
        .from("therapists")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

    if (tErr || !therapist) {
        throw new Error("Therapist profile not found for this user account");
    }

    const { data, error } = await supabaseAdmin
        .from("appointments")
        .select("*, profiles:user_id (id, name, email)")
        .eq("therapist_id", therapist.id)
        .order("start_time", { ascending: false });

    if (error) {
        console.error("[TherapistService] getTherapistAssignedAppointments error:", error.message);
        throw new Error(`Failed to fetch assigned appointments: ${error.message}`);
    }

    return data ?? [];
}

async function syncPackageStatus(packageId: string) {
    if (!packageId) return;
    try {
        const { data: pkg } = await supabaseAdmin
            .from("therapy_booking_packages")
            .select("total_sessions")
            .eq("id", packageId)
            .maybeSingle();

        if (!pkg) return;

        const { data: apts } = await supabaseAdmin
            .from("appointments")
            .select("status")
            .eq("package_id", packageId);

        const total = pkg.total_sessions || 0;
        const completed = (apts ?? []).filter(a => a.status === "completed").length;
        const remaining = Math.max(0, total - completed);
        const allCancelled = (apts ?? []).length > 0 && (apts ?? []).every(a => a.status === "cancelled");

        let pkgStatus = "active";
        if (completed >= total && total > 0) {
            pkgStatus = "completed";
        } else if (allCancelled) {
            pkgStatus = "cancelled";
        }

        await supabaseAdmin
            .from("therapy_booking_packages")
            .update({
                completed_sessions: completed,
                remaining_sessions: remaining,
                status: pkgStatus,
                updated_at: new Date().toISOString(),
            })
            .eq("id", packageId);
    } catch (e: any) {
        console.warn("[TherapistService] syncPackageStatus warning:", e?.message || e);
    }
}

export async function updateAppointmentStatusByTherapist(userId: string, appointmentId: string, status: string) {
    const { data: therapist } = await supabaseAdmin
        .from("therapists")
        .select("id, full_name, email")
        .eq("user_id", userId)
        .maybeSingle();

    if (!therapist) {
        throw new Error("Unauthorized therapist account");
    }

    const { data, error } = await supabaseAdmin
        .from("appointments")
        .update({
            status: status,
            updated_at: new Date().toISOString(),
        })
        .eq("id", appointmentId)
        .eq("therapist_id", therapist.id)
        .select("*, profiles:user_id (id, name, email)")
        .single();

    if (error) {
        console.error("[TherapistService] updateAppointmentStatusByTherapist error:", error.message);
        throw new Error(`Failed to update appointment status: ${error.message}`);
    }

    if (data.package_id) {
        if (status === "confirmed") {
            await supabaseAdmin
                .from("appointments")
                .update({
                    status: "confirmed",
                    updated_at: new Date().toISOString(),
                })
                .eq("package_id", data.package_id)
                .eq("therapist_id", therapist.id)
                .eq("status", "pending");
        }
        syncPackageStatus(data.package_id).catch(() => {});
    }

    // Send confirmation email to patient when status becomes confirmed
    if (status === "confirmed") {
        try {
            const userEmail = (data as any)?.profiles?.email || "patient@example.com";
            const userName = (data as any)?.profiles?.name || "Valued Client";

            sendTherapistConfirmedEmailToPatient({
                userEmail,
                userName,
                therapistEmail: therapist.email || "",
                therapistName: therapist.full_name || "Therapist",
                appointmentNumber: data.appointment_number || data.id,
                startTime: data.start_time,
                endTime: data.end_time,
                sessionType: data.session_type || "video",
                feeAmount: data.fee_amount || 0,
                googleMeetUrl: data.google_meet_url || data.meeting_link || "",
            }).catch(err => {
                console.error("[TherapistService] Non-blocking therapist confirmation email failed:", err?.message || err);
            });
        } catch (e: any) {
            console.error("[TherapistService] Error triggering confirmation email:", e?.message || e);
        }
    }

    return data;
}

export async function cancelAppointmentByTherapist(userId: string, appointmentId: string, reason: string) {
    const { data: therapist } = await supabaseAdmin
        .from("therapists")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

    if (!therapist) {
        throw new Error("Unauthorized therapist account");
    }

    const { data: appointment, error: fetchErr } = await supabaseAdmin
        .from("appointments")
        .select("*")
        .eq("id", appointmentId)
        .eq("therapist_id", therapist.id)
        .maybeSingle();

    if (fetchErr || !appointment) {
        throw new Error("Appointment not found or unauthorized");
    }

    if (appointment.status === "cancelled") {
        return appointment; // Already cancelled
    }

    // 24-Hour cancellation policy check
    const startTimeMs = new Date(appointment.start_time).getTime();
    const hoursUntilStart = (startTimeMs - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilStart < 24) {
        throw new Error("Cancellations are only permitted at least 24 hours prior to the scheduled session start time.");
    }

    const { data, error } = await supabaseAdmin
        .from("appointments")
        .update({
            status: "cancelled",
            cancelled_by: "therapist",
            cancellation_reason: reason || "Cancelled by therapist",
            updated_at: new Date().toISOString(),
        })
        .eq("id", appointmentId)
        .eq("therapist_id", therapist.id)
        .select("*, profiles:user_id (id, name, email)")
        .single();

    if (error) {
        console.error("[TherapistService] cancelAppointmentByTherapist error:", error.message);
        throw new Error(`Failed to cancel appointment: ${error.message}`);
    }

    // Trigger non-blocking cancellation email to user/patient after DB update succeeds
    try {
        const userEmail = (data as any)?.profiles?.email;
        const userName = (data as any)?.profiles?.name || "Valued Client";

        const { data: therapistInfo } = await supabaseAdmin
            .from("therapists")
            .select("email, full_name")
            .eq("id", therapist.id)
            .maybeSingle();

        if (userEmail) {
            sendAppointmentCancellationToUser({
                userEmail,
                userName,
                therapistEmail: therapistInfo?.email || "",
                therapistName: therapistInfo?.full_name || "Therapist",
                appointmentNumber: data.appointment_number || data.id,
                startTime: data.start_time,
                endTime: data.end_time,
                reason: reason || "Cancelled by therapist",
            }).catch(err => {
                console.error("[TherapistService] Non-blocking therapist cancellation email to user failed:", err?.message || err);
            });
        }
    } catch (e: any) {
        console.error("[TherapistService] Error triggering therapist cancellation email:", e?.message || e);
    }

    return data;
}

export async function devSetUserRole(email: string, role: "patient" | "therapist" | "admin") {
    const { data: profile, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("id, name, email")
        .eq("email", email)
        .maybeSingle();

    if (pErr || !profile) {
        throw new Error(`Profile not found for email: ${email}`);
    }

    const { data: updatedProfile, error: uErr } = await supabaseAdmin
        .from("profiles")
        .update({ role })
        .eq("id", profile.id)
        .select()
        .single();

    if (uErr) {
        throw new Error(`Failed to update profile role: ${uErr.message}`);
    }

    let therapistRecord = null;
    if (role === "therapist") {
        const { data: existing } = await supabaseAdmin
            .from("therapists")
            .select("id")
            .eq("user_id", profile.id)
            .maybeSingle();

        if (!existing) {
            const { data: newT, error: tErr } = await supabaseAdmin
                .from("therapists")
                .insert({
                    user_id: profile.id,
                    full_name: profile.name || "Dr. " + email.split("@")[0],
                    email: email,
                    title: "Licensed Clinical Psychologist",
                    short_headline: "Verified Practitioner (Dev Test)",
                    bio: "Dev testing therapist profile.",
                    hourly_rate: 120,
                    status: "active",
                    is_verified: true,
                    verification_status: "approved",
                    specialties: ["Anxiety", "Depression", "CBT"],
                    languages: ["English"],
                })
                .select()
                .single();

            if (tErr) console.warn("[DevSetRole] Failed to create sample therapist record:", tErr.message);
            therapistRecord = newT;
        } else {
            therapistRecord = existing;
        }
    }

    return { profile: updatedProfile, therapist: therapistRecord };
}

export interface AdminOnboardTherapistInput extends TherapistOnboardingInput {
    targetUserId?: string;
}

export async function adminOnboardTherapist(adminUserId: string, input: AdminOnboardTherapistInput) {
    if (!input.email) {
        throw new Error("Therapist email is required for admin onboarding");
    }

    const email = input.email.trim().toLowerCase();
    let targetUserId = input.targetUserId || null;

    // 1. If targetUserId is not provided, look up existing user profile by email
    if (!targetUserId) {
        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("email", email)
            .maybeSingle();

        if (profile?.id) {
            targetUserId = profile.id;
        }
    }

    // 2. Check if a therapist record already exists by user_id or email
    let existingTherapist = null;
    if (targetUserId) {
        const { data: byUser } = await supabaseAdmin
            .from("therapists")
            .select("*")
            .eq("user_id", targetUserId)
            .maybeSingle();
        existingTherapist = byUser;
    }
    if (!existingTherapist) {
        const { data: byEmail } = await supabaseAdmin
            .from("therapists")
            .select("*")
            .eq("email", email)
            .maybeSingle();
        existingTherapist = byEmail;
    }

    // 3. Construct payload with default verified & approved status
    const payload: Record<string, any> = {
        email: email,
        full_name: input.fullName || (existingTherapist?.full_name ?? ("Dr. " + email.split("@")[0])),
        phone: input.phone,
        gender: input.gender,
        dob: input.dob,
        profile_picture_url: input.profilePictureUrl,
        address_city: input.addressCity,
        address_country: input.addressCountry,
        timezone: input.timezone || "UTC",
        title: input.title || "Licensed Clinical Psychologist",
        short_headline: input.shortHeadline || "Verified Mental Health Professional",
        highest_degree: input.highestDegree,
        university_institution: input.universityInstitution,
        license_number: input.licenseNumber,
        licensing_state_board: input.licensingStateBoard,
        license_expiry_date: input.licenseExpiryDate,
        years_of_experience: input.yearsOfExperience ?? 3,
        license_document_url: input.licenseDocumentUrl,
        gov_id_document_url: input.govIdDocumentUrl,
        bio: input.bio || "Experienced therapist providing compassionate mental health care.",
        therapeutic_approaches: input.therapeuticApproaches ?? ["CBT", "Mindfulness"],
        specialties: input.specialties ?? ["Anxiety", "Depression"],
        target_clients: input.targetClients ?? ["Adults"],
        languages: input.languages ?? ["English"],
        hourly_rate: input.hourlyRate ?? 100,
        currency: input.currency ?? "INR",
        supported_session_types: input.supportedSessionTypes ?? ["video", "chat"],
        payout_bank_name: input.payoutBankName,
        payout_account_number: input.payoutAccountNumber,
        payout_routing_code: input.payoutRoutingCode,

        // Verified by default for Admin Onboarding
        is_verified: true,
        verification_status: "approved",
        status: "active",
        onboarding_completed: true,
        onboarding_step: input.onboardingStep ?? 5,
        updated_at: new Date().toISOString(),
    };

    if (targetUserId) {
        payload.user_id = targetUserId;
    }

    let result;
    if (existingTherapist) {
        const { data, error } = await supabaseAdmin
            .from("therapists")
            .update(payload)
            .eq("id", existingTherapist.id)
            .select()
            .single();

        if (error) throw new Error(`Failed to update therapist record: ${error.message}`);
        result = data;
    } else {
        const { data, error } = await supabaseAdmin
            .from("therapists")
            .insert(payload)
            .select()
            .single();

        if (error) throw new Error(`Failed to save therapist record: ${error.message}`);
        result = data;
    }

    // 4. Update profile role to 'therapist' if profile exists
    if (targetUserId) {
        await supabaseAdmin
            .from("profiles")
            .update({ role: "therapist" })
            .eq("id", targetUserId);
    }

    return result;
}

export async function getTherapistTimeOffList(userId: string) {
    const { data: therapist, error: tErr } = await supabaseAdmin
        .from("therapists")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

    if (tErr || !therapist) {
        throw new Error("Therapist profile not found for this user account");
    }

    // Fetch time-off records from start of today (IST) onward
    const startOfTodayISO = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

    const { data, error } = await supabaseAdmin
        .from("therapist_time_off")
        .select("*")
        .eq("therapist_id", therapist.id)
        .gte("end_datetime", startOfTodayISO)
        .order("start_datetime", { ascending: true });

    if (error) {
        console.error("[TherapistService] getTherapistTimeOffList error:", error.message);
        throw new Error(`Failed to fetch availability records: ${error.message}`);
    }

    return data ?? [];
}

export interface AddTherapistTimeOffInput {
    date: string; // YYYY-MM-DD
    isFullDay: boolean;
    startTime?: string; // HH:mm
    endTime?: string; // HH:mm
    reason?: string;
}

export async function addTherapistTimeOff(userId: string, input: AddTherapistTimeOffInput) {
    if (!input.date) {
        throw new Error("Date is required.");
    }

    const { data: therapist, error: tErr } = await supabaseAdmin
        .from("therapists")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

    if (tErr || !therapist) {
        throw new Error("Therapist profile not found for this user account");
    }

    let startDatetimeISO: string;
    let endDatetimeISO: string;

    if (input.isFullDay) {
        startDatetimeISO = new Date(`${input.date}T00:00:00+05:30`).toISOString();
        endDatetimeISO = new Date(`${input.date}T23:59:59+05:30`).toISOString();
    } else {
        if (!input.startTime || !input.endTime) {
            throw new Error("Start time and end time are required for partial day unavailability.");
        }
        startDatetimeISO = new Date(`${input.date}T${input.startTime}:00+05:30`).toISOString();
        endDatetimeISO = new Date(`${input.date}T${input.endTime}:00+05:30`).toISOString();
    }

    const startTs = new Date(startDatetimeISO).getTime();
    const endTs = new Date(endDatetimeISO).getTime();

    if (isNaN(startTs) || isNaN(endTs)) {
        throw new Error("Invalid date or time format.");
    }

    if (endTs <= startTs) {
        throw new Error("End time must be after start time.");
    }

    // Past date/time validation: Cannot block time entirely in the past
    if (endTs <= Date.now()) {
        throw new Error("Cannot set unavailability for past dates or times.");
    }

    // Check 1: Existing Confirmed/Pending Appointments Conflict
    const { data: appointmentConflicts, error: aptErr } = await supabaseAdmin
        .from("appointments")
        .select("id, start_time, end_time")
        .eq("therapist_id", therapist.id)
        .in("status", ["pending", "confirmed", "completed"])
        .lt("start_time", endDatetimeISO)
        .gt("end_time", startDatetimeISO);

    if (aptErr) {
        console.error("[TherapistService] Appointment conflict check error:", aptErr.message);
    }

    let existingAppointmentsCount = 0;
    if (appointmentConflicts && appointmentConflicts.length > 0) {
        existingAppointmentsCount = appointmentConflicts.length;
        console.warn(`[TherapistService] Unavailability block created over ${existingAppointmentsCount} existing appointment(s). New bookings will be blocked for this time.`);
    }

    // Check 2: Overlapping Unavailability Conflict
    const { data: timeOffConflicts, error: toErr } = await supabaseAdmin
        .from("therapist_time_off")
        .select("id")
        .eq("therapist_id", therapist.id)
        .lt("start_datetime", endDatetimeISO)
        .gt("end_datetime", startDatetimeISO);

    if (toErr) {
        console.error("[TherapistService] Time-off conflict check error:", toErr.message);
    }

    if (timeOffConflicts && timeOffConflicts.length > 0) {
        throw new Error("This time range overlaps with an existing unavailable period.");
    }

    // Insert new time off record
    const payload = {
        therapist_id: therapist.id,
        start_datetime: startDatetimeISO,
        end_datetime: endDatetimeISO,
        reason: input.reason || (input.isFullDay ? "Full day unavailable" : "Partial day unavailable"),
        created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
        .from("therapist_time_off")
        .insert(payload)
        .select()
        .single();

    if (error) {
        console.error("[TherapistService] addTherapistTimeOff insert error:", error.message);
        throw new Error(`Failed to save unavailability period: ${error.message}`);
    }

    return data;
}

export async function deleteTherapistTimeOff(userId: string, timeOffId: string) {
    const { data: therapist, error: tErr } = await supabaseAdmin
        .from("therapists")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

    if (tErr || !therapist) {
        throw new Error("Therapist profile not found for this user account");
    }

    const { data, error } = await supabaseAdmin
        .from("therapist_time_off")
        .delete()
        .eq("id", timeOffId)
        .eq("therapist_id", therapist.id)
        .select()
        .single();

    if (error) {
        console.error("[TherapistService] deleteTherapistTimeOff error:", error.message);
        throw new Error(`Failed to remove unavailability record: ${error.message}`);
    }

    return data;
}

export async function getTherapistWorkingHours(userId: string) {
    const { data: therapist, error: tErr } = await supabaseAdmin
        .from("therapists")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

    if (tErr || !therapist) {
        throw new Error("Therapist profile not found for this user account");
    }

    const { data, error } = await supabaseAdmin
        .from("therapist_availability")
        .select("*")
        .eq("therapist_id", therapist.id)
        .order("day_of_week", { ascending: true });

    if (error) {
        console.error("[TherapistService] getTherapistWorkingHours error:", error.message);
        throw new Error(`Failed to fetch working hours: ${error.message}`);
    }

    return data ?? [];
}

export interface WorkingHourItem {
    dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
    startTime: string; // "09:00"
    endTime: string;   // "17:00"
    isActive: boolean;
}

export async function saveTherapistWorkingHours(userId: string, schedule: WorkingHourItem[]) {
    if (!Array.isArray(schedule)) {
        throw new Error("Schedule must be an array of day availability objects.");
    }

    const { data: therapist, error: tErr } = await supabaseAdmin
        .from("therapists")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

    if (tErr || !therapist) {
        throw new Error("Therapist profile not found for this user account");
    }

    // Validate schedule items
    for (const item of schedule) {
        if (item.dayOfWeek === undefined || item.dayOfWeek < 0 || item.dayOfWeek > 6) {
            throw new Error("Invalid day of week (must be 0-6).");
        }
        if (item.isActive) {
            if (!item.startTime || !item.endTime) {
                throw new Error("Start time and end time are required for active working days.");
            }
            const [sH, sM] = item.startTime.split(':').map(Number);
            const [eH, eM] = item.endTime.split(':').map(Number);
            if (sH * 60 + (sM || 0) >= eH * 60 + (eM || 0)) {
                throw new Error("End time must be after start time.");
            }
        }
    }

    // Check future active appointments conflict before updating working hours
    const nowISO = new Date().toISOString();
    const { data: futureApts } = await supabaseAdmin
        .from("appointments")
        .select("id, start_time, end_time")
        .eq("therapist_id", therapist.id)
        .in("status", ["pending", "confirmed", "completed"])
        .gte("start_time", nowISO);

    if (futureApts && futureApts.length > 0) {
        for (const apt of futureApts) {
            const aptDateInIST = new Date(new Date(apt.start_time).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
            const aptDayOfWeek = aptDateInIST.getDay();
            const startLocalStr = new Date(apt.start_time).toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour12: false });
            const endLocalStr = new Date(apt.end_time).toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour12: false });

            const [aStartH, aStartM] = startLocalStr.split(':').map(Number);
            const [aEndH, aEndM] = endLocalStr.split(':').map(Number);
            const aStartMins = aStartH * 60 + aStartM;
            const aEndMins = aEndH * 60 + aEndM;

            const daySetting = schedule.find(s => s.dayOfWeek === aptDayOfWeek);
            if (!daySetting || !daySetting.isActive) {
                throw new Error("An appointment already exists outside these working hours. Please cancel or reschedule existing appointments before updating your working schedule.");
            }

            const [wStartH, wStartM] = daySetting.startTime.split(':').map(Number);
            const [wEndH, wEndM] = daySetting.endTime.split(':').map(Number);
            const wStartMins = wStartH * 60 + (wStartM || 0);
            const wEndMins = wEndH * 60 + (wEndM || 0);

            if (aStartMins < wStartMins || aEndMins > wEndMins) {
                throw new Error("An appointment already exists outside these working hours. Please cancel or reschedule existing appointments before updating your working schedule.");
            }
        }
    }

    // Replace availability schedule
    await supabaseAdmin
        .from("therapist_availability")
        .delete()
        .eq("therapist_id", therapist.id);

    const activeRows = schedule
        .filter(s => s.isActive)
        .map(s => ({
            therapist_id: therapist.id,
            day_of_week: s.dayOfWeek,
            start_time: s.startTime,
            end_time: s.endTime,
            is_active: true,
            created_at: new Date().toISOString(),
        }));

    if (activeRows.length > 0) {
        const { data, error: insertErr } = await supabaseAdmin
            .from("therapist_availability")
            .insert(activeRows)
            .select();

        if (insertErr) {
            console.error("[TherapistService] saveTherapistWorkingHours insert error:", insertErr.message);
            throw new Error(`Failed to save working hours: ${insertErr.message}`);
        }
        return data;
    }

    return [];
}

export async function updateAppointmentClinicalNotes(userId: string, appointmentId: string, clinicalNotes: string) {
    const { data: therapist } = await supabaseAdmin
        .from("therapists")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

    if (!therapist) {
        throw new Error("Unauthorized therapist account");
    }

    const { data, error } = await supabaseAdmin
        .from("appointments")
        .update({
            clinical_notes: clinicalNotes,
            updated_at: new Date().toISOString(),
        })
        .eq("id", appointmentId)
        .eq("therapist_id", therapist.id)
        .select("*, profiles:user_id (id, name, email)")
        .single();

    if (error) {
        console.error("[TherapistService] updateAppointmentClinicalNotes error:", error.message);
        throw new Error(`Failed to update clinical notes: ${error.message}`);
    }

    return data;
}

export async function updateDoctorRemarksAndPrescription(
    userId: string,
    appointmentId: string,
    payload: {
        clinicalNotes?: string;
        doctorRemarks?: string;
        doctorSuggestions?: string;
        doctorPrescription?: string;
        treatmentStatus?: string;
    }
) {
    const { data: therapist } = await supabaseAdmin
        .from("therapists")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

    if (!therapist) {
        throw new Error("Unauthorized therapist account");
    }

    const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
    };
    if (payload.clinicalNotes !== undefined) updatePayload.clinical_notes = payload.clinicalNotes;
    if (payload.doctorRemarks !== undefined) updatePayload.doctor_remarks = payload.doctorRemarks;
    if (payload.doctorSuggestions !== undefined) updatePayload.doctor_suggestions = payload.doctorSuggestions;
    if (payload.doctorPrescription !== undefined) updatePayload.doctor_prescription = payload.doctorPrescription;
    if (payload.treatmentStatus !== undefined) updatePayload.treatment_status = payload.treatmentStatus;

    const { data, error } = await supabaseAdmin
        .from("appointments")
        .update(updatePayload)
        .eq("id", appointmentId)
        .eq("therapist_id", therapist.id)
        .select("*, profiles:user_id (id, name, email)")
        .single();

    if (error) {
        console.error("[TherapistService] updateDoctorRemarks error:", error.message);
        throw new Error(`Failed to update doctor remarks: ${error.message}`);
    }

    return data;
}

export async function completePatientTreatment(userId: string, patientUserId: string) {
    const { data: therapist } = await supabaseAdmin
        .from("therapists")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

    if (!therapist) {
        throw new Error("Unauthorized therapist account");
    }

    await supabaseAdmin
        .from("appointments")
        .update({
            treatment_status: 'completed',
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", patientUserId)
        .eq("therapist_id", therapist.id);

    await supabaseAdmin
        .from("therapy_booking_packages")
        .update({
            treatment_status: 'completed',
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", patientUserId)
        .eq("therapist_id", therapist.id);

    return { success: true, message: "Patient treatment journey marked as completed." };
}

export async function rescheduleAppointmentByTherapist(
    userId: string,
    appointmentId: string,
    input: { newStartTime: string; newEndTime?: string }
) {
    const { data: therapist } = await supabaseAdmin
        .from("therapists")
        .select("id, full_name, email")
        .eq("user_id", userId)
        .maybeSingle();

    if (!therapist) {
        throw new Error("Unauthorized practitioner account");
    }

    const { data: apt, error: aptErr } = await supabaseAdmin
        .from("appointments")
        .select("*, profiles:user_id(id, name, email)")
        .eq("id", appointmentId)
        .eq("therapist_id", therapist.id)
        .maybeSingle();

    if (aptErr || !apt) {
        throw new Error("Appointment not found or unauthorized");
    }

    if (!["confirmed", "pending"].includes(apt.status)) {
        throw new Error(`Cannot reschedule appointment with status '${apt.status}'`);
    }

    const newStartTs = new Date(input.newStartTime).getTime();
    if (isNaN(newStartTs) || newStartTs <= Date.now()) {
        throw new Error("Rescheduled appointment start time must be in the future");
    }

    // Calculate newEndTime: default 1 hour after start if not provided
    let newEndISO = input.newEndTime;
    if (!newEndISO) {
        newEndISO = new Date(newStartTs + 60 * 60 * 1000).toISOString();
    }
    const newStartISO = new Date(newStartTs).toISOString();

    // Check for conflict with other existing appointments for this practitioner (excluding current appointment)
    const { data: conflicts } = await supabaseAdmin
        .from("appointments")
        .select("id")
        .eq("therapist_id", therapist.id)
        .in("status", ["pending", "confirmed", "completed"])
        .neq("id", appointmentId)
        .lt("start_time", newEndISO)
        .gt("end_time", newStartISO);

    if (conflicts && conflicts.length > 0) {
        throw new Error("The selected new time slot conflicts with another existing session.");
    }

    // Update appointment record while preserving package_id and session_number
    const { data: updatedApt, error: updateErr } = await supabaseAdmin
        .from("appointments")
        .update({
            start_time: newStartISO,
            end_time: newEndISO,
            updated_at: new Date().toISOString(),
        })
        .eq("id", appointmentId)
        .select("*, profiles:user_id(id, name, email)")
        .single();

    if (updateErr) {
        throw new Error(`Failed to reschedule appointment: ${updateErr.message}`);
    }

    // Trigger reschedule notification emails
    const user = updatedApt.profiles || {};
    if (user.email) {
        sendRescheduleEmailToPatient({
            userEmail: user.email,
            userName: user.name || "Client",
            therapistEmail: therapist.email || "",
            therapistName: therapist.full_name || "Practitioner",
            appointmentNumber: updatedApt.appointment_number || updatedApt.id,
            startTime: newStartISO,
            endTime: newEndISO,
            sessionType: updatedApt.session_type || "video",
            feeAmount: updatedApt.fee_amount || 0,
            googleMeetUrl: updatedApt.google_meet_url || updatedApt.meeting_link || "",
        }).catch(err => console.error("[TherapistService] Reschedule email to patient failed:", err));
    }

    if (therapist.email) {
        sendRescheduleEmailToPractitioner({
            userEmail: user.email || "",
            userName: user.name || "Client",
            therapistEmail: therapist.email,
            therapistName: therapist.full_name || "Practitioner",
            appointmentNumber: updatedApt.appointment_number || updatedApt.id,
            startTime: newStartISO,
            endTime: newEndISO,
            sessionType: updatedApt.session_type || "video",
            feeAmount: updatedApt.fee_amount || 0,
            googleMeetUrl: updatedApt.google_meet_url || updatedApt.meeting_link || "",
        }).catch(err => console.error("[TherapistService] Reschedule email to practitioner failed:", err));
    }

    return updatedApt;
}





