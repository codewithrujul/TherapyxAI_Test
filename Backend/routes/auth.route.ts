import { Router, Request, Response, NextFunction } from "express";
import { register, login, logout, googleLogin, linkGuest } from "../controller/auth.controller";
import {
  redirectToGoogle,
  handleGoogleCallback,
  handleGoogleMeetAuthorize,
  handleGoogleMeetCallback,
} from "../controller/googleOAuth.controller";
import { verifyToken } from "../middleware/auth";

const router = Router();

// ─── Async error wrapper ──────────────────────────────────────────────────────
// Catches any unhandled promise rejections in async controllers and forwards
// them to Express's global error handler instead of crashing the process.
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Body: { email: string, password: string, name?: string }
 * Response: { message, data: { accessToken, refreshToken, expiresAt, user, session } }
 */
router.post("/register", asyncHandler(register));

/**
 * POST /api/auth/login
 * Body: { email: string, password: string }
 * Response: { message, data: { accessToken, refreshToken, expiresAt, user, session } }
 */
router.post("/login", asyncHandler(login));

/**
 * POST /api/auth/logout
 * Header: Authorization: Bearer <access_token>
 * Response: { message }
 */
router.post("/logout", verifyToken, asyncHandler(logout));

/**
 * POST /api/auth/google-login
 * Header: Authorization: Bearer <supabase_access_token>
 * Called after Google OAuth redirect — initialises credits for new users.
 */
router.post("/google-login", asyncHandler(googleLogin));

/**
 * GET /api/auth/google
 * Redirects the browser to Google's OAuth consent screen.
 * Use this URL as the href when you want to use the custom backend OAuth flow
 * (instead of supabase.auth.signInWithOAuth).
 * Requires: GOOGLE_CLIENT_ID + GOOGLE_REDIRECT_URI env vars.
 */
router.get("/google", redirectToGoogle);

/**
 * GET /api/auth/google/callback
 * Receives the auth code from Google after the user approves.
 * Exchanges the code, creates/upserts the Supabase user, then redirects the
 * browser via Supabase magic link so the frontend gets a real JWT session.
 * Requires: GOOGLE_CLIENT_SECRET + GOOGLE_REDIRECT_URI + FRONTEND_URL env vars.
 */
router.get("/google/callback", asyncHandler(handleGoogleCallback));

/**
 * GET /api/auth/google/meet-authorize
 * Initiates TherapyXAI Google Account OAuth consent for Google Meet REST API.
 */
router.get("/google/meet-authorize", handleGoogleMeetAuthorize);

/**
 * GET /api/auth/google/meet-callback
 * Receives authorization code and displays GOOGLE_REFRESH_TOKEN directly in browser.
 */
router.get("/google/meet-callback", asyncHandler(handleGoogleMeetCallback));

/**
 * POST /api/auth/link-guest
 * Header: Authorization: Bearer <token>
 * Body: { guest_id: string }
 * Links all guest sessions to the newly signed-up user account.
 */
router.post("/link-guest", asyncHandler(linkGuest));

export default router;