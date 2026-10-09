import { createClient } from "@supabase/supabase-js";
const url=String(import.meta.env.VITE_SUPABASE_URL||"").trim().replace(/\/$/,"");
const key=String(import.meta.env.VITE_SUPABASE_ANON_KEY||"").trim();
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) throw new Error("VITE_SUPABASE_URL is missing or invalid.");
if(!key) throw new Error("VITE_SUPABASE_ANON_KEY is missing.");
export const supabase=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},realtime:{params:{eventsPerSecond:10}}});
export async function testConnection(){
 try{const response=await fetch(`${url}/auth/v1/health`,{headers:{apikey:key}});if(!response.ok)throw new Error(`HTTP ${response.status}`);return true}
 catch(error){throw new Error("Cannot connect to the account server. Check the Supabase URL, publishable key, and GitHub Actions secrets.")}
}
