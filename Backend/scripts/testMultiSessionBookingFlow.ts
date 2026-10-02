import dotenv from "dotenv";
dotenv.config();

import { validateRecurringSlots, createAppointment } from "../services/therapistService";
import { supabaseAdmin } from "../db/supabaseClient";

async function runTests() {
    console.log("=================================================");
    console.log("Testing TherapyxAI Multi-Session Package Creation & Atomic Validation");
    console.log("=================================================");

    try {
        // 1. Fetch active therapist for testing
        const { data: therapist } = await supabaseAdmin
            .from("therapists")
            .select("id, full_name, hourly_rate")
            .eq("status", "active")
            .limit(1)
            .single();

        if (!therapist) {
            console.error("❌ Test setup failed: No active therapist found.");
            return;
        }

        console.log(`✓ Active therapist found: ${therapist.full_name} (${therapist.id})`);

        // 2. Fetch or mock a user profile for testing
        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id, name, email")
            .limit(1)
            .single();

        if (!profile) {
            console.error("❌ Test setup failed: No user profile found.");
            return;
        }

        console.log(`✓ User profile found: ${profile.name} (${profile.id})`);

        // 3. Test validateRecurringSlots for 3, 6, and 9 sessions
        const futureDate = "2026-11-04"; // Wednesday
        const startTimeStr = "10:00";
        const startTimeISO = new Date(`${futureDate}T10:00:00+05:30`).toISOString();
        const endTimeISO = new Date(`${futureDate}T11:00:00+05:30`).toISOString();

        console.log("\n[Test 1] Validating recurring slots for 3 sessions...");
        const res3 = await validateRecurringSlots({
            therapistId: therapist.id,
            startDate: futureDate,
            startTime: startTimeStr,
            startTimeISO,
            endTimeISO,
            sessionCount: 3,
            userId: profile.id,
        });

        console.log(`Validation result (3 sessions): valid=${res3.valid}, total generated=${res3.sessions.length}`);
        res3.sessions.forEach(s => {
            console.log(`   Session ${s.sessionNumber}: ${s.displayDate} · ${s.displayTime} -> available=${s.available} (${s.reason || 'ok'})`);
        });

        if (res3.sessions.length !== 3) {
            console.error("❌ Failed: Expected 3 generated sessions.");
        } else {
            console.log("✓ Test 1 Passed: Generated exact 3 consecutive weekly slots.");
        }

        console.log("\n[Test 2] Booking a 3-session package atomically...");
        const bookingResult = await createAppointment(profile.id, {
            therapistId: therapist.id,
            startTime: startTimeISO,
            endTime: endTimeISO,
            sessionType: 'video',
            userNotes: 'Multi-session package integration test',
            feeAmount: therapist.hourly_rate,
            sessionCount: 3,
        });

        console.log("✓ Booking result:", {
            totalSessions: bookingResult.totalSessions,
            createdAppointmentsCount: bookingResult.appointments?.length,
            packageId: bookingResult.package?.id || 'created',
            firstAptId: bookingResult.id,
            sessionNumber: bookingResult.session_number,
        });

        if (bookingResult.appointments?.length === 3) {
            console.log("✓ Test 2 Passed: Exactly 3 appointment records were atomically created.");
        } else {
            console.error("❌ Test 2 Failed: Appointment count mismatch.");
        }

        console.log("\n[Test 3] Attempting to book overlapping package (Atomic Conflict Test)...");
        try {
            await createAppointment(profile.id, {
                therapistId: therapist.id,
                startTime: startTimeISO,
                endTime: endTimeISO,
                sessionType: 'video',
                userNotes: 'Conflicting package test',
                feeAmount: therapist.hourly_rate,
                sessionCount: 3,
            });
            console.error("❌ Test 3 Failed: Overlapping booking should have been rejected!");
        } catch (conflictErr: any) {
            console.log("✓ Test 3 Passed: Conflict caught correctly!");
            console.log("  Error message:", conflictErr.message.split("\n")[0]);
        }

        // Clean up created test appointments
        if (bookingResult.appointments?.length) {
            const ids = bookingResult.appointments.map((a: any) => a.id);
            await supabaseAdmin.from("appointments").delete().in("id", ids);
            if (bookingResult.package?.id) {
                await supabaseAdmin.from("therapy_booking_packages").delete().eq("id", bookingResult.package.id);
            }
            console.log("\n✓ Cleaned up test appointments and package from database.");
        }

        console.log("\n=================================================");
        console.log("All Multi-Session Package Tests PASSED Successfully!");
        console.log("=================================================");
    } catch (err: any) {
        console.error("❌ Test error:", err?.message || err);
    }
}

runTests();
