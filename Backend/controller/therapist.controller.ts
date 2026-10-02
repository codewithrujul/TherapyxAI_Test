import { Request, Response } from "express";
import {
    listTherapists,
    getTherapistById,
    getTherapistByUserId,
    upsertTherapistOnboarding,
    createAppointment,
    validateRecurringSlots,
    getUserAppointments,
    cancelAppointment,
    getTherapistAssignedAppointments,
    updateAppointmentStatusByTherapist,
    cancelAppointmentByTherapist,
    devSetUserRole,
    adminOnboardTherapist,
    getTherapistBookedSlots,
    getAppointmentMeetingLink,
    getTherapistTimeOffList,
    addTherapistTimeOff,
    deleteTherapistTimeOff,
    getTherapistWorkingHours,
    saveTherapistWorkingHours,
    updateAppointmentClinicalNotes,
    updateDoctorRemarksAndPrescription,
    completePatientTreatment,
    rescheduleAppointmentByTherapist,
    ListTherapistsFilter,
} from "../services/therapistService";
import { retryGoogleMeetCreation } from "../services/googleMeetService";

export async function getTherapists(req: Request, res: Response): Promise<void> {
    try {
        const filter: ListTherapistsFilter = {
            search: typeof req.query.search === "string" ? req.query.search : undefined,
            specialty: typeof req.query.specialty === "string" ? req.query.specialty : undefined,
            language: typeof req.query.language === "string" ? req.query.language : undefined,
            sessionType: typeof req.query.sessionType === "string" ? req.query.sessionType : undefined,
            minRate: req.query.minRate ? Number(req.query.minRate) : undefined,
            maxRate: req.query.maxRate ? Number(req.query.maxRate) : undefined,
            sortBy: req.query.sortBy as any,
            page: req.query.page ? Number(req.query.page) : 1,
            limit: req.query.limit ? Number(req.query.limit) : 10,
        };

        const result = await listTherapists(filter);
        res.status(200).json(result);
    } catch (error) {
        console.error("[TherapistController] getTherapists failed:", (error as Error).message);
        res.status(500).json({
            error: { code: "FETCH_THERAPISTS_FAILED", message: (error as Error).message },
        });
    }
}

export async function getTherapistDetails(req: Request, res: Response): Promise<void> {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            res.status(400).json({ error: { code: "INVALID_ID", message: "Therapist ID is required" } });
            return;
        }

        const data = await getTherapistById(id);
        res.status(200).json(data);
    } catch (error) {
        console.error("[TherapistController] getTherapistDetails failed:", (error as Error).message);
        res.status(404).json({
            error: { code: "THERAPIST_NOT_FOUND", message: (error as Error).message },
        });
    }
}

export async function getOwnTherapistProfile(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const profile = await getTherapistByUserId(req.user.id);
        res.status(200).json({ therapist: profile ?? null });
    } catch (error) {
        console.error("[TherapistController] getOwnTherapistProfile failed:", (error as Error).message);
        res.status(500).json({
            error: { code: "FETCH_PROFILE_FAILED", message: (error as Error).message },
        });
    }
}

export async function saveTherapistOnboarding(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user ? req.user.id : null;
        const therapist = await upsertTherapistOnboarding(userId, req.body);
        res.status(200).json({
            message: "Onboarding profile saved successfully to database",
            therapist,
        });
    } catch (error) {
        console.error("[TherapistController] saveTherapistOnboarding failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "SAVE_ONBOARDING_FAILED", message: (error as Error).message },
        });
    }
}

export async function validateRecurringSlotsController(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user ? req.user.id : undefined;
        const { therapistId, startDate, startTime, startTimeISO, endTimeISO, sessionCount } = req.body;

        if (!therapistId || !sessionCount) {
            res.status(400).json({
                valid: false,
                error: { code: "INVALID_INPUT", message: "therapistId and sessionCount are required" },
            });
            return;
        }

        const result = await validateRecurringSlots({
            therapistId,
            startDate,
            startTime,
            startTimeISO,
            endTimeISO,
            sessionCount: Number(sessionCount),
            userId,
        });

        res.status(200).json(result);
    } catch (error) {
        console.error("[TherapistController] validateRecurringSlots failed:", (error as Error).message);
        res.status(400).json({
            valid: false,
            error: { code: "VALIDATION_FAILED", message: (error as Error).message },
        });
    }
}

export async function createAppointmentController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required to book an appointment" } });
            return;
        }

        const appointment = await createAppointment(req.user.id, req.body);
        
        const responsePayload = {
            success: true,
            message: appointment.google_meet_status === "failed" 
                ? "Appointment was created, but video meeting space could not be generated. You can retry."
                : "Appointment booked successfully",
            appointment: {
                ...appointment,
                googleMeetUrl: appointment.google_meet_url || appointment.meeting_link || null,
                googleMeetStatus: appointment.google_meet_status || "pending",
            },
        };

        res.status(201).json(responsePayload);
    } catch (error) {
        console.error("[TherapistController] createAppointment failed:", (error as Error).message);
        res.status(400).json({
            success: false,
            error: { code: "BOOKING_FAILED", message: (error as Error).message },
        });
    }
}

export async function retryGoogleMeetController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const appointmentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!appointmentId) {
            res.status(400).json({ error: { code: "INVALID_ID", message: "Appointment ID is required" } });
            return;
        }

        const result = await retryGoogleMeetCreation(appointmentId, req.user.id);
        
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: { code: "GOOGLE_MEET_RETRY_FAILED", message: result.error || "Failed to create Google Meet space" },
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Google Meet created successfully",
            googleMeetUrl: result.googleMeetUrl,
            googleMeetStatus: result.googleMeetStatus,
        });
    } catch (error) {
        console.error("[TherapistController] retryGoogleMeet failed:", (error as Error).message);
        res.status(500).json({
            success: false,
            error: { code: "RETRY_FAILED", message: (error as Error).message },
        });
    }
}

export async function getUserAppointmentsController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const appointments = await getUserAppointments(req.user.id);
        res.status(200).json({ appointments });
    } catch (error) {
        console.error("[TherapistController] getUserAppointments failed:", (error as Error).message);
        res.status(500).json({
            error: { code: "FETCH_APPOINTMENTS_FAILED", message: (error as Error).message },
        });
    }
}

export async function cancelAppointmentController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            res.status(400).json({ error: { code: "INVALID_ID", message: "Appointment ID is required" } });
            return;
        }

        const appointment = await cancelAppointment(req.user.id, id);
        res.status(200).json({
            message: "Appointment cancelled successfully",
            appointment,
        });
    } catch (error) {
        console.error("[TherapistController] cancelAppointment failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "CANCEL_FAILED", message: (error as Error).message },
        });
    }
}

export async function getTherapistAssignedAppointmentsController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const appointments = await getTherapistAssignedAppointments(req.user.id);
        res.status(200).json({ success: true, appointments });
    } catch (error) {
        console.error("[TherapistController] getTherapistAssignedAppointments failed:", (error as Error).message);
        res.status(500).json({
            error: { code: "FETCH_ASSIGNED_APPOINTMENTS_FAILED", message: (error as Error).message },
        });
    }
}

export async function updateAppointmentStatusByTherapistController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { status } = req.body;

        if (!id || !status) {
            res.status(400).json({ error: { code: "INVALID_INPUT", message: "Appointment ID and status are required" } });
            return;
        }

        const appointment = await updateAppointmentStatusByTherapist(req.user.id, id, status);
        res.status(200).json({
            success: true,
            message: `Appointment status updated to ${status}`,
            appointment,
        });
    } catch (error) {
        console.error("[TherapistController] updateAppointmentStatusByTherapist failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "UPDATE_STATUS_FAILED", message: (error as Error).message },
        });
    }
}

export async function cancelAppointmentByTherapistController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { reason } = req.body;

        if (!id) {
            res.status(400).json({ error: { code: "INVALID_ID", message: "Appointment ID is required" } });
            return;
        }

        const appointment = await cancelAppointmentByTherapist(req.user.id, id, reason);
        res.status(200).json({
            success: true,
            message: "Appointment cancelled by therapist",
            appointment,
        });
    } catch (error) {
        console.error("[TherapistController] cancelAppointmentByTherapist failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "THERAPIST_CANCEL_FAILED", message: (error as Error).message },
        });
    }
}

export async function devSetUserRoleController(req: Request, res: Response): Promise<void> {
    try {
        const { email, role } = req.body;
        if (!email || !role || !["patient", "therapist", "admin"].includes(role)) {
            res.status(400).json({
                error: { code: "INVALID_INPUT", message: "email and valid role ('patient', 'therapist', 'admin') are required" },
            });
            return;
        }

        const result = await devSetUserRole(email, role);
        res.status(200).json({
            success: true,
            message: `User ${email} role updated to ${role}`,
            result,
        });
    } catch (error) {
        console.error("[TherapistController] devSetUserRole failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "DEV_SET_ROLE_FAILED", message: (error as Error).message },
        });
    }
}

export async function adminOnboardTherapistController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const { email } = req.body;
        if (!email) {
            res.status(400).json({ error: { code: "INVALID_INPUT", message: "Therapist email is required" } });
            return;
        }

        const therapist = await adminOnboardTherapist(req.user.id, req.body);
        res.status(201).json({
            success: true,
            message: "Therapist onboarded and verified successfully by Admin",
            therapist,
        });
    } catch (error) {
        console.error("[TherapistController] adminOnboardTherapist failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "ADMIN_ONBOARDING_FAILED", message: (error as Error).message },
        });
    }
}

export async function getTherapistSlotsController(req: Request, res: Response): Promise<void> {
    try {
        const therapistId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const dateStr = typeof req.query.date === "string" ? req.query.date : new Date().toISOString().split("T")[0];
        const userId = req.user ? req.user.id : undefined;

        if (!therapistId) {
            res.status(400).json({ error: { code: "INVALID_ID", message: "Therapist ID is required" } });
            return;
        }

        const data = await getTherapistBookedSlots(therapistId, dateStr, userId);
        res.status(200).json(data);
    } catch (error) {
        console.error("[TherapistController] getTherapistSlots failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "FETCH_SLOTS_FAILED", message: (error as Error).message },
        });
    }
}

export async function getAppointmentMeetingLinkController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const appointmentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!appointmentId) {
            res.status(400).json({ error: { code: "INVALID_ID", message: "Appointment ID is required" } });
            return;
        }

        const result = await getAppointmentMeetingLink(appointmentId, req.user.id, req.user.role);
        res.status(200).json(result);
    } catch (error) {
        console.error("[TherapistController] getAppointmentMeetingLink failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "MEETING_ACCESS_DENIED", message: (error as Error).message },
        });
    }
}

export async function getTherapistTimeOffController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const data = await getTherapistTimeOffList(req.user.id);
        res.status(200).json({ success: true, timeOff: data });
    } catch (error) {
        console.error("[TherapistController] getTherapistTimeOff failed:", (error as Error).message);
        res.status(500).json({
            error: { code: "FETCH_AVAILABILITY_FAILED", message: (error as Error).message },
        });
    }
}

export async function addTherapistTimeOffController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const timeOff = await addTherapistTimeOff(req.user.id, req.body);
        res.status(201).json({
            success: true,
            message: "Unavailability period set successfully",
            timeOff,
        });
    } catch (error) {
        console.error("[TherapistController] addTherapistTimeOff failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "ADD_AVAILABILITY_FAILED", message: (error as Error).message },
        });
    }
}

export async function deleteTherapistTimeOffController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const timeOffId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!timeOffId) {
            res.status(400).json({ error: { code: "INVALID_ID", message: "Time off ID is required" } });
            return;
        }

        const data = await deleteTherapistTimeOff(req.user.id, timeOffId);
        res.status(200).json({
            success: true,
            message: "Unavailability period removed successfully",
            timeOff: data,
        });
    } catch (error) {
        console.error("[TherapistController] deleteTherapistTimeOff failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "DELETE_AVAILABILITY_FAILED", message: (error as Error).message },
        });
    }
}

export async function getTherapistWorkingHoursController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const data = await getTherapistWorkingHours(req.user.id);
        res.status(200).json({ success: true, workingHours: data });
    } catch (error) {
        console.error("[TherapistController] getTherapistWorkingHours failed:", (error as Error).message);
        res.status(500).json({
            error: { code: "FETCH_WORKING_HOURS_FAILED", message: (error as Error).message },
        });
    }
}

export async function saveTherapistWorkingHoursController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const { schedule } = req.body;
        const data = await saveTherapistWorkingHours(req.user.id, schedule);
        res.status(200).json({
            success: true,
            message: "General working hours saved successfully",
            workingHours: data,
        });
    } catch (error) {
        console.error("[TherapistController] saveTherapistWorkingHours failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "SAVE_WORKING_HOURS_FAILED", message: (error as Error).message },
        });
    }
}

export async function updateAppointmentClinicalNotesController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { clinicalNotes, doctorRemarks, doctorSuggestions, doctorPrescription, treatmentStatus } = req.body;

        if (!id) {
            res.status(400).json({ error: { code: "INVALID_ID", message: "Appointment ID is required" } });
            return;
        }

        const appointment = await updateDoctorRemarksAndPrescription(req.user.id, id, {
            clinicalNotes,
            doctorRemarks,
            doctorSuggestions,
            doctorPrescription,
            treatmentStatus,
        });

        res.status(200).json({
            success: true,
            message: "Doctor remarks and suggestions saved successfully",
            appointment,
        });
    } catch (error) {
        console.error("[TherapistController] updateAppointmentClinicalNotes failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "SAVE_REMARKS_FAILED", message: (error as Error).message },
        });
    }
}

export async function completePatientTreatmentController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const patientUserId = Array.isArray(req.params.patientUserId) ? req.params.patientUserId[0] : req.params.patientUserId;

        if (!patientUserId) {
            res.status(400).json({ error: { code: "INVALID_ID", message: "Patient User ID is required" } });
            return;
        }

        const result = await completePatientTreatment(req.user.id, patientUserId);
        res.status(200).json(result);
    } catch (error) {
        console.error("[TherapistController] completePatientTreatment failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "COMPLETE_TREATMENT_FAILED", message: (error as Error).message },
        });
    }
}

export async function rescheduleAppointmentByTherapistController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { newStartTime, newEndTime } = req.body;

        if (!id || !newStartTime) {
            res.status(400).json({ error: { code: "INVALID_INPUT", message: "Appointment ID and newStartTime are required" } });
            return;
        }

        const appointment = await rescheduleAppointmentByTherapist(req.user.id, id, { newStartTime, newEndTime });
        res.status(200).json({
            success: true,
            message: "Appointment rescheduled successfully",
            appointment,
        });
    } catch (error) {
        console.error("[TherapistController] rescheduleAppointmentByTherapist failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "RESCHEDULE_FAILED", message: (error as Error).message },
        });
    }
}



