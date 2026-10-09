import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !publishableKey) {
    throw new Error("Missing Supabase environment variables.");
}

export const supabase = createClient(url, publishableKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    },
    realtime: {
        params: { eventsPerSecond: 10 }
    }
});
