import { getChatIdentity } from "./account.js";

const rooms = new Map();

function makeRoomCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export class LocalLobbyService extends EventTarget {
    constructor(profile) {
        super();
        this.profile = profile;
        this.room = null;
        this.lastMessageAt = 0;
        this.lastMessage = "";
    }

    createRoom() {
        let code;
        do code = makeRoomCode(); while (rooms.has(code));
        const room = {
            code,
            ownerId: this.profile.id,
            players: [{ ...this.profile, ready: false }],
            messages: []
        };
        rooms.set(code, room);
        this.room = room;
        this.emitUpdate();
        return room;
    }

    joinRoom(code) {
        const room = rooms.get(code.trim().toUpperCase());
        if (!room) throw new Error("Room was not found in this browser session.");
        if (room.players.length >= 5) throw new Error("Room is full.");
        if (!room.players.some(player => player.id === this.profile.id)) room.players.push({ ...this.profile, ready: false });
        this.room = room;
        this.emitUpdate();
        return room;
    }

    leaveRoom() {
        if (!this.room) return;
        this.room.players = this.room.players.filter(player => player.id !== this.profile.id);
        if (this.room.players.length === 0) rooms.delete(this.room.code);
        this.room = null;
        this.emitUpdate();
    }

    toggleReady() {
        const player = this.room?.players.find(item => item.id === this.profile.id);
        if (!player) return;
        player.ready = !player.ready;
        this.emitUpdate();
    }

    sendMessage(content) {
        if (!this.room) throw new Error("Join a room first.");
        const clean = content.trim().slice(0, 120);
        if (!clean) return;
        const now = Date.now();
        if (now - this.lastMessageAt < 1000) throw new Error("Please wait before sending another message.");
        if (clean === this.lastMessage) throw new Error("Duplicate messages are not allowed.");
        const identity = getChatIdentity(this.profile);
        this.room.messages.push({
            id: crypto.randomUUID(),
            userId: this.profile.id,
            displayName: this.profile.displayName,
            label: identity.label,
            className: identity.className,
            content: clean,
            createdAt: new Date().toISOString()
        });
        this.lastMessageAt = now;
        this.lastMessage = clean;
        this.emitUpdate();
    }

    emitUpdate() {
        this.dispatchEvent(new CustomEvent("update", { detail: this.room }));
    }
}
