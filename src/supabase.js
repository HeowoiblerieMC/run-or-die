import { createClient } from "@supabase/supabase-js";

const supabaseUrl = String(
    import.meta.env.VITE_SUPABASE_URL || ""
)
    .trim()
    .replace(/\/+$/, "");

const supabaseKey = String(
    import.meta.env.VITE_SUPABASE_ANON_KEY || ""
).trim();

if (!supabaseUrl) {
    throw new Error(
        "VITE_SUPABASE_URL is not configured in GitHub Actions."
    );
}

if (!supabaseKey) {
    throw new Error(
        "VITE_SUPABASE_ANON_KEY is not configured in GitHub Actions."
    );
}

export const supabase = createClient(
    supabaseUrl,
    supabaseKey,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        },
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        }
    }
);
