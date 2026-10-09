import {
    createClient
} from "@supabase/supabase-js";

const supabaseUrl =
    "https://huccrznjxojesuogpvvu.supabase.co";

const supabasePublishableKey =
    "sb_publishable_2ARCKPN50s8meTVnL0haOA_PPGeNu0a";

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
