export const HUB_CONFIG =
    Object.freeze({
        movementSpeed:
            6,

        sprintSpeed:
            10,

        interactionDistance:
            5,

        farPlane:
            150,

        maxPixelRatio:
            1.5,

        mobileMaxPixelRatio:
            1
    });

export const LEADERBOARD_CATEGORIES =
    Object.freeze([
        {
            key:
                "wins",

            title:
                "WIN LEADS",

            unit:
                "Wins",

            limit:
                10
        },

        {
            key:
                "captures",

            title:
                "CAPTURE LEADS",

            unit:
                "Captures",

            limit:
                10
        },

        {
            key:
                "escapes",

            title:
                "ESCAPE LEADS",

            unit:
                "Escapes",

            limit:
                10
        },

        {
            key:
                "rank_gifts_sent",

            title:
                "RANK GIFTED LEADS",

            unit:
                "Gifts",

            limit:
                5
        }
    ]);
