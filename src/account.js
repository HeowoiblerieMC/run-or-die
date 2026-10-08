import {
    getEconomy,
    getSelectedRank
} from "./economy.js";

const ACCOUNT_KEY =
    "rfl_accounts_v2";

const SESSION_KEY =
    "rfl_session_v2";

const encoder =
    new TextEncoder();

const toBase64 = bytes =>
    btoa(
        String.fromCharCode(
            ...bytes
        )
    );

const fromBase64 = value =>
    Uint8Array.from(
        atob(value),
        character =>
            character.charCodeAt(0)
    );

function loadAccounts() {
    try {
        const value =
            JSON.parse(
                localStorage.getItem(
                    ACCOUNT_KEY
                ) || "[]"
            );

        return Array.isArray(value)
            ? value
            : [];
    } catch {
        return [];
    }
}

function saveAccounts(
    accounts
) {
    localStorage.setItem(
        ACCOUNT_KEY,
        JSON.stringify(
            accounts
        )
    );
}

async function createHash(
    secret,
    salt
) {
    const key =
        await crypto.subtle.importKey(
            "raw",
            encoder.encode(
                secret
            ),
            "PBKDF2",
            false,
            [
                "deriveBits"
            ]
        );

    const bits =
        await crypto.subtle.deriveBits(
            {
                name:
                    "PBKDF2",

                hash:
                    "SHA-256",

                salt,

                iterations:
                    210000
            },
            key,
            256
        );

    return new Uint8Array(
        bits
    );
}

function createRecoveryCode() {
    const bytes =
        crypto.getRandomValues(
            new Uint8Array(
                9
            )
        );

    const value =
        Array.from(
            bytes,
            byte =>
                byte
                    .toString(
                        36
                    )
                    .padStart(
                        2,
                        "0"
                    )
        )
            .join("")
            .toUpperCase();

    return (
        `RFL-${value.slice(0, 4)}` +
        `-${value.slice(4, 8)}` +
        `-${value.slice(8, 12)}`
    );
}

function createPublicProfile(
    account
) {
    return {
        id:
            account.id,

        displayName:
            account.displayName,

        loginId:
            account.loginId,

        role:
            account.role,

        title:
            account.title,

        escapeeRank:
            account.escapeeRank,

        pursuerRank:
            account.pursuerRank,

        guest:
            false
    };
}

export class AccountService {
    getSession() {
        try {
            return JSON.parse(
                sessionStorage.getItem(
                    SESSION_KEY
                ) || "null"
            );
        } catch {
            return null;
        }
    }

    getProfiles() {
        return loadAccounts()
            .map(
                createPublicProfile
            );
    }

    findProfile(
        identifier
    ) {
        const search =
            String(
                identifier ||
                ""
            )
                .trim()
                .toLowerCase();

        if (!search) {
            return null;
        }

        const profiles =
            this.getProfiles();

        const matches =
            profiles.filter(
                profile =>
                    profile.id
                        .toLowerCase() ===
                        search ||
                    profile.loginId
                        .toLowerCase() ===
                        search ||
                    profile.displayName
                        .toLowerCase() ===
                        search
            );

        if (
            matches.length >
            1
        ) {
            throw new Error(
                "Multiple accounts use that display name. Use the login ID."
            );
        }

        return (
            matches[0] ||
            null
        );
    }

    createGuest() {
        const profile = {
            id:
                `guest_${crypto.randomUUID()}`,

            displayName:
                "Player",

            loginId:
                null,

            role:
                "GUEST",

            title:
                null,

            escapeeRank:
                "ROOKIE",

            pursuerRank:
                "ROOKIE",

            guest:
                true
        };

        sessionStorage.setItem(
            SESSION_KEY,
            JSON.stringify(
                profile
            )
        );

        return profile;
    }

    async register({
        displayName,
        loginId,
        password,
        confirmPassword
    }) {
        const name =
            displayName.trim();

        const login =
            loginId
                .trim()
                .toLowerCase();

        if (
            name.length < 3 ||
            name.length > 16
        ) {
            throw new Error(
                "Display name must be 3 to 16 characters."
            );
        }

        if (
            !/^[a-z0-9_]{4,20}$/.test(
                login
            )
        ) {
            throw new Error(
                "Login ID must use 4 to 20 lowercase letters, numbers, or underscores."
            );
        }

        if (
            password.length <
            12
        ) {
            throw new Error(
                "Password must contain at least 12 characters."
            );
        }

        if (
            password !==
            confirmPassword
        ) {
            throw new Error(
                "Passwords do not match."
            );
        }

        const accounts =
            loadAccounts();

        if (
            accounts.some(
                account =>
                    account.loginId ===
                    login
            )
        ) {
            throw new Error(
                "That login ID already exists on this device."
            );
        }

        const passwordSalt =
            crypto.getRandomValues(
                new Uint8Array(
                    16
                )
            );

        const recoveryCode =
            createRecoveryCode();

        const recoverySalt =
            crypto.getRandomValues(
                new Uint8Array(
                    16
                )
            );

        const account = {
            id:
                crypto.randomUUID(),

            displayName:
                name,

            loginId:
                login,

            role:
                login ===
                "heowoiblerie"
                    ? "ADMIN"
                    : "PLAYER",

            title:
                null,

            escapeeRank:
                "ROOKIE",

            pursuerRank:
                "ROOKIE",

            passwordSalt:
                toBase64(
                    passwordSalt
                ),

            passwordHash:
                toBase64(
                    await createHash(
                        password,
                        passwordSalt
                    )
                ),

            recoverySalt:
                toBase64(
                    recoverySalt
                ),

            recoveryHash:
                toBase64(
                    await createHash(
                        recoveryCode,
                        recoverySalt
                    )
                )
        };

        accounts.push(
            account
        );

        saveAccounts(
            accounts
        );

        const profile =
            createPublicProfile(
                account
            );

        sessionStorage.setItem(
            SESSION_KEY,
            JSON.stringify(
                profile
            )
        );

        getEconomy(
            profile
        );

        return {
            profile,
            recoveryCode
        };
    }

    async signIn(
        loginId,
        password
    ) {
        const login =
            loginId
                .trim()
                .toLowerCase();

        const account =
            loadAccounts()
                .find(
                    candidate =>
                        candidate.loginId ===
                        login
                );

        if (!account) {
            throw new Error(
                "Login ID or password is incorrect."
            );
        }

        const passwordHash =
            toBase64(
                await createHash(
                    password,
                    fromBase64(
                        account.passwordSalt
                    )
                )
            );

        if (
            passwordHash !==
            account.passwordHash
        ) {
            throw new Error(
                "Login ID or password is incorrect."
            );
        }

        const profile =
            createPublicProfile(
                account
            );

        sessionStorage.setItem(
            SESSION_KEY,
            JSON.stringify(
                profile
            )
        );

        return profile;
    }

    async resetPassword(
        loginId,
        recoveryCode,
        newPassword
    ) {
        if (
            newPassword.length <
            12
        ) {
            throw new Error(
                "Password must contain at least 12 characters."
            );
        }

        const accounts =
            loadAccounts();

        const account =
            accounts.find(
                candidate =>
                    candidate.loginId ===
                    loginId
                        .trim()
                        .toLowerCase()
            );

        if (!account) {
            throw new Error(
                "Account was not found."
            );
        }

        const recoveryHash =
            toBase64(
                await createHash(
                    recoveryCode
                        .trim()
                        .toUpperCase(),

                    fromBase64(
                        account
                            .recoverySalt
                    )
                )
            );

        if (
            recoveryHash !==
            account.recoveryHash
        ) {
            throw new Error(
                "Recovery code is incorrect."
            );
        }

        const passwordSalt =
            crypto.getRandomValues(
                new Uint8Array(
                    16
                )
            );

        account.passwordSalt =
            toBase64(
                passwordSalt
            );

        account.passwordHash =
            toBase64(
                await createHash(
                    newPassword,
                    passwordSalt
                )
            );

        const nextCode =
            createRecoveryCode();

        const recoverySalt =
            crypto.getRandomValues(
                new Uint8Array(
                    16
                )
            );

        account.recoverySalt =
            toBase64(
                recoverySalt
            );

        account.recoveryHash =
            toBase64(
                await createHash(
                    nextCode,
                    recoverySalt
                )
            );

        saveAccounts(
            accounts
        );

        return nextCode;
    }

    signOut() {
        sessionStorage.removeItem(
            SESSION_KEY
        );
    }
}

export function getChatIdentity(
    profile
) {
    if (
        profile.role ===
        "ADMIN"
    ) {
        return {
            label:
                "Admin",

            className:
                "admin"
        };
    }

    if (
        profile.role ===
        "MODERATOR"
    ) {
        return {
            label:
                "Mod",

            className:
                "moderator"
        };
    }

    const selectedRank =
        getSelectedRank(
            profile
        );

    if (
        selectedRank.id !==
        "PLAYER"
    ) {
        return {
            label:
                selectedRank.label,

            className:
                selectedRank.className
        };
    }

    if (
        profile.role ===
        "GUEST"
    ) {
        return {
            label:
                "Guest",

            className:
                "guest"
        };
    }

    return {
        label:
            "Player",

        className:
            "player"
    };
}
