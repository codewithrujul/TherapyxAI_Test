import { supabaseAdmin } from "../db/supabaseClient";

export interface AdminUsersFilter {
    search?: string;
    verificationStatus?: "all" | "verified" | "unverified";
    role?: "all" | "patient" | "therapist" | "admin";
    page?: number;
    limit?: number;
}

export interface AdminTherapistsFilter {
    search?: string;
    verificationStatus?: "all" | "verified" | "unverified";
    status?: "all" | "active" | "pending_verification" | "inactive";
    page?: number;
    limit?: number;
}

export interface AdminRequestsFilter {
    search?: string;
    status?: "all" | "pending" | "onboarding" | "approved" | "rejected";
    page?: number;
    limit?: number;
}

/**
 * Fetches user accounts list for Admin Dashboard with search, role & verification filters.
 */
export async function getAdminUsersList(filter: AdminUsersFilter) {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 15));
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
        .from("profiles")
        .select("*", { count: "exact" });

    if (filter.search) {
        const term = `%${filter.search.trim()}%`;
        query = query.or(`name.ilike.${term},email.ilike.${term}`);
    }

    if (filter.role && filter.role !== "all") {
        query = query.eq("role", filter.role);
    }

    if (filter.verificationStatus === "verified") {
        query = query.eq("onboarding_completed", true);
    } else if (filter.verificationStatus === "unverified") {
        query = query.or("onboarding_completed.eq.false,onboarding_completed.is.null");
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
        console.error("[AdminService] getAdminUsersList error:", error.message);
        throw new Error(`Failed to fetch user list: ${error.message}`);
    }

    return {
        users: data ?? [],
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
    };
}

/**
 * Fetches therapists list for Admin Dashboard.
 */
export async function getAdminTherapistsList(filter: AdminTherapistsFilter) {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 15));
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
        .from("therapists")
        .select("*, profiles:user_id (id, name, email, role)", { count: "exact" });

    if (filter.search) {
        const term = `%${filter.search.trim()}%`;
        query = query.or(`full_name.ilike.${term},email.ilike.${term},title.ilike.${term}`);
    }

    if (filter.status && filter.status !== "all") {
        query = query.eq("status", filter.status);
    }

    if (filter.verificationStatus === "verified") {
        query = query.eq("is_verified", true);
    } else if (filter.verificationStatus === "unverified") {
        query = query.eq("is_verified", false);
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
        console.error("[AdminService] getAdminTherapistsList error:", error.message);
        throw new Error(`Failed to fetch therapist list: ${error.message}`);
    }

    return {
        therapists: data ?? [],
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
    };
}

/**
 * Fetches therapist onboarding requests list for Admin Dashboard.
 */
export async function getAdminOnboardingRequestsList(filter: AdminRequestsFilter) {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 15));
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
        .from("therapist_onboarding_requests")
        .select("*, profiles:user_id (id, name, email, role)", { count: "exact" });

    if (filter.status && filter.status !== "all") {
        query = query.eq("status", filter.status);
    }

    query = query.order("requested_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
        console.error("[AdminService] getAdminOnboardingRequestsList error:", error.message);
        throw new Error(`Failed to fetch onboarding requests: ${error.message}`);
    }

    // Optional client-side search filtering if search term provided
    let filteredData = data ?? [];
    if (filter.search) {
        const term = filter.search.trim().toLowerCase();
        filteredData = filteredData.filter((r: any) => {
            const name = r.profiles?.name?.toLowerCase() || "";
            const email = r.profiles?.email?.toLowerCase() || "";
            return name.includes(term) || email.includes(term);
        });
    }

    return {
        requests: filteredData,
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
    };
}

/**
 * Computes platform stats overview counters for Admin Dashboard.
 */
export async function getAdminStats() {
    // 1. Total users
    const { count: totalUsers } = await supabaseAdmin
        .from("profiles")
        .select("*", { count: "exact", head: true });

    // 2. Verified users (onboarding_completed = true)
    const { count: verifiedUsers } = await supabaseAdmin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("onboarding_completed", true);

    // 3. Total therapists
    const { count: totalTherapists } = await supabaseAdmin
        .from("therapists")
        .select("*", { count: "exact", head: true });

    // 4. Verified therapists (is_verified = true)
    const { count: verifiedTherapists } = await supabaseAdmin
        .from("therapists")
        .select("*", { count: "exact", head: true })
        .eq("is_verified", true);

    // 5. Pending onboarding requests
    const { count: pendingRequests } = await supabaseAdmin
        .from("therapist_onboarding_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

    return {
        users: {
            total: totalUsers ?? 0,
            verified: verifiedUsers ?? 0,
            unverified: (totalUsers ?? 0) - (verifiedUsers ?? 0),
        },
        therapists: {
            total: totalTherapists ?? 0,
            verified: verifiedTherapists ?? 0,
            unverified: (totalTherapists ?? 0) - (verifiedTherapists ?? 0),
        },
        pendingRequestsCount: pendingRequests ?? 0,
    };
}
