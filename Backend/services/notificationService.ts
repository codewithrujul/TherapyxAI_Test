import nodemailer, { Transporter } from "nodemailer";
import { supabaseAdmin } from "../db/supabaseClient";

export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    from?: string;
}

export interface SendEmailResult {
    success: boolean;
    id?: string;
    error?: {
        code: string;
        message: string;
    };
}

export interface AppointmentNotificationData {
    userEmail: string;
    userName: string;
    therapistEmail: string;
    therapistName: string;
    appointmentNumber: string;
    startTime: string;
    endTime: string;
    sessionType: string;
    feeAmount: number;
}

/**
 * Formats an amount as Indian Rupees for HTML emails, e.g. 1500 -> "₹1,500".
 * The rupee sign is written as an HTML entity so every mail client renders it.
 */
function formatINRForEmail(amount: number): string {
    const n = Number(amount);
    const value = Number.isFinite(n) ? n : 0;
    const digits = value % 1 !== 0 ? 2 : 0;
    const formatted = value.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return `&#8377;${formatted}`;
}

/**
 * Creates and configures Nodemailer SMTP transport for Gmail.
 * Reads environment variables:
 *  - GMAIL_USER (e.g. gobeyondthelimits.ai@gmail.com)
 *  - GMAIL_APP_PASSWORD (Gmail App Password)
 */
function createGmailTransporter(): Transporter | null {
    const user = (process.env.GMAIL_USER || process.env.EMAIL_FROM || "").trim();
    // Google displays App Passwords formatted with spaces e.g. "abcd efgh ijkl mnop"
    // Strip spaces automatically so copy-pasting from Google works out of the box
    const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "").trim();

    if (!user || !pass) {
        console.warn("[NotificationService] Gmail SMTP configuration missing: GMAIL_USER or GMAIL_APP_PASSWORD not set.");
        return null;
    }

    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            user,
            pass,
        },
    });
}

/**
 * Reusable core email function for sending emails via Gmail SMTP.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const { to, subject, html, text, from } = options;

    if (!to || (Array.isArray(to) && to.length === 0)) {
        console.error("[NotificationService] Email sending failed: 'to' recipient address is required.");
        return {
            success: false,
            error: {
                code: "INVALID_RECIPIENT",
                message: "'to' recipient email address is required",
            },
        };
    }

    if (!subject || !subject.trim()) {
        console.error("[NotificationService] Email sending failed: 'subject' is required.");
        return {
            success: false,
            error: {
                code: "INVALID_SUBJECT",
                message: "'subject' is required",
            },
        };
    }

    if (!html || !html.trim()) {
        console.error("[NotificationService] Email sending failed: 'html' content is required.");
        return {
            success: false,
            error: {
                code: "INVALID_BODY",
                message: "'html' content is required",
            },
        };
    }

    const transporter = createGmailTransporter();
    if (!transporter) {
        const errorMsg = "GMAIL_USER or GMAIL_APP_PASSWORD is missing in environment variables.";
        console.error(`[NotificationService] ${errorMsg}`);
        return {
            success: false,
            error: {
                code: "MISSING_GMAIL_CONFIG",
                message: errorMsg,
            },
        };
    }

    const senderEmail = from || process.env.EMAIL_FROM || process.env.GMAIL_USER || "gobeyondthelimits.ai@gmail.com";

    try {
        const info = await transporter.sendMail({
            from: senderEmail,
            to: Array.isArray(to) ? to.join(", ") : to,
            subject: subject.trim(),
            html: html.trim(),
            text: text ? text.trim() : undefined,
        });

        console.log(`[NotificationService] Email sent successfully via Gmail SMTP. Message ID: ${info.messageId}`);
        return {
            success: true,
            id: info.messageId,
        };
    } catch (err: any) {
        const errorMessage = err?.message || "An unexpected error occurred while sending email via Gmail SMTP";
        console.error(`[NotificationService] Error sending email via Gmail SMTP: ${errorMessage}`);
        return {
            success: false,
            error: {
                code: "GMAIL_SMTP_ERROR",
                message: errorMessage,
            },
        };
    }
}

/**
 * Sends appointment confirmation email to the user / client.
 */
export async function sendAppointmentConfirmationToUser(data: AppointmentNotificationData): Promise<SendEmailResult> {
    try {
        const dateStr = new Date(data.startTime).toLocaleString("en-US", {
            timeZone: "Asia/Kolkata",
            dateStyle: "full",
            timeStyle: "short",
        });

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #4f46e5; text-align: center;">Appointment Request Received!</h2>
                <p>Hello <strong>${data.userName}</strong>,</p>
                <p>Your therapy session request with <strong>${data.therapistName}</strong> has been successfully created.</p>
                
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #4f46e5;">
                    <p style="margin: 5px 0;"><strong>Appointment Ref:</strong> ${data.appointmentNumber}</p>
                    <p style="margin: 5px 0;"><strong>Therapist:</strong> ${data.therapistName}</p>
                    <p style="margin: 5px 0;"><strong>Date & Time (IST):</strong> ${dateStr}</p>
                    <p style="margin: 5px 0;"><strong>Duration:</strong> 1 hour (60 minutes)</p>
                    <p style="margin: 5px 0;"><strong>Session Format:</strong> <span style="text-transform: capitalize;">${data.sessionType}</span></p>
                    <p style="margin: 5px 0;"><strong>Fee:</strong> ${formatINRForEmail(data.feeAmount)}</p>
                </div>

                <p>Your appointment slot is reserved while awaiting therapist confirmation.</p>
                <p>Warm regards,<br/><strong>TherapyXAI Team</strong></p>
            </div>
        `;

        return await sendEmail({
            to: data.userEmail,
            subject: `Appointment Confirmation - ${data.appointmentNumber}`,
            html,
        });
    } catch (err: any) {
        console.error(`[NotificationService] Failed in sendAppointmentConfirmationToUser: ${err.message}`);
        return {
            success: false,
            error: { code: "USER_NOTIFICATION_FAILED", message: err.message },
        };
    }
}

/**
 * Sends therapist confirmation email to patient when therapist approves booking request.
 */
export async function sendTherapistConfirmedEmailToPatient(data: AppointmentNotificationData & { googleMeetUrl?: string }): Promise<SendEmailResult> {
    try {
        const dateStr = new Date(data.startTime).toLocaleString("en-US", {
            timeZone: "Asia/Kolkata",
            dateStyle: "full",
            timeStyle: "short",
        });

        const meetUrl = data.googleMeetUrl || "";

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #059669; text-align: center;">Therapist Appointment Confirmed — TherapyXAI</h2>
                <p>Hello <strong>${data.userName}</strong>,</p>
                <p>Great news! Your therapist <strong>${data.therapistName}</strong> has confirmed your appointment.</p>
                
                <div style="background-color: #f0fdf4; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #059669;">
                    <p style="margin: 5px 0;"><strong>Appointment Ref:</strong> ${data.appointmentNumber}</p>
                    <p style="margin: 5px 0;"><strong>Therapist:</strong> ${data.therapistName}</p>
                    <p style="margin: 5px 0;"><strong>Date & Time (IST):</strong> ${dateStr}</p>
                    <p style="margin: 5px 0;"><strong>Duration:</strong> 1 hour (60 minutes)</p>
                    <p style="margin: 5px 0;"><strong>Session Format:</strong> <span style="text-transform: capitalize;">${data.sessionType}</span></p>
                    <p style="margin: 5px 0;"><strong>Fee:</strong> ${formatINRForEmail(data.feeAmount)}</p>
                    ${meetUrl ? `<p style="margin: 10px 0 0 0;"><strong>Google Meet Link:</strong> <a href="${meetUrl}" style="color: #059669; font-weight: bold;">${meetUrl}</a></p>` : ''}
                </div>

                <p>Please log in to your patient portal when it is time for your consultation. The Join Meeting button will be active during your session window.</p>
                <p>Warm regards,<br/><strong>TherapyXAI Team</strong></p>
            </div>
        `;

        return await sendEmail({
            to: data.userEmail,
            subject: `Therapist Appointment Confirmed — TherapyXAI`,
            html,
        });
    } catch (err: any) {
        console.error(`[NotificationService] Failed in sendTherapistConfirmedEmailToPatient: ${err.message}`);
        return {
            success: false,
            error: { code: "THERAPIST_CONFIRMATION_EMAIL_FAILED", message: err.message },
        };
    }
}

/**
 * Sends new appointment notification email to the therapist.
 */
export async function sendNewAppointmentNotificationToTherapist(data: AppointmentNotificationData): Promise<SendEmailResult> {
    try {
        const dateStr = new Date(data.startTime).toLocaleString("en-US", {
            dateStyle: "full",
            timeStyle: "short",
        });

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #059669; text-align: center;">New Client Appointment Booking</h2>
                <p>Hello <strong>${data.therapistName}</strong>,</p>
                <p>You have a new client consultation booking from <strong>${data.userName}</strong>.</p>
                
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #059669;">
                    <p style="margin: 5px 0;"><strong>Appointment Ref:</strong> ${data.appointmentNumber}</p>
                    <p style="margin: 5px 0;"><strong>Client Name:</strong> ${data.userName}</p>
                    <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${dateStr}</p>
                    <p style="margin: 5px 0;"><strong>Session Format:</strong> <span style="text-transform: capitalize;">${data.sessionType}</span></p>
                    <p style="margin: 5px 0;"><strong>Fee:</strong> ${formatINRForEmail(data.feeAmount)}</p>
                </div>

                <p>Please log in to your therapist portal to view your upcoming schedule.</p>
                <p>Warm regards,<br/><strong>TherapyxAI Team</strong></p>
            </div>
        `;

        return await sendEmail({
            to: data.therapistEmail,
            subject: `New Booking Request - ${data.appointmentNumber}`,
            html,
        });
    } catch (err: any) {
        console.error(`[NotificationService] Failed in sendNewAppointmentNotificationToTherapist: ${err.message}`);
        return {
            success: false,
            error: { code: "THERAPIST_NOTIFICATION_FAILED", message: err.message },
        };
    }
}

export interface AppointmentCancellationData {
    userEmail: string;
    userName: string;
    therapistEmail: string;
    therapistName: string;
    appointmentNumber: string;
    startTime: string;
    endTime: string;
    reason?: string;
}

/**
 * Sends cancellation email to therapist when a user cancels an appointment.
 */
export async function sendAppointmentCancellationToTherapist(data: AppointmentCancellationData): Promise<SendEmailResult> {
    try {
        const dateStr = new Date(data.startTime).toLocaleString("en-US", {
            timeZone: "Asia/Kolkata",
            dateStyle: "full",
            timeStyle: "short",
        });

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #dc2626; text-align: center;">Appointment Cancelled by Client</h2>
                <p>Hello <strong>${data.therapistName}</strong>,</p>
                <p>Your client <strong>${data.userName}</strong> has cancelled their scheduled therapy appointment.</p>
                
                <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc2626;">
                    <p style="margin: 5px 0;"><strong>Appointment Ref:</strong> ${data.appointmentNumber}</p>
                    <p style="margin: 5px 0;"><strong>Client Name:</strong> ${data.userName}</p>
                    <p style="margin: 5px 0;"><strong>Therapist Name:</strong> ${data.therapistName}</p>
                    <p style="margin: 5px 0;"><strong>Date & Time (IST):</strong> ${dateStr}</p>
                </div>

                <p>This slot has now been released back to your available schedule.</p>
                <p>Warm regards,<br/><strong>TherapyXAI Team</strong></p>
            </div>
        `;

        return await sendEmail({
            to: data.therapistEmail,
            subject: `Appointment Cancelled by Client - ${data.appointmentNumber}`,
            html,
        });
    } catch (err: any) {
        console.error(`[NotificationService] Failed in sendAppointmentCancellationToTherapist: ${err.message}`);
        return {
            success: false,
            error: { code: "THERAPIST_CANCELLATION_NOTIFICATION_FAILED", message: err.message },
        };
    }
}

/**
 * Sends cancellation email to user when a therapist cancels an appointment.
 */
export async function sendAppointmentCancellationToUser(data: AppointmentCancellationData): Promise<SendEmailResult> {
    try {
        const dateStr = new Date(data.startTime).toLocaleString("en-US", {
            timeZone: "Asia/Kolkata",
            dateStyle: "full",
            timeStyle: "short",
        });

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #dc2626; text-align: center;">Appointment Cancelled by Therapist</h2>
                <p>Hello <strong>${data.userName}</strong>,</p>
                <p>We regret to inform you that your therapy session with <strong>${data.therapistName}</strong> has been cancelled by the therapist.</p>
                
                <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc2626;">
                    <p style="margin: 5px 0;"><strong>Appointment Ref:</strong> ${data.appointmentNumber}</p>
                    <p style="margin: 5px 0;"><strong>Therapist Name:</strong> ${data.therapistName}</p>
                    <p style="margin: 5px 0;"><strong>Date & Time (IST):</strong> ${dateStr}</p>
                    ${data.reason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${data.reason}</p>` : ''}
                </div>

                <p>You can log in to your patient portal to select another available slot or therapist at your convenience.</p>
                <p>Warm regards,<br/><strong>TherapyXAI Team</strong></p>
            </div>
        `;

        return await sendEmail({
            to: data.userEmail,
            subject: `Appointment Cancelled by Therapist - ${data.appointmentNumber}`,
            html,
        });
    } catch (err: any) {
        console.error(`[NotificationService] Failed in sendAppointmentCancellationToUser: ${err.message}`);
        return {
            success: false,
            error: { code: "USER_CANCELLATION_NOTIFICATION_FAILED", message: err.message },
        };
    }
}

/**
 * Sends 15-minute appointment reminder email to BOTH user and therapist, including Google Meet link.
 */
export async function send15MinReminderEmail(data: AppointmentNotificationData & { googleMeetUrl?: string }): Promise<SendEmailResult[]> {
    try {
        const dateStr = new Date(data.startTime).toLocaleString("en-US", {
            timeZone: "Asia/Kolkata",
            dateStyle: "full",
            timeStyle: "short",
        });

        const meetUrl = data.googleMeetUrl || "";

        // Email HTML for User
        const userHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #2563eb; text-align: center;">Reminder: Upcoming Session in 15 Minutes!</h2>
                <p>Hello <strong>${data.userName}</strong>,</p>
                <p>This is a reminder that your therapy session with <strong>${data.therapistName}</strong> starts in 15 minutes.</p>
                
                <div style="background-color: #eff6ff; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;">
                    <p style="margin: 5px 0;"><strong>Appointment Ref:</strong> ${data.appointmentNumber}</p>
                    <p style="margin: 5px 0;"><strong>Therapist:</strong> ${data.therapistName}</p>
                    <p style="margin: 5px 0;"><strong>Start Time (IST):</strong> ${dateStr}</p>
                    ${meetUrl ? `<p style="margin: 10px 0 0 0;"><strong>Google Meet Link:</strong> <a href="${meetUrl}" style="color: #2563eb; font-weight: bold;">${meetUrl}</a></p>` : ''}
                </div>

                <p>The Join Meeting button is now enabled in your patient portal.</p>
                <p>Warm regards,<br/><strong>TherapyXAI Team</strong></p>
            </div>
        `;

        // Email HTML for Therapist
        const therapistHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #2563eb; text-align: center;">Reminder: Client Session in 15 Minutes!</h2>
                <p>Hello <strong>${data.therapistName}</strong>,</p>
                <p>This is a reminder that your therapy session with client <strong>${data.userName}</strong> starts in 15 minutes.</p>
                
                <div style="background-color: #eff6ff; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;">
                    <p style="margin: 5px 0;"><strong>Appointment Ref:</strong> ${data.appointmentNumber}</p>
                    <p style="margin: 5px 0;"><strong>Client Name:</strong> ${data.userName}</p>
                    <p style="margin: 5px 0;"><strong>Start Time (IST):</strong> ${dateStr}</p>
                    ${meetUrl ? `<p style="margin: 10px 0 0 0;"><strong>Google Meet Link:</strong> <a href="${meetUrl}" style="color: #2563eb; font-weight: bold;">${meetUrl}</a></p>` : ''}
                </div>

                <p>Please log in to your therapist practice portal to launch the Google Meet consultation.</p>
                <p>Warm regards,<br/><strong>TherapyXAI Team</strong></p>
            </div>
        `;

        const userPromise = sendEmail({
            to: data.userEmail,
            subject: `Reminder: Therapy Session in 15 Minutes - ${data.appointmentNumber}`,
            html: userHtml,
        });

        const therapistPromise = sendEmail({
            to: data.therapistEmail,
            subject: `Reminder: Client Session in 15 Minutes - ${data.appointmentNumber}`,
            html: therapistHtml,
        });

        return await Promise.all([userPromise, therapistPromise]);
    } catch (err: any) {
        console.error(`[NotificationService] Failed in send15MinReminderEmail: ${err.message}`);
        return [{
            success: false,
            error: { code: "REMINDER_NOTIFICATION_FAILED", message: err.message },
        }];
    }
}


/**
 * Creates an in-app notification record in public.notifications.
 */
export async function createInAppNotification(params: {
    userId?: string | null;
    targetRole?: "admin" | "therapist" | "patient" | "user" | "all";
    title: string;
    message: string;
    type?: string;
    link?: string;
    metadata?: Record<string, any>;
}) {
    try {
        const payload = {
            user_id: params.userId || null,
            target_role: params.targetRole || "user",
            title: params.title,
            message: params.message,
            type: params.type || "info",
            link: params.link || null,
            metadata: params.metadata || {},
            is_read: false,
            created_at: new Date().toISOString(),
        };

        const { data, error } = await supabaseAdmin
            .from("notifications")
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.warn("[NotificationService] In-app notification creation warning:", error.message);
            return null;
        }

        return data;
    } catch (err: any) {
        console.error("[NotificationService] Failed to create in-app notification:", err?.message || err);
        return null;
    }
}

/**
 * Fetches in-app notifications for a user/admin.
 */
export async function getUserInAppNotifications(userId: string, role?: string) {
    let query = supabaseAdmin
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

    if (role === "admin") {
        query = query.or(`user_id.eq.${userId},target_role.eq.admin,target_role.eq.all`);
    } else {
        query = query.or(`user_id.eq.${userId},target_role.eq.all`);
    }

    const { data, error } = await query;
    if (error) {
        console.error("[NotificationService] Failed to fetch notifications:", error.message);
        throw new Error("Failed to fetch notifications");
    }

    return data ?? [];
}

/**
 * Notifies admins about a new therapist onboarding request via email & in-app notification.
 */
export async function sendNewOnboardingRequestNotificationToAdmin(data: {
    userName: string;
    userEmail: string;
    requestedAt?: string;
}): Promise<SendEmailResult> {
    const adminEmail = process.env.GMAIL_USER || process.env.EMAIL_FROM || "gobeyondthelimits.ai@gmail.com";
    const dateStr = data.requestedAt ? new Date(data.requestedAt).toLocaleString() : new Date().toLocaleString();

    // 1. Create in-app notification for admins
    await createInAppNotification({
        targetRole: "admin",
        title: "New Therapist Onboarding Request",
        message: `A new therapist onboarding request has been submitted by ${data.userName} (${data.userEmail}).`,
        type: "onboarding_request",
        link: "/admin-dashboard",
    });

    // 2. Send email to Admin
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #7c3aed; text-align: center;">New Therapist Onboarding Request</h2>
            <p>Hello Administrator,</p>
            <p>A new therapist onboarding request has been submitted on TherapyXAI.</p>
            
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #7c3aed;">
                <p style="margin: 5px 0;"><strong>Applicant Name:</strong> ${data.userName}</p>
                <p style="margin: 5px 0;"><strong>Applicant Email:</strong> ${data.userEmail}</p>
                <p style="margin: 5px 0;"><strong>Request Date:</strong> ${dateStr}</p>
                <p style="margin: 5px 0;"><strong>Current Status:</strong> <span style="color: #d97706; font-weight: bold;">Pending Review</span></p>
            </div>

            <p>Please log in to the <strong>Admin Dashboard</strong> to review and initiate the onboarding process.</p>
            <p>Warm regards,<br/><strong>TherapyXAI Platform</strong></p>
        </div>
    `;

    return await sendEmail({
        to: adminEmail,
        subject: `New Therapist Onboarding Request - ${data.userName}`,
        html,
    });
}

/**
 * Notifies user when they submit their therapist onboarding request.
 */
export async function sendOnboardingSubmissionEmailToUser(data: {
    userId: string;
    userName: string;
    userEmail: string;
}): Promise<SendEmailResult> {
    // 1. In-app notification
    await createInAppNotification({
        userId: data.userId,
        title: "Therapist Onboarding Request Submitted",
        message: "Your request to onboard as a therapist has been sent to the admin. You will be notified when the admin approves your request.",
        type: "onboarding_submitted",
    });

    // 2. Email notification
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #7c3aed; text-align: center;">Therapist Onboarding Request Submitted</h2>
            <p>Hello <strong>${data.userName}</strong>,</p>
            <p>Your request to onboard as a therapist has been sent to the admin. You will be notified when the admin approves your request.</p>
            
            <div style="background-color: #f3e8ff; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #7c3aed;">
                <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #7c3aed; font-weight: bold;">Pending Admin Review</span></p>
                <p style="margin: 5px 0;">Our administrative team is reviewing your professional qualifications. Once verified, your role will be upgraded to Therapist.</p>
            </div>

            <p>Warm regards,<br/><strong>TherapyXAI Team</strong></p>
        </div>
    `;

    return await sendEmail({
        to: data.userEmail,
        subject: "Therapist Onboarding Request Submitted",
        html,
    });
}

/**
 * Notifies user when admin accepts their request and opens onboarding form.
 */
export async function sendOnboardingInitiatedNotificationToUser(data: {
    userId: string;
    userName: string;
    userEmail: string;
}): Promise<SendEmailResult> {
    // 1. In-app notification
    await createInAppNotification({
        userId: data.userId,
        title: "Therapist Onboarding Initiated",
        message: "Your therapist onboarding request has been accepted. Please complete your professional profile information.",
        type: "onboarding_initiated",
    });

    // 2. Email notification
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #2563eb; text-align: center;">Therapist Onboarding Accepted!</h2>
            <p>Hello <strong>${data.userName}</strong>,</p>
            <p>Great news! Your request for therapist onboarding on <strong>TherapyXAI</strong> has been reviewed and accepted by our administrator team.</p>
            
            <div style="background-color: #eff6ff; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;">
                <p style="margin: 5px 0;"><strong>Next Step:</strong> Please log in to your account and click <strong>"Complete Therapist Onboarding"</strong> to fill out your professional credentials and schedule preferences.</p>
            </div>

            <p>Once submitted, your account will be verified and converted into a Practitioner account.</p>
            <p>Warm regards,<br/><strong>TherapyXAI Team</strong></p>
        </div>
    `;

    return await sendEmail({
        to: data.userEmail,
        subject: "Therapist Onboarding Accepted - Action Required",
        html,
    });
}

/**
 * Sends Welcome email & in-app notification after successful onboarding & role conversion to therapist.
 */
export async function sendTherapistWelcomeEmail(data: {
    userId: string;
    userName: string;
    userEmail: string;
}): Promise<SendEmailResult> {
    // 1. In-app notification
    await createInAppNotification({
        userId: data.userId,
        targetRole: "therapist",
        title: "Welcome to TherapyXAI!",
        message: "Your therapist onboarding has been successfully completed. Your account is now registered as a verified therapist.",
        type: "onboarding_approved",
    });

    // 2. Email notification
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #059669; text-align: center;">Welcome to TherapyXAI — Therapist Onboarding Complete</h2>
            <p>Hello <strong>${data.userName}</strong>,</p>
            <p>Congratulations! Your therapist onboarding form has been processed and verified successfully.</p>
            
            <div style="background-color: #ecfdf5; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #059669;">
                <p style="margin: 5px 0;"><strong>Account Status:</strong> <span style="color: #059669; font-weight: bold;">Verified Therapist</span></p>
                <p style="margin: 5px 0;"><strong>Available Features:</strong> You can now access your Therapist Practice Portal, manage client appointment requests, set your availability schedule, and conduct Google Meet video consultations.</p>
            </div>

            <p>Log in to your account anytime to view your Therapist Practice Portal dashboard.</p>
            <p>Warm regards,<br/><strong>TherapyXAI Team</strong></p>
        </div>
    `;

    return await sendEmail({
        to: data.userEmail,
        subject: "Welcome to TherapyXAI — Therapist Onboarding Complete",
        html,
    });
}

/**
 * Notifies user if therapist onboarding request was rejected by admin.
 */
export async function sendOnboardingRejectionNotificationToUser(data: {
    userId: string;
    userName: string;
    userEmail: string;
    reason?: string;
}): Promise<SendEmailResult> {
    const reasonText = data.reason ? `Reason: ${data.reason}` : "Please contact support for further details.";

    // 1. In-app notification
    await createInAppNotification({
        userId: data.userId,
        title: "Therapist Onboarding Update",
        message: `Your therapist onboarding request was not approved at this time. ${reasonText}`,
        type: "onboarding_rejected",
    });

    // 2. Email notification
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #dc2626; text-align: center;">Therapist Onboarding Request Update</h2>
            <p>Hello <strong>${data.userName}</strong>,</p>
            <p>Your therapist onboarding request has been reviewed by the administrator and was not approved at this time.</p>
            
            ${data.reason ? `
            <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc2626;">
                <p style="margin: 5px 0;"><strong>Feedback / Reason:</strong> ${data.reason}</p>
            </div>
            ` : ""}

            <p>If you have any questions or would like to provide updated credentials, please feel free to reach out to platform support.</p>
            <p>Warm regards,<br/><strong>TherapyXAI Team</strong></p>
        </div>
    `;

    return await sendEmail({
        to: data.userEmail,
        subject: "Practitioner Onboarding Request Update",
        html,
    });
}

/**
 * Sends notification to patient when their pending booking request expires without practitioner confirmation.
 */
export async function sendBookingExpiredEmailToPatient(data: AppointmentNotificationData): Promise<SendEmailResult> {
    try {
        const dateStr = new Date(data.startTime).toLocaleString("en-US", {
            timeZone: "Asia/Kolkata",
            dateStyle: "full",
            timeStyle: "short",
        });

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #dc2626; text-align: center;">Booking Request Expired</h2>
                <p>Hello <strong>${data.userName}</strong>,</p>
                <p>Your pending appointment request with <strong>${data.therapistName}</strong> has expired because it was not confirmed before the scheduled start time.</p>
                
                <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc2626;">
                    <p style="margin: 5px 0;"><strong>Appointment Ref:</strong> ${data.appointmentNumber}</p>
                    <p style="margin: 5px 0;"><strong>Practitioner:</strong> ${data.therapistName}</p>
                    <p style="margin: 5px 0;"><strong>Date & Time (IST):</strong> ${dateStr}</p>
                </div>

                <p>You can log in to your patient portal to select a new available time slot with your practitioner.</p>
                <p>Warm regards,<br/><strong>TherapyXAI Team</strong></p>
            </div>
        `;

        return await sendEmail({
            to: data.userEmail,
            subject: `Booking Request Expired - ${data.appointmentNumber}`,
            html,
        });
    } catch (err: any) {
        console.error(`[NotificationService] Failed in sendBookingExpiredEmailToPatient: ${err.message}`);
        return { success: false, error: { code: "EXPIRED_EMAIL_FAILED", message: err.message } };
    }
}

/**
 * Sends a reminder email to practitioner regarding unconfirmed pending booking requests.
 */
export async function sendPendingRequestReminderToPractitioner(data: AppointmentNotificationData): Promise<SendEmailResult> {
    try {
        const dateStr = new Date(data.startTime).toLocaleString("en-US", {
            timeZone: "Asia/Kolkata",
            dateStyle: "full",
            timeStyle: "short",
        });

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #d97706; text-align: center;">Pending Booking Request Awaiting Action</h2>
                <p>Hello <strong>${data.therapistName}</strong>,</p>
                <p>You have a pending booking request from <strong>${data.userName}</strong> that requires your confirmation or decision.</p>
                
                <div style="background-color: #fffbeb; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #d97706;">
                    <p style="margin: 5px 0;"><strong>Appointment Ref:</strong> ${data.appointmentNumber}</p>
                    <p style="margin: 5px 0;"><strong>Client Name:</strong> ${data.userName}</p>
                    <p style="margin: 5px 0;"><strong>Requested Date & Time (IST):</strong> ${dateStr}</p>
                </div>

                <p>Please log in to your Practitioner Portal to confirm or decline this session request.</p>
                <p>Warm regards,<br/><strong>TherapyXAI Team</strong></p>
            </div>
        `;

        return await sendEmail({
            to: data.therapistEmail,
            subject: `Action Required: Pending Request - ${data.appointmentNumber}`,
            html,
        });
    } catch (err: any) {
        console.error(`[NotificationService] Failed in sendPendingRequestReminderToPractitioner: ${err.message}`);
        return { success: false, error: { code: "PENDING_REMINDER_FAILED", message: err.message } };
    }
}

/**
 * Sends appointment reschedule notification email to patient.
 */
export async function sendRescheduleEmailToPatient(data: AppointmentNotificationData & { googleMeetUrl?: string }): Promise<SendEmailResult> {
    try {
        const dateStr = new Date(data.startTime).toLocaleString("en-US", {
            timeZone: "Asia/Kolkata",
            dateStyle: "full",
            timeStyle: "short",
        });
        const meetUrl = data.googleMeetUrl || "";

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #2563eb; text-align: center;">Appointment Rescheduled</h2>
                <p>Hello <strong>${data.userName}</strong>,</p>
                <p>Your appointment with <strong>${data.therapistName}</strong> has been rescheduled to a new time.</p>
                
                <div style="background-color: #eff6ff; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;">
                    <p style="margin: 5px 0;"><strong>Appointment Ref:</strong> ${data.appointmentNumber}</p>
                    <p style="margin: 5px 0;"><strong>Practitioner:</strong> ${data.therapistName}</p>
                    <p style="margin: 5px 0;"><strong>New Start Time (IST):</strong> ${dateStr}</p>
                    ${meetUrl ? `<p style="margin: 10px 0 0 0;"><strong>Google Meet Link:</strong> <a href="${meetUrl}" style="color: #2563eb; font-weight: bold;">${meetUrl}</a></p>` : ''}
                </div>

                <p>You can view your updated schedule anytime in your portal.</p>
                <p>Warm regards,<br/><strong>TherapyXAI Team</strong></p>
            </div>
        `;

        return await sendEmail({
            to: data.userEmail,
            subject: `Appointment Rescheduled - ${data.appointmentNumber}`,
            html,
        });
    } catch (err: any) {
        console.error(`[NotificationService] Failed in sendRescheduleEmailToPatient: ${err.message}`);
        return { success: false, error: { code: "RESCHEDULE_EMAIL_FAILED", message: err.message } };
    }
}

/**
 * Sends appointment reschedule notification email to practitioner.
 */
export async function sendRescheduleEmailToPractitioner(data: AppointmentNotificationData & { googleMeetUrl?: string }): Promise<SendEmailResult> {
    try {
        const dateStr = new Date(data.startTime).toLocaleString("en-US", {
            timeZone: "Asia/Kolkata",
            dateStyle: "full",
            timeStyle: "short",
        });
        const meetUrl = data.googleMeetUrl || "";

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #2563eb; text-align: center;">Appointment Rescheduled</h2>
                <p>Hello <strong>${data.therapistName}</strong>,</p>
                <p>The appointment with client <strong>${data.userName}</strong> has been successfully rescheduled.</p>
                
                <div style="background-color: #eff6ff; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;">
                    <p style="margin: 5px 0;"><strong>Appointment Ref:</strong> ${data.appointmentNumber}</p>
                    <p style="margin: 5px 0;"><strong>Client Name:</strong> ${data.userName}</p>
                    <p style="margin: 5px 0;"><strong>New Start Time (IST):</strong> ${dateStr}</p>
                    ${meetUrl ? `<p style="margin: 10px 0 0 0;"><strong>Google Meet Link:</strong> <a href="${meetUrl}" style="color: #2563eb; font-weight: bold;">${meetUrl}</a></p>` : ''}
                </div>

                <p>Log in to your Practitioner Portal to view your updated appointment schedule.</p>
                <p>Warm regards,<br/><strong>TherapyXAI Team</strong></p>
            </div>
        `;

        return await sendEmail({
            to: data.therapistEmail,
            subject: `Appointment Rescheduled - ${data.appointmentNumber}`,
            html,
        });
    } catch (err: any) {
        console.error(`[NotificationService] Failed in sendRescheduleEmailToPractitioner: ${err.message}`);
        return { success: false, error: { code: "RESCHEDULE_EMAIL_FAILED", message: err.message } };
    }
}

