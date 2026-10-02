import { Request, Response } from "express";
import { supabase, supabaseAdmin } from "../db/supabaseClient";
import { initUserCredits, linkGuestSessionsToUser } from "../db/dbService";
import { verifySupabaseToken } from "../middleware/auth";
import { isValidGuestId, getGuestSessionIds, claimGuestReflections, discardHeld } from "../services/guestReflections";
import { upsertUserProfile } from "../db/dbService";
// import { setUserCache, deleteUserCache } from "../cache/sessionCache";
// ─── Types ────────────────────────────────────────────────────────────────────

interface RegisterBody {
  email:        string;
  password:     string;
  name?:        string;
  languageCode?: string;
  reason?:      string;
  isTherapist?: boolean;
  requestedRole?: string;
}

interface LoginBody {
  email:    string;
  password: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Shapes the Supabase session + user into a clean API response */
function buildAuthResponse(
  user: NonNullable<Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"]>,
  session: NonNullable<Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"]["session"]>
) {
  return {
    accessToken:  session.access_token,
    refreshToken: session.refresh_token,
    expiresAt:    session.expires_at,
    tokenType:    session.token_type,
    user: {
      id:    user.id,
      email: user.email ?? "",
      name:  (user.user_metadata?.name as string | undefined) ?? "",
    },
    session: {
      accessToken:       session.access_token,
      refreshToken:      session.refresh_token,
      expiresAt:         session.expires_at,
      expiresIn:         session.expires_in,
      tokenType:         session.token_type,
      providerToken:     session.provider_token  ?? null,
      providerRefreshToken: session.provider_refresh_token ?? null,
    },
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Body: { email, password, name? }
 *
 * Creates a new user via Supabase Auth (email/password).
 * On success, returns access token, refresh token, user profile, and full session.
 */
export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name, languageCode, reason, isTherapist, requestedRole } = req.body as RegisterBody;
  const isTherapistSignup = Boolean(isTherapist || requestedRole === "therapist");

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!email || !password) {
    res.status(400).json({
      error: { code: "MISSING_FIELDS", message: "email and password are required" },
    });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({
      error: { code: "INVALID_EMAIL", message: "Provided email address is not valid" },
    });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({
      error: { code: "WEAK_PASSWORD", message: "Password should be greater than 6" },
    });
    return;
  }

  // ── Supabase sign-up ────────────────────────────────────────────────────────
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name:         name ?? "",
        languageCode: languageCode ?? "en-IN",
        reason:       reason ?? "",
      },
    },
  });

  if (error) {
    console.error("[AuthController] register error:", error.message);

    const lowerMessage = error.message.toLowerCase();
    if (lowerMessage.includes("already registered") ||
        lowerMessage.includes("already exists") ||
        lowerMessage.includes("duplicate") ||
        lowerMessage.includes("user already exists") ||
        lowerMessage.includes("email already exists")) {
      res.status(400).json({
        error: { code: "USER_ALREADY_REGISTERED", message: "User is already registered" },
      });
      return;
    }

    res.status(400).json({
      error: { code: "REGISTER_FAILED", message: error.message },
    });
    return;
  }

  // Supabase returns session: null when email confirmation is required
  if (!data.session || !data.user) {
    if (data.user) {
      try {
        await upsertUserProfile(
          data.user.id,
          { email: data.user.email ?? email, name: name ?? "" },
          {
            languageCode: languageCode ?? "en-IN",
            reason:       reason ?? null,
          },
        );
        if (isTherapistSignup) {
          await supabaseAdmin
            .from("therapist_onboarding_requests")
            .insert({
              user_id: data.user.id,
              status: "onboarding",
              form_data: {},
              requested_at: new Date().toISOString(),
            });
        }
      } catch (profileError) {
        console.error("[AuthController] profile bootstrap skipped:", (profileError as Error).message);
      }
    }
    res.status(201).json({
      message: "Registration successful. Please verify your email to continue.",
      user: {
        id:    data.user?.id    ?? "",
        email: data.user?.email ?? "",
        name:  name             ?? "",
      },
    });
    return;
  }

  console.log(`[AuthController] User registered  id=${data.user.id}  email=${email}`);
  try {
    await upsertUserProfile(
      data.user.id,
      { email: data.user.email ?? email, name: name ?? "" },
      {
        languageCode: languageCode ?? "en-IN",
        reason:       reason ?? null,
      },
    );
    if (isTherapistSignup) {
      await supabaseAdmin
        .from("therapist_onboarding_requests")
        .insert({
          user_id: data.user.id,
          status: "onboarding",
          form_data: {},
          requested_at: new Date().toISOString(),
        });
    }
  } catch (profileError) {
    console.error("[AuthController] profile bootstrap skipped:", (profileError as Error).message);
  }


  // Grant 30 free minutes to every new user (non-blocking — don't fail registration if this errors)
  const newUserId = data.user!.id;
  initUserCredits(newUserId).catch((err: Error) =>
    console.error(`[AuthController] initUserCredits failed  userId=${newUserId}  err=${err.message}`)
  );

  res.status(201).json({
    message: "Registration successful",
    data:    buildAuthResponse(data.user, data.session),
  });
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Signs in an existing user. Returns access token, refresh token,
 * user profile, and full Supabase session object.
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginBody;

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!email || !password) {
    res.status(400).json({
      error: { code: "MISSING_FIELDS", message: "email and password are required" },
    });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({
      error: { code: "INVALID_EMAIL", message: "Provided email address is not valid" },
    });
    return;
  }

  // ── Supabase sign-in ────────────────────────────────────────────────────────
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("[AuthController] login error:", error.message);

    // Map Supabase error codes to clean HTTP responses
    const isCredentialError =
      error.message.toLowerCase().includes("invalid") ||
      error.message.toLowerCase().includes("credentials");

    res.status(isCredentialError ? 401 : 400).json({
      error: {
        code:    isCredentialError ? "INVALID_CREDENTIALS" : "LOGIN_FAILED",
        message: isCredentialError ? "Invalid email or password" : error.message,
      },
    });
    return;
  }

  if (!data.session || !data.user) {
    res.status(500).json({
      error: { code: "NO_SESSION", message: "Authentication succeeded but no session was created" },
    });
    return;
  }

  console.log(`[AuthController] User logged in  id=${data.user.id}  email=${email}`);
  // setUserCache(data.session.access_token, {
  //   userId: data.user.id,
  //   email:  data.user.email ?? "",
  //   name:   (data.user.user_metadata?.name as string) ?? "",
  // });
  res.status(200).json({
    message: "Login successful",
    data:    buildAuthResponse(data.user, data.session),
  });
}

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 * Header: Authorization: Bearer <access_token>
 *
 * Revokes the current session on Supabase.
 */
// ─── Google OAuth Login ───────────────────────────────────────────────────────

/**
 * POST /api/auth/google-login
 * Header: Authorization: Bearer <supabase_access_token>
 *
 * Called by the frontend after Google OAuth redirect.
 * Verifies the Supabase token, initialises credits for new users,
 * and returns the user profile + balance.
 */
export async function googleLogin(req: Request, res: Response): Promise<void> {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Missing token" });
    return;
  }

  const user = await verifySupabaseToken(token);
  if (!user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // Check if user already has a credits row
  const { data: creditsRow } = await supabaseAdmin
    .from("user_credits")
    .select("balance_minutes")
    .eq("user_id", user.id)
    .maybeSingle();

  const isNewUser = !creditsRow;
  if (isNewUser) {
    await initUserCredits(user.id);
    console.log(`[AuthController] Google new user — credits initialised  userId=${user.id}`);
  }

  const balance = isNewUser ? 30 : ((creditsRow?.balance_minutes as number) ?? 0);

  console.log(`[AuthController] Google login  userId=${user.id}  email=${user.email}  isNew=${isNewUser}`);

  res.status(200).json({
    isNewUser,
    balance,
    user: {
      id:    user.id,
      email: user.email,
      name:  user.name || user.email.split("@")[0],
    },
  });
}

// ─── Link Guest ───────────────────────────────────────────────────────────────

/**
 * POST /api/auth/link-guest
 * Header: Authorization: Bearer <access_token>
 * Body: { guest_id: string }
 *
 * Called immediately after a guest signs up — migrates all their guest sessions
 * to their new user account so history is preserved.
 */
export async function linkGuest(req: Request, res: Response): Promise<void> {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "Missing token" }); return; }

  const user = await verifySupabaseToken(token);
  if (!user)  { res.status(401).json({ error: "Invalid or expired token" }); return; }

  const { guest_id, consent, consent_version } = req.body as { guest_id?: string; consent?: boolean; consent_version?: string };
  if (!guest_id) { res.status(400).json({ error: "guest_id is required" }); return; }

  // Collect the guest's session ids BEFORE linking (linking clears guest_id on them).
  const guestSessionIds = isValidGuestId(guest_id) ? await getGuestSessionIds(guest_id) : [];

  const sessionsLinked = await linkGuestSessionsToUser(guest_id, user.id);
  console.log(`[AuthController] Guest sessions linked  guestId=${guest_id}  userId=${user.id}  count=${sessionsLinked}`);

  // Reflections only with explicit consent. Never breaks the sign-in link itself.
  let claimed = 0;
  if (isValidGuestId(guest_id)) {
    if (consent === true && typeof consent_version === "string" && consent_version.length <= 40) {
      try {
        claimed = (await claimGuestReflections({ rawGuestId: guest_id, userId: user.id, sessionIds: guestSessionIds, consentVersion: consent_version })).claimed;
      } catch (err) {
        console.error(`[AuthController] claim reflections failed  err=${(err as Error).message}`);
      }
    } else {
      discardHeld(guest_id);   // signed in without consent: drop anything we were holding
    }
  }
  res.status(200).json({ sessions_linked: sessionsLinked, reflections: { claimed } });
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(req: Request, res: Response): Promise<void> {
  const authHeader = req.headers.authorization;
  const token      = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({
      error: { code: "NO_TOKEN", message: "Authorization header with Bearer token is required" },
    });
    return;
  }

  // Set the session so Supabase knows which token to revoke
  await supabase.auth.setSession({ access_token: token, refresh_token: "" });
  const { error } = await supabase.auth.signOut();
   // Remove from cache immediately so token is invalid on next WS connection
  // deleteUserCache(token);
  if (error) {
    console.error("[AuthController] logout error:", error.message);
    res.status(400).json({
      error: { code: "LOGOUT_FAILED", message: error.message },
    });
    return;
  }

  res.status(200).json({ message: "Logged out successfully" });
}
