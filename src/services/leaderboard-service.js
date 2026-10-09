import { supabase } from "../supabase.js";

export class LeaderboardService {
    async load(category, limit, profile) {
        const { data, error } = await supabase.rpc("get_leaderboard", {
            p_category: category,
            p_limit: limit,
            p_viewer: profile.guest ? null : profile.id
        });
        if (error) throw error;
        return data;
    }
}
