import {
    createClient
} from "@supabase/supabase-js";

const supabaseUrl =
    "YOUR_SUPABASE_PROJECT_URL";

const supabasePublishableKey =
    "YOUR_SUPABASE_PUBLISHABLE_KEY";

if (
    !supabaseUrl.startsWith(
        "https://"
    ) ||
    !supabaseUrl.endsWith(
        ".supabase.co"
    )
) {
    throw new Error(
        "The Supabase Project URL is invalid."
    );
}

if (
    !supabasePublishableKey.startsWith(
        "sb_publishable_"
    )
) {
    throw new Error(
        "The Supabase Publishable Key is invalid."
    );
}

export const supabase =
    createClient(
        supabaseUrl,
        supabasePublishableKey,
        {
            auth: {
                persistSession:
                    true,

                autoRefreshToken:
                    true,

                detectSessionInUrl:
                    true
            },

            realtime: {
                params: {
                    eventsPerSecond:
                        10
                }
            }
        }
    );
