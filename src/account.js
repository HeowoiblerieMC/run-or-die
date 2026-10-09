import { supabase } from "./supabase.js";
import { getSelectedRank } from "./economy.js";

function normalizeLoginId(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function loginEmail(loginId) {
    return `${normalizeLoginId(loginId)}@runforlive.invalid`;
}

function publicProfile(row) {
    return {
        id: row.id,
        loginId: row.login_id,
        displayName: row.display_name,
        role: row.role,
        title: row.title,
        guest: false
    };
}

export class AccountService {
    async getSession() {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
            throw error;
        }

        if (!data.session) {
            return null;
        }

        return this.getProfile(data.session.user.id);
    }

    async getProfile(userId) {
        const { data, error } = await supabase
            .from("profiles")
            .select("id, login_id, display_name, role, title")
            .eq("id", userId)
            .single();

        if (error) {
            throw error;
        }

        return publicProfile(data);
    }

    async getProfiles() {
        const { data, error } = await supabase
            .from("profiles")
            .select("id, login_id, display_name, role, title")
            .order("display_name");

        if (error) {
            throw error;
        }

        return (data || []).map(publicProfile);
    }

    createGuest(displayName = "Player") {
        return {
            id: `guest_${crypto.randomUUID()}`,
            loginId: null,
            displayName: String(displayName || "Player").trim().slice(0, 16),
            role: "GUEST",
            title: null,
            guest: true
        };
    }

    async register({
        displayName,
        loginId,
        password,
        confirmPassword
    }) {
        const cleanDisplayName = String(displayName || "").trim();
        const cleanLoginId = normalizeLoginId(loginId);

        if (cleanDisplayName.length < 3 || cleanDisplayName.length > 16) {
            throw new Error("Display name must be 3 to 16 characters.");
        }

        if (!/^[a-z0-9_]{4,20}$/.test(cleanLoginId)) {
            throw new Error(
                "Login ID must use 4 to 20 lowercase letters, numbers, or underscores."
            );
        }

        if (String(password || "").length < 12) {
            throw new Error("Password must contain at least 12 characters.");
        }

        if (password !== confirmPassword) {
            throw new Error("Passwords do not match.");
        }

        const { data, error } = await supabase.auth.signUp({
            email: loginEmail(cleanLoginId),
            password,
            options: {
                data: {
                    login_id: cleanLoginId,
                    display_name: cleanDisplayName
                }
            }
        });

        if (error) {
            throw error;
        }

        if (!data.user) {
            throw new Error("Account creation failed.");
        }

        if (!data.session) {
            return {
                profile: {
                    id: data.user.id,
                    loginId: cleanLoginId,
                    displayName: cleanDisplayName,
                    role: "PLAYER",
                    title: null,
                    guest: false
                },
                emailConfirmationRequired: true
            };
        }

        return {
            profile: await this.getProfile(data.user.id),
            emailConfirmationRequired: false
        };
    }

    async signIn(loginId, password) {
        const cleanLoginId = normalizeLoginId(loginId);

        const { data, error } = await supabase.auth.signInWithPassword({
            email: loginEmail(cleanLoginId),
            password
        });

        if (error) {
            throw new Error("Login ID or password is incorrect.");
        }

        return this.getProfile(data.user.id);
    }

    async resetPassword(loginId) {
        const cleanLoginId = normalizeLoginId(loginId);

        const { error } = await supabase.auth.resetPasswordForEmail(
            loginEmail(cleanLoginId),
            {
                redirectTo: `${location.origin}${location.pathname}`
            }
        );

        if (error) {
            throw error;
        }
    }

    async updatePassword(password) {
        if (String(password || "").length < 12) {
            throw new Error("Password must contain at least 12 characters.");
        }

        const { error } = await supabase.auth.updateUser({
            password
        });

        if (error) {
            throw error;
        }
    }

    async signOut() {
        const { error } = await supabase.auth.signOut();

        if (error) {
            throw error;
        }
    }

    onAuthStateChange(callback) {
        const { data } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                let profile = null;

                if (session?.user) {
                    try {
                        profile = await this.getProfile(session.user.id);
                    } catch {
                        profile = null;
                    }
                }

                callback({
                    event,
                    session,
                    profile
                });
            }
        );

        return () => data.subscription.unsubscribe();
    }
}

export async function getChatIdentity(profile) {
    if (profile?.role === "ADMIN") {
        return {
            label: "Admin",
            className: "admin"
        };
    }

    if (profile?.role === "MODERATOR") {
        return {
            label: "Mod",
            className: "moderator"
        };
    }

    if (profile?.role === "GUEST") {
        return {
            label: "Guest",
            className: "guest"
        };
    }

    const rank = await getSelectedRank(profile);

    return {
        label: rank.label,
        className: rank.className
    };
}
