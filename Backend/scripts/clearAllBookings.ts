import dotenv from "dotenv";
dotenv.config();

import { supabaseAdmin } from "../db/supabaseClient";

async function clearAllBookings() {
    console.log("=================================================");
    console.log("  CLEARING ALL BOOKING & PACKAGE RECORDS FROM DB ");
    console.log("=================================================");

    try {
        // 1. Delete session remarks / notes if table exists
        const { error: remarksErr } = await supabaseAdmin
            .from("session_remarks")
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000");
        if (remarksErr && !remarksErr.message?.includes("does not exist")) {
            console.warn("Notice (session_remarks):", remarksErr.message);
        }

        // 2. Delete all appointments
        const { data: deletedApts, error: aptErr } = await supabaseAdmin
            .from("appointments")
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000")
            .select("id");

        if (aptErr) {
            console.error("❌ Error deleting appointments:", aptErr.message);
        } else {
            console.log(`✓ Deleted ${deletedApts?.length ?? 0} appointment record(s) from 'appointments'.`);
        }

        // 3. Delete all therapy booking packages
        const { data: deletedPkgs, error: pkgErr } = await supabaseAdmin
            .from("therapy_booking_packages")
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000")
            .select("id");

        if (pkgErr) {
            console.error("❌ Error deleting booking packages:", pkgErr.message);
        } else {
            console.log(`✓ Deleted ${deletedPkgs?.length ?? 0} package record(s) from 'therapy_booking_packages'.`);
        }

        console.log("\n✅ ALL BOOKING AND PACKAGE RECORDS CLEARED SUCCESSFULLY!");
    } catch (err: any) {
        console.error("❌ Failed to clear booking records:", err.message || err);
    }
}

clearAllBookings();
