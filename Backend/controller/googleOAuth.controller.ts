import { Request, Response } from "express";
import { supabaseAdmin } from "../db/supabaseClient";
import { initUserCredits } from "../db/dbService";

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const GOOGLE_REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI  ?? "";
const FRONTEND_URL         = process.env.FRONTEND_URL         ?? "http://localhost:5173";

// ─── Step 1 ───────────────────────────────────────────────────────────────────
// Redirect the browser to Google's OAuth consent screen.
// Called by: GET /api/auth/google
// ─────────────────────────────────────────────────────────────────────────────

export function redirectToGoogle(req: Request, res: Response): void {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
    res.status(500).send("Google OAuth is not configured on this server.");
    return;
  }

  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope:         "openid email profile",
    access_type:   "offline",
    prompt:        "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────
// Receive the auth code from Google, exchange it for the user's email + name,
// create a Supabase user if they're new, then redirect via magic link so the
// browser lands on the frontend with a real Supabase JWT session.
// Called by: GET /api/auth/google/callback
// ─────────────────────────────────────────────────────────────────────────────

export async function handleGoogleCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error: oauthError } = req.query as { code?: string; state?: string; error?: string };

  // Handle Google Meet token helper delegate request
  if (state === "meet_authorize") {
    return handleGoogleMeetCallback(req, res);
  }

  if (oauthError || !code) {
    res.redirect(`${FRONTEND_URL}?auth_error=google_denied`);
    return;
  }

  try {
    // ── Exchange code → Google access token ──────────────────────────────────
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri:  GOOGLE_REDIRECT_URI,
        grant_type:    "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      throw new Error(`Google token exchange failed: ${tokenData.error ?? "no access_token"}`);
    }

    // ── Get user info from Google ─────────────────────────────────────────────
    const userRes  = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json() as { email?: string; name?: string; id?: string };

    if (!googleUser.email) {
      throw new Error("Google did not return an email address");
    }

    // ── Create Supabase user if new ───────────────────────────────────────────
    // createUser returns an error if the email already exists — that's fine,
    // it means the user already has an account; we just proceed to the magic link.
    const { data: newUserData } = await supabaseAdmin.auth.admin.createUser({
      email:         googleUser.email,
      email_confirm: true,                         // no email verification needed
      user_metadata: { name: googleUser.name ?? googleUser.email.split("@")[0] },
      app_metadata:  { provider: "google", google_id: googleUser.id },
    });

    if (newUserData?.user) {
      // Brand new account — initialise 30 free minutes
      await initUserCredits(newUserData.user.id);
      console.log(`[GoogleOAuth] New user created  userId=${newUserData.user.id}  email=${googleUser.email}`);
    }

    // ── Generate magic link → creates real Supabase JWT session ──────────────
    // Supabase processes this link and redirects to FRONTEND_URL with
    // #access_token=...&refresh_token=... in the hash.
    // The Supabase JS client (detectSessionInUrl: true) picks it up automatically
    // and fires onAuthStateChange("SIGNED_IN", session).
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type:    "magiclink",
      email:   googleUser.email,
      options: { redirectTo: FRONTEND_URL },
    });

    if (linkError || !linkData?.properties?.action_link) {
      throw new Error(linkError?.message ?? "Failed to generate session link");
    }

    console.log(`[GoogleOAuth] Redirecting user to session  email=${googleUser.email}`);
    res.redirect(linkData.properties.action_link);

  } catch (err) {
    console.error("[GoogleOAuth] Callback error:", (err as Error).message);
    res.redirect(`${FRONTEND_URL}?auth_error=google_failed`);
  }
}

// ─── Step 3: Google Meet Server OAuth Helper ──────────────────────────────────
// Automatic helper to get TherapyXAI's GOOGLE_REFRESH_TOKEN without manually
// parsing URL parameters or running complex terminal commands.
// ─────────────────────────────────────────────────────────────────────────────

export function handleGoogleMeetAuthorize(_req: Request, res: Response): void {
  const clientId = process.env.GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || GOOGLE_REDIRECT_URI || "http://localhost:8000/api/auth/google/callback";

  if (!clientId) {
    res.status(500).send("GOOGLE_CLIENT_ID is missing from environment variables.");
    return;
  }

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         "https://www.googleapis.com/auth/meetings.space.created",
    access_type:   "offline",
    prompt:        "consent",
    state:         "meet_authorize",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

export async function handleGoogleMeetCallback(req: Request, res: Response): Promise<void> {
  const { code, error: oauthError } = req.query as { code?: string; error?: string };

  if (oauthError || !code) {
    res.status(400).send(`
      <div style="font-family: sans-serif; padding: 2rem; max-width: 600px; margin: 40px auto; background: #fff3f3; border: 1px solid #ffcdd2; border-radius: 12px;">
        <h2 style="color: #d32f2f;">Authorization Failed</h2>
        <p>${oauthError || "No authorization code received from Google."}</p>
      </div>
    `);
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || GOOGLE_REDIRECT_URI || "http://localhost:8000/api/auth/google/callback";

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json() as { refresh_token?: string; access_token?: string; error?: string; error_description?: string };

    if (!tokenData.refresh_token) {
      res.status(400).send(`
        <div style="font-family: sans-serif; padding: 2rem; max-width: 600px; margin: 40px auto; background: #fff3f3; border: 1px solid #ffcdd2; border-radius: 12px;">
          <h2 style="color: #d32f2f;">Token Exchange Notice</h2>
          <p>Google returned access_token, but no refresh_token: <code>${tokenData.error_description || tokenData.error || "No refresh_token"}</code></p>
          <p>Please re-run the authorization link to force consent.</p>
        </div>
      `);
      return;
    }

    res.send(`
      <div style="font-family: system-ui, sans-serif; padding: 2.5rem; max-width: 650px; margin: 50px auto; background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
        <h2 style="color: #166534; margin-top: 0; font-size: 22px;">🎉 Google Meet Refresh Token Obtained Successfully!</h2>
        <p style="color: #15803d; font-size: 14px; line-height: 1.5;">Copy the refresh token below and add it to your <code>Backend/.env</code> as <code>GOOGLE_REFRESH_TOKEN</code>:</p>
        
        <div style="background: #ffffff; padding: 18px; border-radius: 12px; border: 1.5px solid #cbd5e1; word-break: break-all; font-family: monospace; font-size: 13px; font-weight: bold; color: #0f172a; margin: 20px 0; user-select: all;">
          ${tokenData.refresh_token}
        </div>
        
        <p style="font-size: 12px; color: #64748b;">You can now close this tab and restart your backend server.</p>
      </div>
    `);
  } catch (err: any) {
    res.status(500).send(`<h2>Server Error</h2><p>${err?.message || err}</p>`);
  }
}
