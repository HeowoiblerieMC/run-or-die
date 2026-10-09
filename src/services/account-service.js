import {
    supabase,
    testSupabaseConnection
} from "../supabase.js";

const PROFILE_COLUMNS = [
    "id",
    "login_id",
    "display_name",
    "role",
    "selected_rank"
].join(", ");

function normalizeLoginId(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function authenticationEmail(loginId) {
    return `${normalizeLoginId(loginId)}@runforlive.invalid`;
}

function toProfile(row) {
    return {
        id: row.id,
        loginId: row.login_id,
        displayName: row.display_name,
        role: row.role || "PLAYER",
        selectedRank: row.selected_rank || "PLAYER",
        guest: false
    };
}

function createReadableError(error) {
    const message = String(
        error?.message ||
        error ||
        "Unknown account error."
    );

    if (
        message.includes("Load failed") ||
        message.includes("Failed to fetch") ||
        message.includes("NetworkError")
    ) {
        return new Error(
            "Cannot reach the account server. Check the Supabase URL, publishable key, and internet connection."
        );
    }

    if (
        message.includes("already registered") ||
        message.includes("already been registered")
    ) {
        return new Error(
            "That Login ID is already registered. Use SIGN IN instead."
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

    if (
        message.includes("Invalid login credentials")
    ) {
        return new Error(
            "Login ID or password is incorrect."
        );
    }

    if (
        message.includes("Email not confirmed")
    ) {
        return new Error(
            "Confirm email is enabled in Supabase. Turn it off in Authentication settings."
        );
    }

    if (
        message.includes("Database error saving new user")
    ) {
        return new Error(
            "The Login ID or display name may already exist. If an earlier registration failed, delete the incomplete user in Supabase Authentication and try again."
        );
    }

    return new Error(message);
}

function validateRegistration({
    displayName,
    loginId,
    password,
    confirmPassword
}) {
    const cleanDisplayName = String(
        displayName || ""
    ).trim();

    const cleanLoginId =
        normalizeLoginId(loginId);

    const cleanPassword =
        String(password || "");

    if (
        cleanDisplayName.length < 3 ||
        cleanDisplayName.length > 16
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
            "Login ID must use 4 to 20 lowercase letters, numbers, or underscores."
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

    return {
        displayName: cleanDisplayName,
        loginId: cleanLoginId,
        password: cleanPassword
    };
}

export class AccountService {
    async getCurrentProfile() {
        try {
            const { data, error } =
                await supabase.auth.getSession();

            if (error) {
                throw error;
            }

            const user =
                data.session?.user;

            if (!user) {
                return null;
            }

            return await this.getProfile(
                user.id
            );
        } catch (error) {
            throw createReadableError(error);
        }
    }

    async getSession() {
        return this.getCurrentProfile();
    }

    async getProfile(userId) {
        try {
            const { data, error } =
                await supabase
                    .from("profiles")
                    .select(PROFILE_COLUMNS)
                    .eq("id", userId)
                    .single();

            if (error) {
                throw error;
            }

            return toProfile(data);
        } catch (error) {
            throw createReadableError(error);
        }
    }

    async waitForProfile(userId) {
        let lastError = null;

        for (
            let attempt = 0;
            attempt < 12;
            attempt += 1
        ) {
            try {
                return await this.getProfile(
                    userId
                );
            } catch (error) {
                lastError = error;

                await new Promise(resolve => {
                    setTimeout(resolve, 250);
                });
            }
        }

        throw (
            lastError ||
            new Error(
                "The profile could not be created."
            )
        );
    }

    async register(values) {
        const account =
            validateRegistration(values);

        try {
            await testSupabaseConnection();

            const { data, error } =
                await supabase.auth.signUp({
                    email:
                        authenticationEmail(
                            account.loginId
                        ),

                    password:
                        account.password,

                    options: {
                        data: {
                            login_id:
                                account.loginId,

                            display_name:
                                account.displayName
                        }
                    }
                });

            if (error) {
                throw error;
            }

            if (!data.user) {
                throw new Error(
                    "Account creation returned no user."
                );
            }

            if (!data.session) {
                throw new Error(
                    "The account was created but email confirmation is enabled. Turn Confirm email off in Supabase, delete this incomplete user, and create it again."
                );
            }

            return await this.waitForProfile(
                data.user.id
            );
        } catch (error) {
            throw createReadableError(error);
        }
    }

    async signIn(loginId, password) {
        const cleanLoginId =
            normalizeLoginId(loginId);

        const cleanPassword =
            String(password || "");

        if (!cleanLoginId) {
            throw new Error(
                "Enter your Login ID."
            );
        }

        if (!cleanPassword) {
            throw new Error(
                "Enter your password."
            );
        }

        try {
            await testSupabaseConnection();

            const { data, error } =
                await supabase.auth
                    .signInWithPassword({
                        email:
                            authenticationEmail(
                                cleanLoginId
                            ),

                        password:
                            cleanPassword
                    });

            if (error) {
                throw error;
            }

            if (!data.user) {
                throw new Error(
                    "Sign-in returned no user."
                );
            }

            return await this.getProfile(
                data.user.id
            );
        } catch (error) {
            throw createReadableError(error);
        }
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
        try {
            const { error } =
                await supabase.auth.signOut();

            if (error) {
                throw error;
            }
        } catch (error) {
            throw createReadableError(error);
        }
    }
}
