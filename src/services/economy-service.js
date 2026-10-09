import { supabase } from "../supabase.js";

export const RANKS = Object.freeze({
    PLAYER: { label: "Player", className: "player", price: 0 },
    PLUS: { label: "Plus", className: "plus", price: 5000 },
    GOOD: { label: "Good", className: "good", price: 15000 },
    GOOD_PLUS: { label: "Good+", className: "good-plus", price: 35000 },
    VIP: { label: "VIP", className: "vip", price: 75000 },
    VIP_PLUS: { label: "VIP+", className: "vip-plus", price: 150000 },
    MVP: { label: "MVP", className: "mvp", price: 300000 },
    MVP_PLUS: { label: "MVP+", className: "mvp-plus", price: 600000 },
    PRO: { label: "Pro", className: "pro", price: 1000000 },
    PRO_PLUS: { label: "Pro+", className: "pro-plus", price: 1750000 },
    KING: { label: "King", className: "king", price: 3000000 },
    CHAMPION: { label: "Champion", className: "champion", price: 30000 }
});

export const rankForProfile = profile => {
    if (profile.role === "ADMIN") return { label: "Admin", className: "admin" };
    if (profile.role === "MODERATOR") return { label: "Mod", className: "mod" };
    return RANKS[profile.selectedRank] || RANKS.PLAYER;
};

export class EconomyService {
    async getMine(profile) {
        if (profile.guest) return { coins: 0, ownedRanks: ["PLAYER"], selectedRank: "PLAYER" };
        const { data, error } = await supabase.rpc("get_my_economy");
        if (error) throw error;
        return {
            coins: Number(data.coins),
            ownedRanks: data.owned_chat_ranks || ["PLAYER"],
            selectedRank: data.selected_chat_rank || "PLAYER"
        };
    }

    async gift(target, rankId) {
        const { data, error } = await supabase.rpc("gift_rank", {
            p_target: target,
            p_rank_id: rankId
        });
        if (error) throw new Error(error.message);
        return data;
    }
}
