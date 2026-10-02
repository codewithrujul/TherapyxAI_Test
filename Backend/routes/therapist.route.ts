import { Router, Request, Response, NextFunction } from "express";
import {
    getTherapists,
    getTherapistDetails,
    getOwnTherapistProfile,
    saveTherapistOnboarding,
    createAppointmentController,
    validateRecurringSlotsController,
    getUserAppointmentsController,
    cancelAppointmentController,
    retryGoogleMeetController,
    getTherapistAssignedAppointmentsController,
    updateAppointmentStatusByTherapistController,
    cancelAppointmentByTherapistController,
    updateAppointmentClinicalNotesController,
    devSetUserRoleController,
    adminOnboardTherapistController,
    getTherapistSlotsController,
    getAppointmentMeetingLinkController,
    getTherapistTimeOffController,
    addTherapistTimeOffController,
    deleteTherapistTimeOffController,
    getTherapistWorkingHoursController,
    saveTherapistWorkingHoursController,
    completePatientTreatmentController,
    rescheduleAppointmentByTherapistController,
} from "../controller/therapist.controller";
import { verifyToken, requireRole } from "../middleware/auth";

const router = Router();

const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
        fn(req, res, next).catch(next);

// Public route: Get list of active therapists with search, filters & pagination
router.get("/therapists", asyncHandler(getTherapists));

// Protected route: Get logged-in therapist's own onboarding profile
router.get("/therapists/me/profile", verifyToken, asyncHandler(getOwnTherapistProfile));

// Developer testing route (unprotected for dev test): Save therapist onboarding details directly to database
router.post("/therapists/onboarding", asyncHandler(saveTherapistOnboarding));

// Developer testing route: Quickly update any user's role to 'therapist' or 'admin' for dev testing
router.post("/therapists/dev-set-role", asyncHandler(devSetUserRoleController));

// Protected Admin route: Onboard therapist directly (Verified by default, sets profiles.role = 'therapist')
router.post(
    "/therapists/admin-onboard",
    verifyToken,
    requireRole(["admin"]),
    asyncHandler(adminOnboardTherapistController)
);

// Public/Optional auth route: Fetch available and booked hourly slots for a therapist on a date
router.get("/therapists/:id/slots", asyncHandler(getTherapistSlotsController));

// Protected route: Validate recurring weekly slots for multi-session packages
router.post("/appointments/validate-recurring-slots", asyncHandler(validateRecurringSlotsController));

// Protected route: Fetch all appointments for the logged in user
router.get("/appointments/user", verifyToken, asyncHandler(getUserAppointmentsController));

// Protected route: Book an appointment (REQUIRES LOGIN TOKEN)
router.post("/appointments", verifyToken, asyncHandler(createAppointmentController));

// Protected route: Retrieve time-window validated meeting link
router.get("/appointments/:id/meeting-link", verifyToken, asyncHandler(getAppointmentMeetingLinkController));

// Protected route: Retry Google Meet creation for an appointment
router.post("/appointments/:id/retry-meet", verifyToken, asyncHandler(retryGoogleMeetController));

// Protected route: Cancel an appointment as patient (REQUIRES LOGIN TOKEN)
router.patch("/appointments/:id/cancel", verifyToken, asyncHandler(cancelAppointmentController));

// ─── Therapist Portal Routes (Protected: Role = therapist or admin) ─────────
router.get(
    "/therapist/appointments",
    verifyToken,
    requireRole(["therapist", "admin"]),
    asyncHandler(getTherapistAssignedAppointmentsController)
);

router.patch(
    "/therapist/appointments/:id/status",
    verifyToken,
    requireRole(["therapist", "admin"]),
    asyncHandler(updateAppointmentStatusByTherapistController)
);

router.patch(
    "/therapist/appointments/:id/cancel",
    verifyToken,
    requireRole(["therapist", "admin"]),
    asyncHandler(cancelAppointmentByTherapistController)
);

router.patch(
    "/therapist/appointments/:id/notes",
    verifyToken,
    requireRole(["therapist", "admin"]),
    asyncHandler(updateAppointmentClinicalNotesController)
);

router.patch(
    "/therapist/appointments/:id/reschedule",
    verifyToken,
    requireRole(["therapist", "admin"]),
    asyncHandler(rescheduleAppointmentByTherapistController)
);

router.patch(
    "/therapist/patients/:patientUserId/complete-treatment",
    verifyToken,
    requireRole(["therapist", "admin"]),
    asyncHandler(completePatientTreatmentController)
);

// Therapist Availability / Unavailability Management Routes
router.get(
    "/therapist/availability",
    verifyToken,
    requireRole(["therapist", "admin"]),
    asyncHandler(getTherapistTimeOffController)
);

router.post(
    "/therapist/availability",
    verifyToken,
    requireRole(["therapist", "admin"]),
    asyncHandler(addTherapistTimeOffController)
);

router.delete(
    "/therapist/availability/:id",
    verifyToken,
    requireRole(["therapist", "admin"]),
    asyncHandler(deleteTherapistTimeOffController)
);

// Therapist General Working Hours Routes
router.get(
    "/therapist/working-hours",
    verifyToken,
    requireRole(["therapist", "admin"]),
    asyncHandler(getTherapistWorkingHoursController)
);

router.post(
    "/therapist/working-hours",
    verifyToken,
    requireRole(["therapist", "admin"]),
    asyncHandler(saveTherapistWorkingHoursController)
);

// Public route: Get detailed profile, reviews & schedule of a specific therapist
router.get("/therapists/:id", asyncHandler(getTherapistDetails));

export default router;
