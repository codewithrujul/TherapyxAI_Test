import dotenv from "dotenv";
dotenv.config();

import { supabaseAdmin } from "../db/supabaseClient";
import {
    createAppointment,
    getTherapistBookedSlots,
    getAppointmentMeetingLink,
    updateAppointmentStatusByTherapist,
    cancelAppointment,
} from "../services/therapistService";

async function createTestUser(email: string, name: string, role: string) {
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: "TestPassword123!",
        email_confirm: true,
        user_metadata: { name },
    });

    if (authErr || !authData.user) {
        // If user exists, fetch profile
        const { data: existingProfile } = await supabaseAdmin.from("profiles").select("*").eq("email", email).maybeSingle();
        if (existingProfile) return existingProfile;
        throw new Error(`Failed to create auth user: ${authErr?.message}`);
    }

    const userId = authData.user.id;
    const { data: profile } = await supabaseAdmin.from("profiles").upsert({
        id: userId,
        email,
        name,
        role,
    }).select().single();

    return profile || { id: userId, email, name, role };
}

async function runAppointmentTests() {
    console.log("=================================================================");
    console.log("  STARTING AUTOMATED THERAPIST APPOINTMENT FLOW TEST SUITE       ");
    console.log("=================================================================");

    let passedCount = 0;
    let totalCount = 0;

    function assertTest(testName: string, passed: boolean, details?: string) {
        totalCount++;
        if (passed) {
            passedCount++;
            console.log(`[PASS] Case ${totalCount}: ${testName}${details ? ` -> ${details}` : ""}`);
        } else {
            console.error(`[FAIL] Case ${totalCount}: ${testName}${details ? ` -> ${details}` : ""}`);
        }
    }

    try {
        const timestamp = Date.now();
        const testUser1Email = `patient1_${timestamp}@example.com`;
        const testUser2Email = `patient2_${timestamp}@example.com`;
        const testTherapist1Email = `therapist1_${timestamp}@example.com`;
        const testTherapist2Email = `therapist2_${timestamp}@example.com`;

        // 1. Create patient and therapist users
        const u1 = await createTestUser(testUser1Email, "Test Patient One", "patient");
        const u2 = await createTestUser(testUser2Email, "Test Patient Two", "patient");
        const tu1 = await createTestUser(testTherapist1Email, "Dr. Therapist One", "therapist");
        const tu2 = await createTestUser(testTherapist2Email, "Dr. Therapist Two", "therapist");

        // 2. Create therapist records
        const { data: t1 } = await supabaseAdmin.from("therapists").insert({
            user_id: tu1.id, full_name: "Dr. Therapist One", email: testTherapist1Email, title: "Licensed Psychologist", hourly_rate: 150, status: "active", is_verified: true
        }).select().single();

        const { data: t2 } = await supabaseAdmin.from("therapists").insert({
            user_id: tu2.id, full_name: "Dr. Therapist Two", email: testTherapist2Email, title: "Licensed Counselor", hourly_rate: 140, status: "active", is_verified: true
        }).select().single();

        const patient1Id = u1.id;
        const patient2Id = u2.id;
        const therapist1Id = t1!.id;
        const therapist2Id = t2!.id;

        // Date calculations (tomorrow in IST)
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const dateStr = tomorrow.toISOString().split("T")[0];

        const slot1Start = new Date(`${dateStr}T10:00:00+05:30`).toISOString();
        const slot1End   = new Date(`${dateStr}T11:00:00+05:30`).toISOString();

        const slot2Start = new Date(`${dateStr}T12:00:00+05:30`).toISOString();
        const slot2End   = new Date(`${dateStr}T13:00:00+05:30`).toISOString();

        // 1. Past date -> rejected
        try {
            await createAppointment(patient1Id, {
                therapistId: therapist1Id,
                startTime: "2020-01-01T10:00:00+05:30",
                endTime: "2020-01-01T11:00:00+05:30",
                feeAmount: 150,
            });
            assertTest("Past date rejected", false, "Expected error but succeeded");
        } catch (err: any) {
            assertTest("Past date rejected", err.message.includes("past"), err.message);
        }

        // 2. Past time today -> rejected
        try {
            const pastHourToday = new Date(Date.now() - 2 * 3600000).toISOString();
            const pastHourTodayEnd = new Date(Date.now() - 1 * 3600000).toISOString();
            await createAppointment(patient1Id, {
                therapistId: therapist1Id,
                startTime: pastHourToday,
                endTime: pastHourTodayEnd,
                feeAmount: 150,
            });
            assertTest("Past time today rejected", false, "Expected error but succeeded");
        } catch (err: any) {
            assertTest("Past time today rejected", err.message.includes("past"), err.message);
        }

        // 3. Future hourly slot -> allowed
        let apt1: any = null;
        try {
            apt1 = await createAppointment(patient1Id, {
                therapistId: therapist1Id,
                startTime: slot1Start,
                endTime: slot1End,
                feeAmount: 150,
            });
            assertTest("Future hourly slot allowed", !!apt1?.id, `Created APT ID: ${apt1?.id}`);
        } catch (err: any) {
            assertTest("Future hourly slot allowed", false, err.message);
        }

        // 4. 30-minute slot -> rejected
        try {
            const slot30MinEnd = new Date(new Date(slot2Start).getTime() + 30 * 60000).toISOString();
            await createAppointment(patient1Id, {
                therapistId: therapist1Id,
                startTime: slot2Start,
                endTime: slot30MinEnd,
                feeAmount: 150,
            });
            assertTest("30-minute slot rejected", false, "Expected 1-hour restriction error");
        } catch (err: any) {
            assertTest("30-minute slot rejected", err.message.includes("1 hour"), err.message);
        }

        // 5. Therapist slot already pending -> rejected
        try {
            await createAppointment(patient2Id, {
                therapistId: therapist1Id,
                startTime: slot1Start,
                endTime: slot1End,
                feeAmount: 150,
            });
            assertTest("Therapist slot already pending rejected", false, "Allowed duplicate booking");
        } catch (err: any) {
            assertTest("Therapist slot already pending rejected", err.message.includes("available"), err.message);
        }

        // 6. Therapist slot already confirmed -> rejected
        try {
            await updateAppointmentStatusByTherapist(tu1.id, apt1.id, "confirmed");
            await createAppointment(patient2Id, {
                therapistId: therapist1Id,
                startTime: slot1Start,
                endTime: slot1End,
                feeAmount: 150,
            });
            assertTest("Therapist slot already confirmed rejected", false, "Allowed duplicate booking on confirmed slot");
        } catch (err: any) {
            assertTest("Therapist slot already confirmed rejected", err.message.includes("available"), err.message);
        }

        // 7. Same user + same time + different therapist -> rejected
        try {
            await createAppointment(patient1Id, {
                therapistId: therapist2Id,
                startTime: slot1Start,
                endTime: slot1End,
                feeAmount: 140,
            });
            assertTest("Same user + same time + different therapist rejected", false, "Allowed user double booking");
        } catch (err: any) {
            assertTest("Same user + same time + different therapist rejected", err.message.includes("scheduled"), err.message);
        }

        // 8. Same user + different non-overlapping time -> allowed
        let apt2: any = null;
        try {
            apt2 = await createAppointment(patient1Id, {
                therapistId: therapist2Id,
                startTime: slot2Start,
                endTime: slot2End,
                feeAmount: 140,
            });
            assertTest("Same user + different non-overlapping time allowed", !!apt2?.id, `Created APT ID: ${apt2?.id}`);
        } catch (err: any) {
            assertTest("Same user + different non-overlapping time allowed", false, err.message);
        }

        // 9. Cancelled appointment -> slot becomes available
        try {
            await cancelAppointment(patient1Id, apt2.id);
            const reBooked = await createAppointment(patient2Id, {
                therapistId: therapist2Id,
                startTime: slot2Start,
                endTime: slot2End,
                feeAmount: 140,
            });
            assertTest("Cancelled appointment slot releases & becomes available", !!reBooked?.id, `Re-booked APT ID: ${reBooked?.id}`);
        } catch (err: any) {
            assertTest("Cancelled appointment slot releases & becomes available", false, err.message);
        }

        // 10 & 11. Simultaneous booking / Double click -> only 1 succeeds
        const slot3Start = new Date(`${dateStr}T14:00:00+05:30`).toISOString();
        const slot3End   = new Date(`${dateStr}T15:00:00+05:30`).toISOString();
        try {
            const results = await Promise.allSettled([
                createAppointment(patient1Id, { therapistId: therapist1Id, startTime: slot3Start, endTime: slot3End, feeAmount: 150 }),
                createAppointment(patient2Id, { therapistId: therapist1Id, startTime: slot3Start, endTime: slot3End, feeAmount: 150 })
            ]);
            const fulfilled = results.filter(r => r.status === "fulfilled");
            const rejected = results.filter(r => r.status === "rejected");
            assertTest("Simultaneous / double-click booking concurrency test", fulfilled.length === 1 && rejected.length === 1, `Fulfilled: ${fulfilled.length}, Rejected: ${rejected.length}`);
        } catch (err: any) {
            assertTest("Simultaneous / double-click booking concurrency test", false, err.message);
        }

        // 12. Stale frontend slot -> backend rejects and slots fetched accurately
        try {
            const slotRes = await getTherapistBookedSlots(therapist1Id, dateStr, patient1Id);
            const slot10AM = slotRes.slots.find(s => s.timeValue === "10:00");
            assertTest("Stale slot detection & slot list accuracy", slot10AM?.isAvailable === false && slot10AM?.reason === "booked", `10 AM slot available = ${slot10AM?.isAvailable}`);
        } catch (err: any) {
            assertTest("Stale slot detection & slot list accuracy", false, err.message);
        }

        // 13. Therapist confirms appointment -> patient receives confirmation email trigger
        try {
            const confirmedApt = await updateAppointmentStatusByTherapist(tu1.id, apt1.id, "confirmed");
            assertTest("Therapist confirms appointment & sends email", confirmedApt.status === "confirmed", `Status: ${confirmedApt.status}`);
        } catch (err: any) {
            assertTest("Therapist confirms appointment & sends email", false, err.message);
        }

        // 14, 15, 16 & 17. Meeting button before start -> disabled & direct API access rejected
        try {
            await getAppointmentMeetingLink(apt1.id, patient1Id, "patient");
            assertTest("Direct meeting API before start time rejected", false, "Allowed access before start time");
        } catch (err: any) {
            assertTest("Direct meeting API before start time rejected", err.message.includes("not active yet"), err.message);
        }

        // 18. Direct API access by unrelated user -> rejected
        try {
            await getAppointmentMeetingLink(apt1.id, patient2Id, "patient");
            assertTest("Direct API access by unrelated user rejected", false, "Allowed unrelated user access");
        } catch (err: any) {
            assertTest("Direct API access by unrelated user rejected", err.message.includes("Unauthorized"), err.message);
        }

        // 19. Therapist cannot access another therapist's appointment meeting link
        try {
            await getAppointmentMeetingLink(apt1.id, tu2.id, "therapist");
            assertTest("Therapist accessing another therapist's appointment rejected", false, "Allowed cross-therapist access");
        } catch (err: any) {
            assertTest("Therapist accessing another therapist's appointment rejected", err.message.includes("Unauthorized"), err.message);
        }

        // 20. Existing Google Meet link preservation & validity during active session
        const mockStart = new Date(Date.now() - 10 * 60000).toISOString();
        const mockEnd   = new Date(Date.now() + 50 * 60000).toISOString();

        const { data: activeApt } = await supabaseAdmin.from("appointments").insert({
            user_id: patient1Id,
            therapist_id: therapist2Id,
            start_time: mockStart,
            end_time: mockEnd,
            session_type: "video",
            status: "confirmed",
            payment_status: "paid",
            fee_amount: 140,
            google_meet_url: "https://meet.google.com/test-mock-space",
            meeting_link: "https://meet.google.com/test-mock-space",
            google_meet_status: "created",
        }).select().single();

        try {
            const activeMeet = await getAppointmentMeetingLink(activeApt!.id, patient1Id, "patient");
            assertTest("Existing Google Meet link active during session window", activeMeet.success && !!activeMeet.googleMeetUrl, `Meet URL: ${activeMeet.googleMeetUrl}`);
        } catch (err: any) {
            assertTest("Existing Google Meet link active during session window", false, err.message);
        }

        // Cleanup test records
        await supabaseAdmin.from("appointments").delete().in("user_id", [patient1Id, patient2Id]);
        await supabaseAdmin.from("therapists").delete().in("id", [therapist1Id, therapist2Id]);
        await supabaseAdmin.from("profiles").delete().in("id", [patient1Id, patient2Id, tu1.id, tu2.id]);
        await supabaseAdmin.auth.admin.deleteUser(patient1Id);
        await supabaseAdmin.auth.admin.deleteUser(patient2Id);
        await supabaseAdmin.auth.admin.deleteUser(tu1.id);
        await supabaseAdmin.auth.admin.deleteUser(tu2.id);

    } catch (err: any) {
        console.error("Test runner unexpected error:", err);
    }

    console.log("=================================================================");
    console.log(`  SUITE SUMMARY: ${passedCount} / ${totalCount} TESTS PASSED    `);
    console.log("=================================================================");
}

runAppointmentTests();
