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
        "VITE_SUPABASE_URL is missing. Check GitHub Actions secrets."
    );
}

if (!supabaseKey) {
    throw new Error(
        "VITE_SUPABASE_ANON_KEY is missing. Check GitHub Actions secrets."
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

export async function testSupabaseConnection() {
    try {
        const { error } = await supabase
            .from("profiles")
            .select("id")
            .limit(1);

        if (
            error &&
            error.code !== "PGRST116" &&
            error.code !== "42501"
        ) {
            throw error;
        }

        return true;
    } catch (error) {
        const message = String(
            error?.message || error || ""
        );

        if (
            message.includes("Load failed") ||
            message.includes("Failed to fetch") ||
            message.includes("NetworkError")
        ) {
            throw new Error(
                "Cannot connect to Supabase. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
            );
        }

        throw error;
    }
}
