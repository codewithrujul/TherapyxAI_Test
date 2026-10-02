import { Request, Response } from "express";
import { sendEmail } from "../services/notificationService";

export async function sendTestEmailController(req: Request, res: Response): Promise<void> {
    try {
        const { to, subject, html } = req.body;

        const recipient = to || req.query.to;
        if (!recipient || typeof recipient !== "string") {
            res.status(400).json({
                error: {
                    code: "INVALID_RECIPIENT",
                    message: "Recipient email 'to' is required in body or query string (e.g., { \"to\": \"user@example.com\" })",
                },
            });
            return;
        }

        const emailSubject = subject || "TherapyxAI Test Notification Email";
        const emailHtml = html || `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #4f46e5;">TherapyxAI Email Notification Test</h2>
                <p>Hello,</p>
                <p>This is a test notification email sent via the TherapyxAI <strong>Gmail SMTP Notification Service</strong>.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 12px; color: #777;">Sent at: ${new Date().toISOString()}</p>
            </div>
        `;

        const result = await sendEmail({
            to: recipient,
            subject: emailSubject,
            html: emailHtml,
        });

        if (!result.success) {
            res.status(400).json({
                success: false,
                error: result.error,
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Test email dispatched successfully via Gmail SMTP",
            emailId: result.id,
        });
    } catch (error: any) {
        console.error("[NotificationController] sendTestEmailController error:", error.message);
        res.status(500).json({
            success: false,
            error: {
                code: "NOTIFICATION_TEST_FAILED",
                message: error.message,
            },
        });
    }
}
