import { Request, Response } from "express";
import { getGuestOffer, declineGuestReflections, isValidGuestId } from "../services/guestReflections";

// ─── GET /api/guest/reflection-offer?guest_id=<uuid> ──────────────────────────
// Tells the app whether to show the "sign in to get your reflections" offer to this guest.
// Returns only booleans/minutes -- no session data, no text.
export async function reflectionOffer(req: Request, res: Response): Promise<void> {
    const guestId = req.query.guest_id;
    if (!isValidGuestId(guestId)) { res.status(400).json({ error: "valid guest_id is required" }); return; }
    try {
        res.setHeader("Cache-Control", "no-store");
        res.status(200).json(await getGuestOffer(guestId));
    } catch (err) {
        console.error(`[GuestCtrl] reflectionOffer error  err=${(err as Error).message}`);
        res.status(200).json({ available: false, expiresInMin: null });   // fail quiet: no offer
    }
}

// ─── POST /api/guest/reflection-decline  { guest_id } ─────────────────────────
// "No thanks": discards everything held or stored for this guest's sessions.
export async function reflectionDecline(req: Request, res: Response): Promise<void> {
    const guestId = (req.body as { guest_id?: unknown })?.guest_id;
    if (!isValidGuestId(guestId)) { res.status(400).json({ error: "valid guest_id is required" }); return; }
    try {
        const out = await declineGuestReflections(guestId);
        res.status(200).json({ status: "discarded", ...out });
    } catch (err) {
        console.error(`[GuestCtrl] reflectionDecline error  err=${(err as Error).message}`);
        res.status(500).json({ error: "Could not discard" });
    }
}
