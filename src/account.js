import { getEconomy, getSelectedRank } from "./economy.js";

const ACCOUNT_KEY = "rfl_accounts_v2";
const SESSION_KEY = "rfl_session_v2";
const encoder = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes));
const unb64 = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));

function loadAccounts() {
    try {
        const value = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "[]");
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function saveAccounts(accounts) {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
}

async function hash(secret, salt) {
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        "PBKDF2",
        false,
        ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt, iterations: 210000 },
        key,
        256
    );
    return new Uint8Array(bits);
}

function recoveryCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(9));
    const raw = Array.from(bytes, byte => byte.toString(36).padStart(2, "0"))
        .join("")
        .toUpperCase();
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

    getProfiles() {
        return loadAccounts().map(publicProfile);
    }

    createGuest() {
        const profile = {
            id: `guest_${crypto.randomUUID()}`,
            displayName: "Player",
            loginId: null,
            role: "GUEST",
            title: null,
            escapeeRank: "ROOKIE",
            pursuerRank: "ROOKIE",
            guest: true
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(profile));
        return profile;
    }

    async register({ displayName, loginId, password, confirmPassword }) {
        const name = displayName.trim();
        const login = loginId.trim().toLowerCase();
        if (name.length < 3 || name.length > 16) throw new Error("Display name must be 3 to 16 characters.");
        if (!/^[a-z0-9_]{4,20}$/.test(login)) throw new Error("Login ID must use 4 to 20 lowercase letters, numbers, or underscores.");
        if (password.length < 12) throw new Error("Password must contain at least 12 characters.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");

        const list = loadAccounts();
        if (list.some(account => account.loginId === login)) throw new Error("That login ID already exists on this device.");

        const passwordSalt = crypto.getRandomValues(new Uint8Array(16));
        const code = recoveryCode();
        const recoverySalt = crypto.getRandomValues(new Uint8Array(16));
        const account = {
            id: crypto.randomUUID(),
            displayName: name,
            loginId: login,
            role: login === "heowoiblerie" ? "ADMIN" : "PLAYER",
            title: null,
            escapeeRank: "ROOKIE",
            pursuerRank: "ROOKIE",
            passwordSalt: b64(passwordSalt),
            passwordHash: b64(await hash(password, passwordSalt)),
            recoverySalt: b64(recoverySalt),
            recoveryHash: b64(await hash(code, recoverySalt))
        };
        list.push(account);
        saveAccounts(list);
        const profile = publicProfile(account);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(profile));
        getEconomy(profile);
        return { profile, recoveryCode: code };
    }

    async signIn(loginId, password) {
        const login = loginId.trim().toLowerCase();
        const account = loadAccounts().find(candidate => candidate.loginId === login);
        if (!account) throw new Error("Login ID or password is incorrect.");
        const passwordHash = b64(await hash(password, unb64(account.passwordSalt)));
        if (passwordHash !== account.passwordHash) throw new Error("Login ID or password is incorrect.");
        const profile = publicProfile(account);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(profile));
        return profile;
    }

    async resetPassword(loginId, code, newPassword) {
        if (newPassword.length < 12) throw new Error("Password must contain at least 12 characters.");
        const list = loadAccounts();
        const account = list.find(candidate => candidate.loginId === loginId.trim().toLowerCase());
        if (!account) throw new Error("Account was not found.");
        const recoveryHash = b64(await hash(code.trim().toUpperCase(), unb64(account.recoverySalt)));
        if (recoveryHash !== account.recoveryHash) throw new Error("Recovery code is incorrect.");
        const passwordSalt = crypto.getRandomValues(new Uint8Array(16));
        account.passwordSalt = b64(passwordSalt);
        account.passwordHash = b64(await hash(newPassword, passwordSalt));
        const nextCode = recoveryCode();
        const recoverySalt = crypto.getRandomValues(new Uint8Array(16));
        account.recoverySalt = b64(recoverySalt);
        account.recoveryHash = b64(await hash(nextCode, recoverySalt));
        saveAccounts(list);
        return nextCode;
    }

    signOut() {
        sessionStorage.removeItem(SESSION_KEY);
    }
}

export function getChatIdentity(profile) {
    if (profile.role === "ADMIN") return { label: "Admin", className: "admin" };
    if (profile.role === "MODERATOR") return { label: "Mod", className: "moderator" };
    const selected = getSelectedRank(profile);
    if (selected.id !== "PLAYER") return { label: selected.label, className: selected.className };
    if (profile.role === "GUEST") return { label: "Guest", className: "guest" };
    return { label: "Player", className: "player" };
}
