export const RANKS = {
    PLAYER: {
        label:
            "Player",

        className:
            "player"
    },

    PLUS: {
        label:
            "Plus",

        className:
            "plus"
    },

    GOOD: {
        label:
            "Good",

        className:
            "good"
    },

    GOOD_PLUS: {
        label:
            "Good+",

        className:
            "good-plus"
    },

    VIP: {
        label:
            "VIP",

        className:
            "vip"
    },

    VIP_PLUS: {
        label:
            "VIP+",

        className:
            "vip-plus"
    },

    MVP: {
        label:
            "MVP",

        className:
            "mvp"
    },

    MVP_PLUS: {
        label:
            "MVP+",

        className:
            "mvp-plus"
    },

    PRO: {
        label:
            "Pro",

        className:
            "pro"
    },

    PRO_PLUS: {
        label:
            "Pro+",

        className:
            "pro-plus"
    },

    KING: {
        label:
            "King",

        className:
            "king"
    }
};

export function rankForProfile(
    profile
) {
    if (
        profile.role ===
        "ADMIN"
    ) {
        return {
            label:
                "Admin",

            className:
                "admin"
        };
    }

    if (
        profile.role ===
        "MODERATOR"
    ) {
        return {
            label:
                "Mod",

            className:
                "mod"
        };
    }

    return (
        RANKS[
            profile.selectedRank
        ] ||
        RANKS.PLAYER
    );
}
