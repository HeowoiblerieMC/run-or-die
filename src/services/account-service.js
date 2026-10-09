import { supabase } from "../supabase.js";

function normalizeLoginId(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function makeAuthenticationEmail(loginId) {
    return `${normalizeLoginId(loginId)}@players.runforlive.com`;
}

function convertProfile(row) {
    return {
        id: row.id,
        loginId: row.login_id,
        displayName: row.display_name,
        role: row.role || "PLAYER",
        selectedRank: row.selected_rank || "PLAYER",
        guest: false
    };
}

function readableError(error) {
    const message = String(
        error?.message || error || "Unknown account error."
    );

    if (
        message.includes("Failed to fetch") ||
        message.includes("Load failed") ||
        message.includes("NetworkError")
    ) {
        return new Error(
            "The account server could not be reached. Check the Supabase URL and publishable key."
        );
    }

    if (
        message.includes("already registered") ||
        message.includes("already been registered")
    ) {
        return new Error(
            "That Login ID is already registered. Try signing in instead."
        );
    }

    if (
        message.includes("duplicate key") &&
        message.includes("login_id")
    ) {
        return new Error(
            "That Login ID is already in use."
        );
    }

    if (
        message.includes("duplicate key") &&
        message.includes("display_name")
    ) {
        return new Error(
            "That display name is already in use."
        );
    }

    if (message.includes("Invalid login credentials")) {
        return new Error(
            "Login ID or password is incorrect."
        );
    }

    if (message.includes("Email not confirmed")) {
        return new Error(
            "Email confirmation is enabled in Supabase. Turn Confirm email off."
        );
    }

    if (message.includes("Password should be")) {
        return new Error(
            "The password does not meet the server requirements."
        );
    }

    return new Error(message);
}

export class AccountService {
    async getCurrentProfile() {
        try {
            const { data, error } =
                await supabase.auth.getSession();

            if (error) {
                throw error;
            }

            if (!data.session?.user) {
                return null;
            }

            return await this.getProfile(
                data.session.user.id
            );
        } catch (error) {
            throw readableError(error);
        }
    }

    async getProfile(userId) {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select(
                    "id, login_id, display_name, role, selected_rank"
                )
                .eq("id", userId)
                .single();

            if (error) {
                throw error;
            }

            return convertProfile(data);
        } catch (error) {
            throw readableError(error);
        }
    }

    async register({
        displayName,
        loginId,
        password,
        confirmPassword
    }) {
        const cleanName = String(
            displayName || ""
        ).trim();

        const cleanLoginId =
            normalizeLoginId(loginId);

        const cleanPassword = String(
            password || ""
        );

        if (
            cleanName.length < 3 ||
            cleanName.length > 16
        ) {
            throw new Error(
                "Display name must be 3 to 16 characters."
            );
        }

        if (
            !/^[a-z0-9_]{4,20}$/.test(
                cleanLoginId
            )
        ) {
            throw new Error(
                "Login ID must contain 4 to 20 lowercase letters, numbers, or underscores."
            );
        }

        if (cleanPassword.length < 8) {
            throw new Error(
                "Password must contain at least 8 characters."
            );
        }

        if (
            confirmPassword !== undefined &&
            cleanPassword !== confirmPassword
        ) {
            throw new Error(
                "Passwords do not match."
            );
        }

        try {
            const { data, error } =
                await supabase.auth.signUp({
                    email:
                        makeAuthenticationEmail(
                            cleanLoginId
                        ),
                    password: cleanPassword,
                    options: {
                        data: {
                            login_id: cleanLoginId,
                            display_name: cleanName
                        }
                    }
                });

            if (error) {
                throw error;
            }

            if (!data.
