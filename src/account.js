const ACCOUNT_KEY = "rfl_accounts_v1";
const SESSION_KEY = "rfl_session_v1";
const ITERATIONS = 210000;

const encoder = new TextEncoder();
const toBase64 = bytes => btoa(String.fromCharCode(...bytes));
const fromBase64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));

function normalizeLoginId(value) {
    return value.trim().toLowerCase();
}

function loadAccounts() {
    try {
        const data = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "[]");
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function saveAccounts(accounts) {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
}

async function deriveHash(secret, salt) {
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            hash: "SHA-256",
            salt,
            iterations: ITERATIONS
        },
        keyMaterial,
        256
    );

    return new Uint8Array(bits);
}

function randomToken(byteLength = 18) {
    const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
    return toBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function recoveryCode() {
    const raw = randomToken(12).toUpperCase().replaceAll("-", "X").replaceAll("_", "Y");
    return `RFL-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function publicProfile(account) {
    return {
        id: account.id,
        displayName: account.displayName,
        loginId: account.loginId,
        role: account.role,
        title: account.title,
        escapeeRank: account.escapeeRank,
        pursuerRank: account.pursuerRank,
        guest: false
    };
}

export class AccountService {
    getSession() {
        try {
            return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
        } catch {
            return null;
        }
    }

    createGuest() {
        const guest = {
            id: `guest_${crypto.randomUUID()}`,
            displayName: "Player",
            loginId: null,
            role: "GUEST",
            title: null,
            escapeeRank: "ROOKIE",
            pursuerRank: "ROOKIE",
            guest: true
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(guest));
        return guest;
    }

    async register({ displayName, loginId, password, confirmPassword }) {
        const cleanName = displayName.trim();
        const cleanLogin = normalizeLoginId(loginId);

        if (cleanName.length < 3 || cleanName.length > 16) throw new Error("Display name must be 3 to 16 characters.");
        if (!/^[a-z0-9_]{4,20}$/.test(cleanLogin)) throw new Error("Login ID must use 4 to 20 lowercase letters, numbers, or underscores.");
        if (password.length < 12) throw new Error("Password must contain at least 12 characters.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");

        const accounts = loadAccounts();
        if (accounts.some(account => account.loginId === cleanLogin)) throw new Error("That login ID is already used on this device.");

        const passwordSalt = crypto.getRandomValues(new Uint8Array(16));
        const code = recoveryCode();
        const recoverySalt = crypto.getRandomValues(new Uint8Array(16));
        const account = {
            id: crypto.randomUUID(),
            displayName: cleanName,
            loginId: cleanLogin,
            role: "PLAYER",
            title: null,
            escapeeRank: "ROOKIE",
            pursuerRank: "ROOKIE",
            passwordSalt: toBase64(passwordSalt),
            passwordHash: toBase64(await deriveHash(password, passwordSalt)),
            recoverySalt: toBase64(recoverySalt),
            recoveryHash: toBase64(await deriveHash(code, recoverySalt)),
            createdAt: new Date().toISOString()
        };

        accounts.push(account);
        saveAccounts(accounts);
        const session = publicProfile(account);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { profile: session, recoveryCode: code };
    }

    async signIn(loginId, password) {
        const account = loadAccounts().find(item => item.loginId === normalizeLoginId(loginId));
        if (!account) throw new Error("Login ID or password is incorrect.");
        const hash = toBase64(await deriveHash(password, fromBase64(account.passwordSalt)));
        if (hash !== account.passwordHash) throw new Error("Login ID or password is incorrect.");
        const session = publicProfile(account);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
    }

    async resetPassword(loginId, code, newPassword) {
        if (newPassword.length < 12) throw new Error("Password must contain at least 12 characters.");
        const accounts = loadAccounts();
        const account = accounts.find(item => item.loginId === normalizeLoginId(loginId));
        if (!account) throw new Error("Account was not found.");
        const hash = toBase64(await deriveHash(code.trim().toUpperCase(), fromBase64(account.recoverySalt)));
        if (hash !== account.recoveryHash) throw new Error("Recovery code is incorrect.");

        const passwordSalt = crypto.getRandomValues(new Uint8Array(16));
        account.passwordSalt = toBase64(passwordSalt);
        account.passwordHash = toBase64(await deriveHash(newPassword, passwordSalt));

        const nextCode = recoveryCode();
        const recoverySalt = crypto.getRandomValues(new Uint8Array(16));
        account.recoverySalt = toBase64(recoverySalt);
        account.recoveryHash = toBase64(await deriveHash(nextCode, recoverySalt));
        saveAccounts(accounts);
        return nextCode;
    }

    signOut() {
        sessionStorage.removeItem(SESSION_KEY);
    }
}

export function getChatIdentity(profile) {
    if (profile.role === "ADMIN") return { label: "Admin", className: "admin" };
    if (profile.role === "MODERATOR") return { label: "Mod", className: "moderator" };
    if (profile.title === "LEGEND") return { label: "Legend", className: "legend" };
    if (profile.role === "GUEST") return { label: "Guest", className: "guest" };
    return { label: "Player", className: "player" };
}
