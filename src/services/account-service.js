import { supabase } from "../supabase.js";

const normalizeLoginId = value => String(value || "").trim().toLowerCase();
const loginEmail = loginId => `${normalizeLoginId(loginId)}@runforlive.invalid`;

const toProfile = row => ({
    id: row.id,
    loginId: row.login_id,
    displayName: row.display_name,
    role: row.role,
    selectedRank: row.selected_rank || "PLAYER",
    guest: false
});

export class AccountService {
    async getCurrentProfile() {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) return null;
        return this.getProfile(data.session.user.id);
    }

    async getProfile(id) {
        const { data, error } = await supabase
            .from("profiles")
            .select("id,login_id,display_name,role,selected_rank")
            .eq("id", id)
            .single();
        if (error) throw error;
        return toProfile(data);
    }

    async register({ displayName, loginId, password }) {
        const name = String(displayName || "").trim();
        const login = normalizeLoginId(loginId);
        if (name.length < 3 || name.length > 16) throw new Error("Name must be 3 to 16 characters.");
        if (!/^[a-z0-9_]{4,20}$/.test(login)) throw new Error("Login ID must be 4 to 20 lowercase letters, numbers, or underscores.");
        if (String(password || "").length < 12) throw new Error("Password must be at least 12 characters.");

        const { data, error } = await supabase.auth.signUp({
            email: loginEmail(login),
            password,
            options: { data: { login_id: login, display_name: name } }
        });
        if (error) throw error;
        if (!data.user) throw new Error("Registration failed.");
        if (!data.session) throw new Error("Disable email confirmation in Supabase Auth settings for login-ID accounts.");
        return this.getProfile(data.user.id);
    }

    async signIn(loginId, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: loginEmail(loginId),
            password
        });
        if (error) throw new Error("Login ID or password is incorrect.");
        return this.getProfile(data.user.id);
    }

    createGuest() {
        return {
            id: `guest_${crypto.randomUUID()}`,
            loginId: null,
            displayName: "Guest",
            role: "GUEST",
            selectedRank: "PLAYER",
            guest: true
        };
    }

    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }
}
