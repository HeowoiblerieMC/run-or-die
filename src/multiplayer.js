import { supabase } from "./supabase.js";

const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), value => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[value % 32]).join("");

export class OnlineLobbyService extends EventTarget {
  constructor(profile) {
    super();
    this.profile = profile;
    this.room = null;
    this.channel = null;
  }

  async createRoom() {
    const code = randomCode();
    const { data, error } = await supabase
      .from("rooms")
      .insert({ code, host_id: this.profile.id, status: "LOBBY" })
      .select()
      .single();
    if (error) throw error;
    await this.joinRoom(data.code);
    return this.room;
  }

  async joinRoom(code) {
    const normalized = String(code).trim().toUpperCase();
    const { data: room, error } = await supabase.from("rooms").select("*").eq("code", normalized).single();
    if (error) throw new Error("Room was not found.");
    const { error: joinError } = await supabase.from("room_members").upsert({ room_id: room.id, user_id: this.profile.id, ready: false });
    if (joinError) throw joinError;
    this.room = room;
    await this.subscribe();
    await this.refresh();
    return this.room;
  }

  async subscribe() {
    await this.channel?.unsubscribe();
    this.channel = supabase.channel(`room:${this.room.id}`, { config: { presence: { key: this.profile.id } } });
    this.channel
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${this.room.id}` }, () => this.refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${this.room.id}` }, () => this.refresh())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${this.room.id}` }, () => this.refresh());
    await this.channel.subscribe(async status => {
      if (status === "SUBSCRIBED") await this.channel.track({ displayName: this.profile.displayName, onlineAt: new Date().toISOString() });
    });
  }

  async refresh() {
    const [{ data: members }, { data: messages }, { data: room }] = await Promise.all([
      supabase.from("room_members").select("ready, user_id, profiles!inner(id,display_name,login_id,role,title)").eq("room_id", this.room.id),
      supabase.from("room_messages").select("id,content,created_at,user_id,profiles!inner(display_name,role,title)").eq("room_id", this.room.id).order("created_at").limit(100),
      supabase.from("rooms").select("*").eq("id", this.room.id).single()
    ]);
    this.room = {
      ...room,
      players: (members || []).map(item => ({ id: item.profiles.id, displayName: item.profiles.display_name, role: item.profiles.role, title: item.profiles.title, ready: item.ready })),
      messages: (messages || []).map(item => ({ id: item.id, userId: item.user_id, displayName: item.profiles.display_name, role: item.profiles.role, content: item.content, createdAt: item.created_at }))
    };
    this.dispatchEvent(new CustomEvent("update", { detail: this.room }));
  }

  async toggleReady() {
    const current = this.room.players.find(player => player.id === this.profile.id)?.ready || false;
    const { error } = await supabase.from("room_members").update({ ready: !current }).eq("room_id", this.room.id).eq("user_id", this.profile.id);
    if (error) throw error;
  }

  async sendMessage(content) {
    const clean = String(content || "").trim().slice(0, 120);
    if (!clean) return;
    const { error } = await supabase.from("room_messages").insert({ room_id: this.room.id, user_id: this.profile.id, content: clean });
    if (error) throw error;
  }

  async leaveRoom() {
    if (!this.room) return;
    await supabase.from("room_members").delete().eq("room_id", this.room.id).eq("user_id", this.profile.id);
    await this.channel?.unsubscribe();
    this.room = null;
  }
}

export const LocalLobbyService = OnlineLobbyService;
