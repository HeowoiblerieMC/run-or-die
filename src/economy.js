const ECONOMY_KEY = "runForLiveEconomyV2";
const ADMIN_LOG_KEY = "runForLiveAdminLogsV1";

export const RANK_DRAW_PRICE = 40000;
export const CHAMPION_PRICE = 30000;
export const CHAMPION_DURATION = 30 * 24 * 60 * 60 * 1000;

export const CHAT_RANKS = [
    { id: "PLUS", label: "Plus", className: "plus", color: "#ffe34d", price: 5000, drawWeight: 32 },
    { id: "GOOD", label: "Good", className: "good", color: "#ff9f32", price: 15000, drawWeight: 26 },
    { id: "GOOD_PLUS", label: "Good+", className: "good-plus", color: "#ff7a21", price: 35000, drawWeight: 15 },
    { id: "VIP", label: "VIP", className: "vip", color: "#a8e85c", price: 75000, drawWeight: 9 },
    { id: "VIP_PLUS", label: "VIP+", className: "vip-plus", color: "#78e34e", price: 150000, drawWeight: 6 },
    { id: "MVP", label: "MVP", className: "mvp", color: "#62d5ff", price: 300000, drawWeight: 4 },
    { id: "MVP_PLUS", label: "MVP+", className: "mvp-plus", color: "#36bfff", price: 600000, drawWeight: 3 },
    { id: "PRO", label: "Pro", className: "pro", color: "#ff74c8", price: 1000000, drawWeight: 2.2 },
    { id: "PRO_PLUS", label: "Pro+", className: "pro-plus", color: "#ff42ae", price: 1750000, drawWeight: 1.3 },
    { id: "KING", label: "King", className: "king", color: "#ba78ff", price: 3000000, drawWeight: 0.9 },
    { id: "CHAMPION", label: "Champion", className: "champion", color: "#ffd700", price: null, drawWeight: 0.6, temporary: true }
];

function defaultEconomy() {
    return {
        coins: 0,
        ownedChatRanks: ["PLAYER"],
        selectedChatRank: "PLAYER",
        giftInventory: {},
        championExpiresAt: 0,
        totalCoinsEarned: 0,
        totalCoinsSpent: 0
    };
}

function normalizeEconomy(value) {
    const result = { ...defaultEconomy(), ...(value || {}) };
    if (!Array.isArray(result.ownedChatRanks)) result.ownedChatRanks = ["PLAYER"];
    if (!result.ownedChatRanks.includes("PLAYER")) result.ownedChatRanks.unshift("PLAYER");
    if (!result.giftInventory || typeof result.giftInventory !== "object") result.giftInventory = {};
    result.coins = Math.max(0, Math.floor(Number(result.coins) || 0));
    result.championExpiresAt = Number(result.championExpiresAt) || 0;
    result.totalCoinsEarned = Math.max(0, Math.floor(Number(result.totalCoinsEarned) || 0));
    result.totalCoinsSpent = Math.max(0, Math.floor(Number(result.totalCoinsSpent) || 0));
    return result;
}

function loadDatabase() {
    try {
        const value = JSON.parse(localStorage.getItem(ECONOMY_KEY) || "{}");
        return value && typeof value === "object" ? value : {};
    } catch {
        return {};
    }
}

function saveDatabase(database) {
    localStorage.setItem(ECONOMY_KEY, JSON.stringify(database));
}

function economyId(profile) {
    if (profile?.id) return String(profile.id);
    if (profile?.loginId) return `login:${String(profile.loginId).trim().toLowerCase()}`;
    return `display:${String(profile?.displayName || "Player").trim().toLowerCase()}`;
}

export function getEconomy(profile) {
    const database = loadDatabase();
    return normalizeEconomy(database[economyId(profile)]);
}

export function saveEconomy(profile, economy) {
    const database = loadDatabase();
    database[economyId(profile)] = normalizeEconomy(economy);
    saveDatabase(database);
    return database[economyId(profile)];
}

export function addCoins(profile, amount, { countAsEarned = true } = {}) {
    const cleanAmount = Math.floor(Number(amount));
    if (!Number.isSafeInteger(cleanAmount) || cleanAmount <= 0) {
        throw new Error("Coin amount must be a positive whole number.");
    }
    const economy = getEconomy(profile);
    economy.coins += cleanAmount;
    if (countAsEarned) economy.totalCoinsEarned += cleanAmount;
    return saveEconomy(profile, economy);
}

export function spendCoins(profile, amount) {
    const cleanAmount = Math.floor(Number(amount));
    if (!Number.isSafeInteger(cleanAmount) || cleanAmount <= 0) {
        throw new Error("Invalid Coin amount.");
    }
    const economy = getEconomy(profile);
    if (economy.coins < cleanAmount) {
        throw new Error(`You need ${(cleanAmount - economy.coins).toLocaleString()} more Coins.`);
    }
    economy.coins -= cleanAmount;
    economy.totalCoinsSpent += cleanAmount;
    return saveEconomy(profile, economy);
}

export function getRankById(rankId) {
    return CHAT_RANKS.find(rank => rank.id === rankId) || null;
}

function normalizeRankName(value) {
    const compact = String(value || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "")
        .replace(/\+/g, "_PLUS");
    return compact.replace(/__+/g, "_");
}

export function getRankByName(value) {
    const normalized = normalizeRankName(value);
    return CHAT_RANKS.find(rank => rank.id === normalized) || null;
}

export function hasActiveChampion(economy) {
    return Number(economy.championExpiresAt) > Date.now();
}

export function getSelectedRank(profile) {
    const economy = getEconomy(profile);
    if (economy.selectedChatRank === "CHAMPION" && !hasActiveChampion(economy)) {
        economy.selectedChatRank = economy.ownedChatRanks.includes("KING") ? "KING" : "PLAYER";
        saveEconomy(profile, economy);
    }
    if (economy.selectedChatRank === "PLAYER") {
        return { id: "PLAYER", label: "Player", className: "player", color: "#ffffff" };
    }
    return getRankById(economy.selectedChatRank) || {
        id: "PLAYER",
        label: "Player",
        className: "player",
        color: "#ffffff"
    };
}

export function getNextPurchasableRank(profile) {
    const economy = getEconomy(profile);
    return CHAT_RANKS
        .filter(rank => !rank.temporary)
        .find(rank => !economy.ownedChatRanks.includes(rank.id)) || null;
}

export function buyNextRank(profile) {
    if (profile?.role === "GUEST") throw new Error("Guest accounts cannot purchase ranks.");
    const economy = getEconomy(profile);
    const rank = getNextPurchasableRank(profile);
    if (!rank) throw new Error("You already own every permanent rank.");
    if (economy.coins < rank.price) {
        throw new Error(`You need ${(rank.price - economy.coins).toLocaleString()} more Coins.`);
    }
    economy.coins -= rank.price;
    economy.totalCoinsSpent += rank.price;
    economy.ownedChatRanks.push(rank.id);
    economy.selectedChatRank = rank.id;
    saveEconomy(profile, economy);
    return { rank, economy };
}

export function buyChampion(profile) {
    if (profile?.role === "GUEST") throw new Error("Guest accounts cannot activate Champion.");
    const economy = getEconomy(profile);
    if (!economy.ownedChatRanks.includes("KING")) throw new Error("You must own King first.");
    if (economy.coins < CHAMPION_PRICE) {
        throw new Error(`You need ${(CHAMPION_PRICE - economy.coins).toLocaleString()} more Coins.`);
    }
    economy.coins -= CHAMPION_PRICE;
    economy.totalCoinsSpent += CHAMPION_PRICE;
    economy.championExpiresAt = Math.max(Date.now(), economy.championExpiresAt) + CHAMPION_DURATION;
    economy.selectedChatRank = "CHAMPION";
    return saveEconomy(profile, economy);
}

export function equipRank(profile, rankId) {
    const economy = getEconomy(profile);
    if (rankId === "PLAYER") {
        economy.selectedChatRank = "PLAYER";
        return saveEconomy(profile, economy);
    }
    if (rankId === "CHAMPION") {
        if (!hasActiveChampion(economy)) throw new Error("Champion is not active.");
        economy.selectedChatRank = "CHAMPION";
        return saveEconomy(profile, economy);
    }
    if (!economy.ownedChatRanks.includes(rankId)) throw new Error("You do not own that rank.");
    economy.selectedChatRank = rankId;
    return saveEconomy(profile, economy);
}

function selectDrawRank() {
    const roll = Math.random() * 100;
    let total = 0;
    for (const rank of CHAT_RANKS) {
        total += rank.drawWeight;
        if (roll < total) return rank;
    }
    return CHAT_RANKS[CHAT_RANKS.length - 1];
}

export function drawRank(profile) {
    if (profile?.role === "GUEST") throw new Error("Guest accounts cannot use Rank Draw.");
    const economy = getEconomy(profile);
    if (economy.coins < RANK_DRAW_PRICE) {
        throw new Error(`You need ${(RANK_DRAW_PRICE - economy.coins).toLocaleString()} more Coins.`);
    }
    economy.coins -= RANK_DRAW_PRICE;
    economy.totalCoinsSpent += RANK_DRAW_PRICE;
    const rank = selectDrawRank();
    let resultType = "OWNED";

    if (rank.id === "CHAMPION") {
        resultType = "CHAMPION_PASS";
        economy.giftInventory.CHAMPION = (economy.giftInventory.CHAMPION || 0) + 1;
    } else if (economy.ownedChatRanks.includes(rank.id)) {
        resultType = "GIFT";
        economy.giftInventory[rank.id] = (economy.giftInventory[rank.id] || 0) + 1;
    } else {
        const rankIndex = CHAT_RANKS.findIndex(item => item.id === rank.id);
        for (let index = 0; index <= rankIndex; index += 1) {
            const unlocked = CHAT_RANKS[index];
            if (!unlocked.temporary && !economy.ownedChatRanks.includes(unlocked.id)) {
                economy.ownedChatRanks.push(unlocked.id);
            }
        }
        economy.selectedChatRank = rank.id;
    }

    saveEconomy(profile, economy);
    return { rank, resultType, economy };
}

export function giftRank(senderProfile, recipientProfile, rankId) {
    const sender = getEconomy(senderProfile);
    const count = Number(sender.giftInventory[rankId]) || 0;
    if (count <= 0) throw new Error("You do not own that gift.");
    sender.giftInventory[rankId] -= 1;
    saveEconomy(senderProfile, sender);
    const recipient = grantRankToRecipient(recipientProfile, rankId);
    return { senderEconomy: sender, recipientEconomy: recipient, rank: getRankById(rankId) };
}

function grantRankToRecipient(recipientProfile, rankId) {
    const economy = getEconomy(recipientProfile);
    if (rankId === "CHAMPION") {
        economy.championExpiresAt = Math.max(Date.now(), economy.championExpiresAt) + CHAMPION_DURATION;
        economy.selectedChatRank = "CHAMPION";
    } else {
        if (!economy.ownedChatRanks.includes(rankId)) economy.ownedChatRanks.push(rankId);
        economy.selectedChatRank = rankId;
    }
    return saveEconomy(recipientProfile, economy);
}

function uniqueTarget(profiles, name) {
    const search = String(name).trim().toLowerCase();
    const matches = profiles.filter(profile =>
        [profile.id, profile.loginId, profile.displayName]
            .filter(Boolean)
            .some(value => String(value).trim().toLowerCase() === search)
    );
    if (!matches.length) throw new Error("Player or NPC was not found.");
    if (matches.length > 1) throw new Error("Multiple targets use that name. Use a login ID or unique ID.");
    return matches[0];
}

export function executeGiftCommand({ sender, command, profiles }) {
    if (sender?.role === "GUEST") throw new Error("Guest accounts cannot send rank gifts.");
    const match = command.trim().match(/^\/gift\s+(\S+)\s+(\S+)$/i);
    if (!match) throw new Error("Usage: /gift <name> <rank>");
    const target = uniqueTarget(profiles, match[1]);
    const rank = getRankByName(match[2]);
    if (!rank) throw new Error("Unknown rank. Example: Plus, Good+, VIP+, MVP+, Pro+, King, Champion.");
    if (target.id === sender.id) throw new Error("Use the Rank Shop to buy a rank for yourself.");

    const recipientEconomy = getEconomy(target);
    if (rank.id !== "CHAMPION" && recipientEconomy.ownedChatRanks.includes(rank.id)) {
        throw new Error(`${target.displayName} already owns [${rank.label}]. No Coins were spent.`);
    }

    const price = rank.id === "CHAMPION" ? CHAMPION_PRICE : rank.price;
    const senderEconomy = getEconomy(sender);
    if (senderEconomy.coins < price) {
        throw new Error(`You need ${(price - senderEconomy.coins).toLocaleString()} more Coins.`);
    }

    senderEconomy.coins -= price;
    senderEconomy.totalCoinsSpent += price;
    saveEconomy(sender, senderEconomy);
    const updatedRecipient = grantRankToRecipient(target, rank.id);

    return {
        target,
        rank,
        price,
        senderEconomy,
        recipientEconomy: updatedRecipient,
        message: rank.id === "CHAMPION"
            ? `Champion was activated for ${target.displayName} for 30 days. ${price.toLocaleString()} Coins were spent.`
            : `[${rank.label}] was gifted to ${target.displayName}. ${price.toLocaleString()} Coins were spent.`
    };
}

function loadAdminLogs() {
    try {
        const value = JSON.parse(localStorage.getItem(ADMIN_LOG_KEY) || "[]");
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function saveAdminLog(entry) {
    const logs = loadAdminLogs();
    logs.push(entry);
    localStorage.setItem(ADMIN_LOG_KEY, JSON.stringify(logs.slice(-500)));
}

export function getAdminLogs(profile) {
    if (profile?.role !== "ADMIN") throw new Error("Admin permission required.");
    return loadAdminLogs();
}

export function executeAdminCoinCommand({ executor, command, profiles }) {
    if (executor?.role !== "ADMIN") {
        throw new Error("You do not have permission to use this command.");
    }
    const match = command.trim().match(/^\/(?:coin\s+give|give\s+coin)\s+(\S+)\s+(\d+)$/i);
    if (!match) throw new Error("Usage: /coin give <name> <amount>");
    const amount = Math.floor(Number(match[2]));
    if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error("Amount must be a positive whole number.");
    }
    if (amount > 10000000) throw new Error("Maximum amount per command is 10,000,000 Coins.");
    const target = uniqueTarget(profiles, match[1]);
    const before = getEconomy(target).coins;
    const targetEconomy = addCoins(target, amount, { countAsEarned: false });

    saveAdminLog({
        id: crypto.randomUUID(),
        action: "COIN_GIVE",
        executorId: executor.id,
        executorName: executor.displayName,
        targetId: target.id,
        targetName: target.displayName,
        amount,
        source: "SYSTEM",
        executorBalanceDeducted: false,
        targetBalanceBefore: before,
        targetBalanceAfter: targetEconomy.coins,
        createdAt: new Date().toISOString()
    });

    return {
        target,
        amount,
        economy: targetEconomy,
        message: `${amount.toLocaleString()} Coins were given to ${target.displayName}.`
    };
}
