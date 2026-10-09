import { supabase } from "../supabase.js";

export class LobbyService extends EventTarget {
    constructor(profile) {
        super();
        this.profile = profile;
        this.channel = null;
        this.players = new Map();
    }

    async connect() {
        if (this.profile.guest) return;
        this.channel = supabase.channel("main-lobby", {
            config: { presence: { key: this.profile.id } }
        });

        this.channel
            .on("presence", { event: "sync" }, () => this.syncPresence())
            .on("broadcast", { event: "chat" }, payload => {
                this.dispatchEvent(new CustomEvent("chat", { detail: payload.payload }));
            });

        await this.channel.subscribe(async status => {
            if (status === "SUBSCRIBED") {
                await this.channel.track({
                    id: this.profile.id,
                    displayName: this.profile.displayName,
                    role: this.profile.role,
                    selectedRank: this.profile.selectedRank,
                    joinedAt: new Date().toISOString()
                });
            }
        });
    }

    syncPresence() {
        this.players.clear();
        const state = this.channel.presenceState();
        for (const entries of Object.values(state)) {
            for (const player of entries) this.players.set(player.id, player);
        }
        this.dispatchEvent(new CustomEvent("players", { detail: [...this.players.values()] }));
    }

    async sendChat(content) {
        const clean = String(content || "").trim().slice(0, 120);
        if (!clean || !this.channel) return;
        await this.channel.send({
            type: "broadcast",
            event: "chat",
            payload: {
                id: crypto.randomUUID(),
                userId: this.profile.id,
                displayName: this.profile.displayName,
                role: this.profile.role,
                selectedRank: this.profile.selectedRank,
                content: clean,
                createdAt: Date.now()
            }
        });
    }

    async disconnect() {
        if (this.channel) await supabase.removeChannel(this.channel);
        this.channel = null;
    }
}
