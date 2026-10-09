import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
        "Supabase connection settings are missing. " +
        "Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
    );
}

export const supabase = createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        },
        realtime: {
            params: {
                eventsPerSecond: 12
            }
        }
    }
);
