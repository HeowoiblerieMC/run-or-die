const ECONOMY_KEY =
    "runForLiveEconomyV1";

const ADMIN_LOG_KEY =
    "runForLiveAdminLogsV1";

export const RANK_DRAW_PRICE =
    40000;

export const CHAMPION_PRICE =
    30000;

export const CHAMPION_DURATION =
    30 *
    24 *
    60 *
    60 *
    1000;

export const CHAT_RANKS = [
    {
        id: "PLUS",
        label: "Plus",
        className: "plus",
        color: "#ffe34d",
        price: 500,
        drawWeight: 32
    },
    {
        id: "GOOD",
        label: "Good",
        className: "good",
        color: "#ff9f32",
        price: 1200,
        drawWeight: 26
    },
    {
        id: "GOOD_PLUS",
        label: "Good+",
        className: "good-plus",
        color: "#ff7a21",
        price: 2500,
        drawWeight: 15
    },
    {
        id: "VIP",
        label: "VIP",
        className: "vip",
        color: "#a8e85c",
        price: 5000,
        drawWeight: 9
    },
    {
        id: "VIP_PLUS",
        label: "VIP+",
        className: "vip-plus",
        color: "#78e34e",
        price: 9000,
        drawWeight: 6
    },
    {
        id: "MVP",
        label: "MVP",
        className: "mvp",
        color: "#62d5ff",
        price: 15000,
        drawWeight: 4
    },
    {
        id: "MVP_PLUS",
        label: "MVP+",
        className: "mvp-plus",
        color: "#36bfff",
        price: 25000,
        drawWeight: 3
    },
    {
        id: "PRO",
        label: "Pro",
        className: "pro",
        color: "#ff74c8",
        price: 40000,
        drawWeight: 2.2
    },
    {
        id: "PRO_PLUS",
        label: "Pro+",
        className: "pro-plus",
        color: "#ff42ae",
        price: 65000,
        drawWeight: 1.3
    },
    {
        id: "KING",
        label: "King",
        className: "king",
        color: "#ba78ff",
        price: 100000,
        drawWeight: 0.9
    },
    {
        id: "CHAMPION",
        label: "Champion",
        className: "champion",
        color: "#ffd700",
        price: null,
        drawWeight: 0.6,
        temporary: true
    }
];

function createDefaultEconomy() {
    return {
        coins: 0,

        ownedChatRanks: [
            "PLAYER"
        ],

        selectedChatRank:
            "PLAYER",

        giftInventory: {},

        championExpiresAt:
            0,

        totalCoinsEarned:
            0,

        totalCoinsSpent:
            0
    };
}

function normalizeEconomy(
    economy
) {
    const result = {
        ...createDefaultEconomy(),
        ...economy
    };

    if (
        !Array.isArray(
            result.ownedChatRanks
        )
    ) {
        result.ownedChatRanks = [
            "PLAYER"
        ];
    }

    if (
        !result.ownedChatRanks.includes(
            "PLAYER"
        )
    ) {
        result.ownedChatRanks.unshift(
            "PLAYER"
        );
    }

    if (
        !result.giftInventory ||
        typeof result.giftInventory !==
            "object"
    ) {
        result.giftInventory = {};
    }

    result.coins =
        Math.max(
            0,
            Math.floor(
                Number(
                    result.coins
                ) || 0
            )
        );

    result.championExpiresAt =
        Number(
            result.championExpiresAt
        ) || 0;

    return result;
}

function loadEconomyDatabase() {
    try {
        const value =
            JSON.parse(
                localStorage.getItem(
                    ECONOMY_KEY
                ) || "{}"
            );

        return (
            value &&
            typeof value === "object"
                ? value
                : {}
        );
    } catch {
        return {};
    }
}

function saveEconomyDatabase(
    database
) {
    localStorage.setItem(
        ECONOMY_KEY,
        JSON.stringify(
            database
        )
    );
}

function getEconomyId(
    profile
) {
    if (
        profile?.id
    ) {
        return profile.id;
    }

    if (
        profile?.loginId
    ) {
        return (
            "login:" +
            profile.loginId
                .trim()
                .toLowerCase()
        );
    }

    return (
        "display:" +
        (
            profile?.displayName ||
            "Player"
        )
            .trim()
            .toLowerCase()
    );
}

export function getEconomy(
    profile
) {
    const database =
        loadEconomyDatabase();

    const economyId =
        getEconomyId(
            profile
        );

    return normalizeEconomy(
        database[
            economyId
        ]
    );
}

export function saveEconomy(
    profile,
    economy
) {
    const database =
        loadEconomyDatabase();

    const economyId =
        getEconomyId(
            profile
        );

    database[
        economyId
    ] =
        normalizeEconomy(
            economy
        );

    saveEconomyDatabase(
        database
    );

    return database[
        economyId
    ];
}

export function addCoins(
    profile,
    amount,
    {
        countAsEarned = true
    } = {}
) {
    const cleanAmount =
        Math.floor(
            Number(
                amount
            )
        );

    if (
        !Number.isFinite(
            cleanAmount
        ) ||
        cleanAmount <= 0
    ) {
        throw new Error(
            "Coin amount must be greater than 0."
        );
    }

    const economy =
        getEconomy(
            profile
        );

    economy.coins +=
        cleanAmount;

    if (
        countAsEarned
    ) {
        economy.totalCoinsEarned +=
            cleanAmount;
    }

    return saveEconomy(
        profile,
        economy
    );
}

export function spendCoins(
    profile,
    amount
) {
    const cleanAmount =
        Math.floor(
            Number(
                amount
            )
        );

    if (
        !Number.isFinite(
            cleanAmount
        ) ||
        cleanAmount <= 0
    ) {
        throw new Error(
            "Invalid Coin amount."
        );
    }

    const economy =
        getEconomy(
            profile
        );

    if (
        economy.coins <
        cleanAmount
    ) {
        throw new Error(
            `You need ${
                cleanAmount -
                economy.coins
            } more Coins.`
        );
    }

    economy.coins -=
        cleanAmount;

    economy.totalCoinsSpent +=
        cleanAmount;

    return saveEconomy(
        profile,
        economy
    );
}

export function getRankById(
    rankId
) {
    return (
        CHAT_RANKS.find(
            rank =>
                rank.id ===
                rankId
        ) ||
        null
    );
}

export function hasActiveChampion(
    economy
) {
    return (
        Number(
            economy
                .championExpiresAt
        ) >
        Date.now()
    );
}

export function getSelectedRank(
    profile
) {
    const economy =
        getEconomy(
            profile
        );

    if (
        economy
            .selectedChatRank ===
            "CHAMPION" &&
        !hasActiveChampion(
            economy
        )
    ) {
        economy.selectedChatRank =
            economy
                .ownedChatRanks
                .includes(
                    "KING"
                )
                ? "KING"
                : "PLAYER";

        saveEconomy(
            profile,
            economy
        );
    }

    if (
        economy
            .selectedChatRank ===
            "PLAYER"
    ) {
        return {
            id: "PLAYER",
            label: "Player",
            className: "player",
            color: "#ffffff"
        };
    }

    return (
        getRankById(
            economy
                .selectedChatRank
        ) || {
            id: "PLAYER",
            label: "Player",
            className: "player",
            color: "#ffffff"
        }
    );
}

export function getNextPurchasableRank(
    profile
) {
    const economy =
        getEconomy(
            profile
        );

    const permanentRanks =
        CHAT_RANKS.filter(
            rank =>
                !rank.temporary
        );

    return (
        permanentRanks.find(
            rank =>
                !economy
                    .ownedChatRanks
                    .includes(
                        rank.id
                    )
        ) ||
        null
    );
}

export function buyNextRank(
    profile
) {
    if (
        profile?.role ===
        "GUEST"
    ) {
        throw new Error(
            "Guest accounts cannot purchase ranks."
        );
    }

    const economy =
        getEconomy(
            profile
        );

    const nextRank =
        getNextPurchasableRank(
            profile
        );

    if (
        !nextRank
    ) {
        throw new Error(
            "You already own every permanent rank."
        );
    }

    if (
        economy.coins <
        nextRank.price
    ) {
        throw new Error(
            `You need ${
                nextRank.price -
                economy.coins
            } more Coins.`
        );
    }

    economy.coins -=
        nextRank.price;

    economy.totalCoinsSpent +=
        nextRank.price;

    economy
        .ownedChatRanks
        .push(
            nextRank.id
        );

    economy.selectedChatRank =
        nextRank.id;

    saveEconomy(
        profile,
        economy
    );

    return {
        rank: nextRank,
        economy
    };
}

export function buyChampion(
    profile
) {
    if (
        profile?.role ===
        "GUEST"
    ) {
        throw new Error(
            "Guest accounts cannot activate Champion."
        );
    }

    const economy =
        getEconomy(
            profile
        );

    if (
        !economy
            .ownedChatRanks
            .includes(
                "KING"
            )
    ) {
        throw new Error(
            "You must own King first."
        );
    }

    if (
        economy.coins <
        CHAMPION_PRICE
    ) {
        throw new Error(
            `You need ${
                CHAMPION_PRICE -
                economy.coins
            } more Coins.`
        );
    }

    economy.coins -=
        CHAMPION_PRICE;

    economy.totalCoinsSpent +=
        CHAMPION_PRICE;

    const extensionStart =
        Math.max(
            Date.now(),
            Number(
                economy
                    .championExpiresAt
            ) || 0
        );

    economy.championExpiresAt =
        extensionStart +
        CHAMPION_DURATION;

    economy.selectedChatRank =
        "CHAMPION";

    saveEconomy(
        profile,
        economy
    );

    return economy;
}

export function equipRank(
    profile,
    rankId
) {
    const economy =
        getEconomy(
            profile
        );

    if (
        rankId ===
        "PLAYER"
    ) {
        economy.selectedChatRank =
            "PLAYER";

        return saveEconomy(
            profile,
            economy
        );
    }

    if (
        rankId ===
        "CHAMPION"
    ) {
        if (
            !hasActiveChampion(
                economy
            )
        ) {
            throw new Error(
                "Champion is not active."
            );
        }

        economy.selectedChatRank =
            "CHAMPION";

        return saveEconomy(
            profile,
            economy
        );
    }

    if (
        !economy
            .ownedChatRanks
            .includes(
                rankId
            )
    ) {
        throw new Error(
            "You do not own that rank."
        );
    }

    economy.selectedChatRank =
        rankId;

    return saveEconomy(
        profile,
        economy
    );
}

function selectDrawRank() {
    const roll =
        Math.random() *
        100;

    let total =
        0;

    for (
        const rank of
        CHAT_RANKS
    ) {
        total +=
            rank.drawWeight;

        if (
            roll <
            total
        ) {
            return rank;
        }
    }

    return CHAT_RANKS[
        CHAT_RANKS.length -
        1
    ];
}

export function drawRank(
    profile
) {
    if (
        profile?.role ===
        "GUEST"
    ) {
        throw new Error(
            "Guest accounts cannot use Rank Draw."
        );
    }

    const economy =
        getEconomy(
            profile
        );

    if (
        economy.coins <
        RANK_DRAW_PRICE
    ) {
        throw new Error(
            `You need ${
                RANK_DRAW_PRICE -
                economy.coins
            } more Coins.`
        );
    }

    economy.coins -=
        RANK_DRAW_PRICE;

    economy.totalCoinsSpent +=
        RANK_DRAW_PRICE;

    const rank =
        selectDrawRank();

    let resultType =
        "OWNED";

    if (
        rank.id ===
        "CHAMPION"
    ) {
        resultType =
            "CHAMPION_PASS";

        economy.giftInventory[
            "CHAMPION"
        ] =
            (
                economy
                    .giftInventory[
                    "CHAMPION"
                ] ||
                0
            ) +
            1;
    } else if (
        economy
            .ownedChatRanks
            .includes(
                rank.id
            )
    ) {
        resultType =
            "GIFT";

        economy.giftInventory[
            rank.id
        ] =
            (
                economy
                    .giftInventory[
                    rank.id
                ] ||
                0
            ) +
            1;
    } else {
        const rankIndex =
            CHAT_RANKS.findIndex(
                item =>
                    item.id ===
                    rank.id
            );

        for (
            let index = 0;
            index <= rankIndex;
            index += 1
        ) {
            const unlocked =
                CHAT_RANKS[
                    index
                ];

            if (
                unlocked.temporary
            ) {
                continue;
            }

            if (
                !economy
                    .ownedChatRanks
                    .includes(
                        unlocked.id
                    )
            ) {
                economy
                    .ownedChatRanks
                    .push(
                        unlocked.id
                    );
            }
        }

        economy.selectedChatRank =
            rank.id;
    }

    saveEconomy(
        profile,
        economy
    );

    return {
        rank,
        resultType,
        economy
    };
}

export function giftRank(
    senderProfile,
    recipientProfile,
    rankId
) {
    const senderEconomy =
        getEconomy(
            senderProfile
        );

    const giftCount =
        Number(
            senderEconomy
                .giftInventory[
                rankId
            ]
        ) ||
        0;

    if (
        giftCount <= 0
    ) {
        throw new Error(
            "You do not own that gift."
        );
    }

    senderEconomy
        .giftInventory[
            rankId
        ] -= 1;

    saveEconomy(
        senderProfile,
        senderEconomy
    );

    const recipientEconomy =
        getEconomy(
            recipientProfile
        );

    if (
        rankId ===
        "CHAMPION"
    ) {
        const extensionStart =
            Math.max(
                Date.now(),
                Number(
                    recipientEconomy
                        .championExpiresAt
                ) ||
                0
            );

        recipientEconomy.championExpiresAt =
            extensionStart +
            CHAMPION_DURATION;

        recipientEconomy.selectedChatRank =
            "CHAMPION";
    } else {
        if (
            !recipientEconomy
                .ownedChatRanks
                .includes(
                    rankId
                )
        ) {
            recipientEconomy
                .ownedChatRanks
                .push(
                    rankId
                );
        }

        recipientEconomy.selectedChatRank =
            rankId;
    }

    saveEconomy(
        recipientProfile,
        recipientEconomy
    );

    return {
        senderEconomy,
        recipientEconomy,
        rank:
            getRankById(
                rankId
            )
    };
}

function loadAdminLogs() {
    try {
        const value =
            JSON.parse(
                localStorage.getItem(
                    ADMIN_LOG_KEY
                ) || "[]"
            );

        return Array.isArray(
            value
        )
            ? value
            : [];
    } catch {
        return [];
    }
}

function saveAdminLog(
    entry
) {
    const logs =
        loadAdminLogs();

    logs.push(
        entry
    );

    localStorage.setItem(
        ADMIN_LOG_KEY,
        JSON.stringify(
            logs.slice(
                -500
            )
        )
    );
}

export function getAdminLogs(
    profile
) {
    if (
        profile?.role !==
        "ADMIN"
    ) {
        throw new Error(
            "Admin permission required."
        );
    }

    return loadAdminLogs();
}

export function executeAdminCoinCommand({
    executor,
    command,
    profiles
}) {
    if (
        executor?.role !==
        "ADMIN"
    ) {
        throw new Error(
            "You do not have permission to use this command."
        );
    }

    const match =
        command
            .trim()
            .match(
                /^\/coin\s+give\s+(\S+)\s+(\d+)$/i
            );

    if (
        !match
    ) {
        throw new Error(
            "Usage: /coin give <name> <amount>"
        );
    }

    const targetName =
        match[
            1
        ]
            .trim()
            .toLowerCase();

    const amount =
        Math.floor(
            Number(
                match[
                    2
                ]
            )
        );

    if (
        !Number.isSafeInteger(
            amount
        ) ||
        amount <= 0
    ) {
        throw new Error(
            "Amount must be a positive whole number."
        );
    }

    const maximumAmount =
        10000000;

    if (
        amount >
        maximumAmount
    ) {
        throw new Error(
            `Maximum amount per command is ${maximumAmount.toLocaleString()} Coins.`
        );
    }

    const possibleTargets =
        profiles.filter(
            profile => {
                const displayName =
                    (
                        profile
                            .displayName ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                const loginId =
                    (
                        profile
                            .loginId ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                const profileId =
                    (
                        profile.id ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                return (
                    displayName ===
                        targetName ||
                    loginId ===
                        targetName ||
                    profileId ===
                        targetName
                );
            }
        );

    if (
        possibleTargets.length ===
        0
    ) {
        throw new Error(
            "Player or NPC was not found."
        );
    }

    if (
        possibleTargets.length >
        1
    ) {
        throw new Error(
            "Multiple targets use that name. Use a login ID or unique ID."
        );
    }

    const target =
        possibleTargets[
            0
        ];

    const before =
        getEconomy(
            target
        ).coins;

    const targetEconomy =
        addCoins(
            target,
            amount,
            {
                countAsEarned:
                    false
            }
        );

    /*
     * Important:
     * The executor's balance is never reduced.
     * These Coins are generated by the System.
     */

    saveAdminLog({
        id:
            crypto.randomUUID(),

        action:
            "COIN_GIVE",

        executorId:
            executor.id,

        executorName:
            executor.displayName,

        targetId:
            target.id,

        targetName:
            target.displayName,

        amount,

        source:
            "SYSTEM",

        executorBalanceDeducted:
            false,

        targetBalanceBefore:
            before,

        targetBalanceAfter:
            targetEconomy.coins,

        createdAt:
            new Date()
                .toISOString()
    });

    return {
        target,
        amount,
        economy:
            targetEconomy,

        message:
            `${amount.toLocaleString()} Coins were given to ${target.displayName}.`
    };
}
