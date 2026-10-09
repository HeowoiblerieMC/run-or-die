import {
    supabase
} from "../supabase.js";

function normalizeLoginId(
    value
) {
    return String(
        value ||
        ""
    )
        .trim()
        .toLowerCase();
}

function authenticationEmail(
    loginId
) {
    return (
        `${normalizeLoginId(loginId)}` +
        "@runforlive.invalid"
    );
}

function convertProfile(
    row
) {
    return {
        id:
            row.id,

        loginId:
            row.login_id,

        displayName:
            row.display_name,

        role:
            row.role ||
            "PLAYER",

        selectedRank:
            row.selected_rank ||
            "PLAYER",

        guest:
            false
    };
}

function readableError(
    error
) {
    const message =
        String(
            error?.message ||
            error ||
            "Account error."
        );

    if (
        /Load failed|Failed to fetch|NetworkError/i
            .test(message)
    ) {
        return new Error(
            "Cannot reach Supabase. Check the URL and publishable key."
        );
    }

    if (
        /already registered/i
            .test(message)
    ) {
        return new Error(
            "That Login ID is already registered."
        );
    }

    if (
        /Invalid login credentials/i
            .test(message)
    ) {
        return new Error(
            "Login ID or password is incorrect."
        );
    }

    if (
        /Email not confirmed/i
            .test(message)
    ) {
        return new Error(
            "Turn Confirm email off in Supabase Authentication settings."
        );
    }

    if (
        /Database error saving new user/i
            .test(message)
    ) {
        return new Error(
            "That Login ID or display name may already be registered."
        );
    }

    return new Error(
        message
    );
}

export class AccountService {
    async getSession() {
        return this.getCurrentProfile();
    }

    async getCurrentProfile() {
        try {
            const {
                data,
                error
            } =
                await supabase.auth
                    .getSession();

            if (error) {
                throw error;
            }

            if (
                !data.session
                    ?.user
            ) {
                return null;
            }

            return this.getProfile(
                data.session.user.id
            );
        } catch (
            error
        ) {
            throw readableError(
                error
            );
        }
    }

    async getProfile(
        userId
    ) {
        try {
            const {
                data,
                error
            } =
                await supabase
                    .from(
                        "profiles"
                    )
                    .select(
                        [
                            "id",
                            "login_id",
                            "display_name",
                            "role",
                            "selected_rank"
                        ].join(",")
                    )
                    .eq(
                        "id",
                        userId
                    )
                    .single();

            if (error) {
                throw error;
            }

            return convertProfile(
                data
            );
        } catch (
            error
        ) {
            throw readableError(
                error
            );
        }
    }

    async waitForProfile(
        userId
    ) {
        let lastError =
            null;

        for (
            let attempt = 0;
            attempt < 12;
            attempt += 1
        ) {
            try {
                return await this.getProfile(
                    userId
                );
            } catch (
                error
            ) {
                lastError =
                    error;

                await new Promise(
                    resolve => {
                        setTimeout(
                            resolve,
                            250
                        );
                    }
                );
            }
        }

        throw (
            lastError ||
            new Error(
                "Profile creation failed."
            )
        );
    }

    async register({
        displayName,
        loginId,
        password,
        confirmPassword
    }) {
        const cleanName =
            String(
                displayName ||
                ""
            ).trim();

        const cleanLoginId =
            normalizeLoginId(
                loginId
            );

        const cleanPassword =
            String(
                password ||
                ""
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
            !/^[a-z0-9_]{4,20}$/
                .test(
                    cleanLoginId
                )
        ) {
            throw new Error(
                "Login ID must use 4 to 20 lowercase letters, numbers, or underscores."
            );
        }

        if (
            cleanPassword.length <
            8
        ) {
            throw new Error(
                "Password must contain at least 8 characters."
            );
        }

        if (
            confirmPassword !==
            undefined &&
            cleanPassword !==
            confirmPassword
        ) {
            throw new Error(
                "Passwords do not match."
            );
        }

        try {
            const {
                data,
                error
            } =
                await supabase.auth
                    .signUp({
                        email:
                            authenticationEmail(
                                cleanLoginId
                            ),

                        password:
                            cleanPassword,

                        options: {
                            data: {
                                login_id:
                                    cleanLoginId,

                                display_name:
                                    cleanName
                            }
                        }
                    });

            if (error) {
                throw error;
            }

            if (
                !data.user
            ) {
                throw new Error(
                    "Account creation returned no user."
                );
            }

            if (
                !data.session
            ) {
                throw new Error(
                    "Turn Confirm email OFF in Supabase, delete the incomplete user, and try again."
                );
            }

            return await this.waitForProfile(
                data.user.id
            );
        } catch (
            error
        ) {
            throw readableError(
                error
            );
        }
    }

    async signIn(
        loginId,
        password
    ) {
        const cleanLoginId =
            normalizeLoginId(
                loginId
            );

        const cleanPassword =
            String(
                password ||
                ""
            );

        if (
            !cleanLoginId
        ) {
            throw new Error(
                "Enter your Login ID."
            );
        }

        if (
            !cleanPassword
        ) {
            throw new Error(
                "Enter your password."
            );
        }

        try {
            const {
                data,
                error
            } =
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

            return this.getProfile(
                data.user.id
            );
        } catch (
            error
        ) {
            throw readableError(
                error
            );
        }
    }

    createGuest() {
        return {
            id:
                `guest_${crypto.randomUUID()}`,

            loginId:
                null,

            displayName:
                "Guest",

            role:
                "GUEST",

            selectedRank:
                "PLAYER",

            guest:
                true
        };
    }

    async signOut() {
        const {
            error
        } =
            await supabase.auth
                .signOut();

        if (error) {
            throw readableError(
                error
            );
        }
    }
}
