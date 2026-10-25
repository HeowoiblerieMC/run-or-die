import { supabase } from "./supabase.js";

export const RANK_DRAW_PRICE = 40000;
export const CHAMPION_PRICE = 30000;
export const CHAT_RANKS = [
  { id: "PLUS", label: "Plus", className: "plus", price: 5000, drawWeight: 32 },
  { id: "GOOD", label: "Good", className: "good", price: 15000, drawWeight: 26 },
  { id: "GOOD_PLUS", label: "Good+", className: "good-plus", price: 35000, drawWeight: 15 },
  { id: "VIP", label: "VIP", className: "vip", price: 75000, drawWeight: 9 },
  { id: "VIP_PLUS", label: "VIP+", className: "vip-plus", price: 150000, drawWeight: 6 },
  { id: "MVP", label: "MVP", className: "mvp", price: 300000, drawWeight: 4 },
  { id: "MVP_PLUS", label: "MVP+", className: "mvp-plus", price: 600000, drawWeight: 3 },
  { id: "PRO", label: "Pro", className: "pro", price: 1000000, drawWeight: 2.2 },
  { id: "PRO_PLUS", label: "Pro+", className: "pro-plus", price: 1750000, drawWeight: 1.3 },
  { id: "KING", label: "King", className: "king", price: 3000000, drawWeight: 0.9 },
  { id: "CHAMPION", label: "Champion", className: "champion", price: 30000, drawWeight: 0.6, temporary: true }
];

export const getRankById = id => CHAT_RANKS.find(rank => rank.id === id) || null;
export const getRankByName = value => {
  const id = String(value || "").trim().toUpperCase().replace(/\+/g, "_PLUS");
  return getRankById(id);
};

export async function getEconomy(profile) {
  if (profile.guest) return { coins: 0, ownedChatRanks: ["PLAYER"], selectedChatRank: "PLAYER", giftInventory: {}, championExpiresAt: 0 };
  const { data, error } = await supabase.rpc("get_my_economy");
  if (error) throw error;
  return {
    coins: Number(data.coins),
    ownedChatRanks: data.owned_chat_ranks,
    selectedChatRank: data.selected_chat_rank,
    giftInventory: data.gift_inventory || {},
    championExpiresAt: data.champion_expires_at ? Date.parse(data.champion_expires_at) : 0
  };
}

export async function getSelectedRank(profile) {
  const economy = await getEconomy(profile);
  if (economy.selectedChatRank === "PLAYER") return { id: "PLAYER", label: "Player", className: "player" };
  return getRankById(economy.selectedChatRank) || { id: "PLAYER", label: "Player", className: "player" };
}

export async function addCoins(profile, amount) {
  const { data, error } = await supabase.rpc("award_match_coins", { p_amount: Math.floor(amount) });
  if (error) throw error;
  return data;
}

export async function executeGiftCommand({ command }) {
  const match = command.trim().match(/^\/gift\s+(\S+)\s+(\S+)$/i);
  if (!match) throw new Error("Usage: /gift <name> <rank>");
  const rank = getRankByName(match[2]);
  if (!rank) throw new Error("Unknown rank.");
  const { data, error } = await supabase.rpc("purchase_rank_gift", {
    p_recipient: match[1],
    p_rank_id: rank.id
  });
  if (error) throw new Error(error.message);
  return { ...data, rank, message: data.message };
}

export async function executeAdminCoinCommand({ command }) {
  const match = command.trim().match(/^\/(?:coin\s+give|give\s+coin)\s+(\S+)\s+(\d+)$/i);
  if (!match) throw new Error("Usage: /coin give <name> <amount>");
  const { data, error } = await supabase.rpc("admin_give_coins", {
    p_recipient: match[1],
    p_amount: Number(match[2])
  });
  if (error) throw new Error(error.message);
  return { ...data, message: data.message };
}
