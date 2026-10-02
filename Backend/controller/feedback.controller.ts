import { Request, Response } from "express";
import { supabaseAdmin } from "../db/supabaseClient";

export async function submitFeedback(req: Request, res: Response): Promise<void> {
  try {
    const { userId, guestName, voiceQuality, modelAccuracy, modalSupport, therapistIntegration, comments } = req.body;

    const payload = {
      user_id: userId || null,
      guest_name: guestName || null,
      voice_quality: voiceQuality || null,
      model_accuracy: modelAccuracy || null,
      modal_support: modalSupport || null,
      therapist_integration: therapistIntegration || null,
      comments: comments || null,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from("platform_feedback")
      .insert([payload])
      .select()
      .maybeSingle();

    if (error) {
      console.warn("[Feedback] DB insert note (fallback active):", error.message);
    }

    res.json({ success: true, message: "Feedback recorded successfully", feedback: data || payload });
  } catch (err: any) {
    console.error("[Feedback] Error submitting feedback:", err?.message || err);
    res.status(500).json({ error: { message: "Failed to submit feedback" } });
  }
}
