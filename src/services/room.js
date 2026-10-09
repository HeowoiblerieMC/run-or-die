import { supabase } from "../supabase.js";
const code=()=>Array.from(crypto.getRandomValues(new Uint8Array(6)),v=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[v%32]).join("");
export class RoomService{
 async create(profile){const {data,error}=await supabase.from("rooms").insert({code:code(),host_id:profile.id,status:"LOBBY"}).select().single();if(error)throw error;await this.join(profile,data.code);return data}
 async join(profile,value){const {data:room,error}=await supabase.from("rooms").select("*").eq("code",String(value).trim().toUpperCase()).single();if(error)throw new Error("Room not found.");const {error:e}=await supabase.from("room_members").upsert({room_id:room.id,user_id:profile.id,ready:false});if(e)throw e;return room}
}
