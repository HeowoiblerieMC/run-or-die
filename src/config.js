export const APP_NAME = "RUN FOR LIVE";

export const HUB_CONFIG = Object.freeze({
    targetFps: 60,
    maxPixelRatio: 1.5,
    mobileMaxPixelRatio: 1,
    farPlane: 130,
    fogNear: 36,
    fogFar: 105,
    movementSpeed: 6,
    sprintSpeed: 10,
    interactionDistance: 4.2
});

export const LEADERBOARD_CATEGORIES = Object.freeze([
    { key: "wins", title: "WIN LEADS", unit: "Wins", limit: 10 },
    { key: "captures", title: "CAPTURE LEADS", unit: "Captures", limit: 10 },
    { key: "escapes", title: "ESCAPE LEADS", unit: "Escapes", limit: 10 },
    { key: "rank_gifts_sent", title: "RANK GIFTED LEADS", unit: "Gifts", limit: 5 }
]);

export const NPC_NAMES = Object.freeze([
    "Alice", "Alex", "Olivia", "Ethan", "Ruby", "Mason", "Grace", "Liam",
    "Maya", "Noah", "Sophie", "Henry", "Oscar", "Chloe", "Lucas", "Ella",
    "Jack", "Avery", "Ivy", "Leo", "Zoe", "Miles", "Nora", "Caleb",
    "Sadie", "Finn", "Hazel", "Theo", "Luna", "Rowan", "Jade", "Arlo"
]);
