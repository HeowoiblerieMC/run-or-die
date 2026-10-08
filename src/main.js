import "./style.css";

import {
    Game
} from "./game.js";

import {
    AccountService,
    getChatIdentity
} from "./account.js";

import {
    LocalLobbyService
} from "./multiplayer.js";

import {
    CHAT_RANKS,
    CHAMPION_PRICE,
    RANK_DRAW_PRICE,
    buyChampion,
    buyNextRank,
    drawRank,
    equipRank,
    executeAdminCoinCommand,
    getEconomy,
    getNextPurchasableRank,
    getRankById,
    giftRank,
    hasActiveChampion
} from "./economy.js";

const app =
    document.querySelector(
        "#app"
    );

const auth =
    new AccountService();

document
    .querySelector(
        "#startup-status"
    )
    ?.remove();

let profile =
    auth.getSession();

let screen =
    null;

let game =
    null;

let lobby =
    null;

function clear() {
    screen?.remove();
    screen = null;
}

function createButton(
    text,
    primary = false
) {
    const element =
        document.createElement(
            "button"
        );

    element.type =
        "button";

    element.className =
        primary
            ? "menu-button menu-button--primary"
            : "menu-button";

    element.textContent =
        text;

    return element;
}

function createInput(
    placeholder,
    type = "text"
) {
    const element =
        document.createElement(
            "input"
        );

    element.placeholder =
        placeholder;

    element.type =
        type;

    return element;
}

function showError(
    element,
    exception
) {
    element.hidden =
        false;

    element.textContent =
        exception?.message ||
        String(
            exception
        );
}

function getIdentity(
    targetProfile
) {
    return getChatIdentity(
        targetProfile
    );
}

function getProfileTag(
    targetProfile
) {
    const identity =
        getIdentity(
            targetProfile
        );

    return (
        `<span class="role-tag role-tag--${identity.className}">` +
        `[${identity.label}]` +
        "</span>"
    );
}

function formatCoins(
    value
) {
    return (
        Math.floor(
            Number(
                value
            ) || 0
        )
            .toLocaleString() +
        " Coins"
    );
}

function getGiftRecipients() {
    const accounts =
        auth.getProfiles();

    const npcs =
        Array.from(
            {
                length:
                    1000
            },
            (
                unused,
                index
            ) => ({
                id:
                    `npc_${String(
                        index +
                        1
                    ).padStart(
                        4,
                        "0"
                    )}`,

                loginId:
                    `npc_${String(
                        index +
                        1
                    ).padStart(
                        4,
                        "0"
                    )}`,

                displayName:
                    `NOVA-${String(
                        index +
                        1
                    ).padStart(
                        3,
                        "0"
                    )}`,

                role:
                    "PLAYER",

                title:
                    null,

                npc:
                    true
            })
        );

    return [
        ...accounts,
        ...npcs
    ];
}

function landing() {
    clear();

    screen =
        document.createElement(
            "section"
        );

    screen.className =
        "title-screen";

    screen.innerHTML = `
        <div class="title-card">
            <p class="eyebrow">
                NOVA INTERACTIVE
            </p>

            <h1>
                <span>RUN</span>
                <span>FOR LIVE</span>
            </h1>

            <p class="lead">
                Restore. Run. Escape.
            </p>

            <div
                class="menu-actions"
                data-actions
            ></div>
        </div>
    `;

    const guest =
        createButton(
            "PLAY AS GUEST",
            true
        );

    const signInButton =
        createButton(
            "SIGN IN"
        );

    const registerButton =
        createButton(
            "CREATE ACCOUNT"
        );

    guest.onclick =
        () => {
            profile =
                auth.createGuest();

            home();
        };

    signInButton.onclick =
        signIn;

    registerButton.onclick =
        register;

    screen
        .querySelector(
            "[data-actions]"
        )
        .append(
            guest,
            signInButton,
            registerButton
        );

    app.appendChild(
        screen
    );
}

function createPanel(
    title,
    backAction =
        landing
) {
    clear();

    screen =
        document.createElement(
            "section"
        );

    screen.className =
        "menu-screen";

    screen.innerHTML = `
        <article class="menu-panel account-panel">
            <p class="eyebrow">
                RUN FOR LIVE
            </p>

            <h2>${title}</h2>

            <form
                class="account-form"
                data-form
            ></form>

            <p
                class="form-error"
                data-error
                hidden
            ></p>

            <div class="menu-actions">
                <button
                    type="button"
                    class="menu-button"
                    data-back
                >
                    BACK
                </button>
            </div>
        </article>
    `;

    screen
        .querySelector(
            "[data-back]"
        )
        .onclick =
            backAction;

    app.appendChild(
        screen
    );

    return {
        form:
            screen.querySelector(
                "[data-form]"
            ),

        error:
            screen.querySelector(
                "[data-error]"
            )
    };
}

function signIn() {
    const {
        form,
        error
    } =
        createPanel(
            "SIGN IN"
        );

    const loginId =
        createInput(
            "Login ID"
        );

    const password =
        createInput(
            "Password",
            "password"
        );

    const submit =
        createButton(
            "SIGN IN",
            true
        );

    submit.type =
        "submit";

    form.append(
        loginId,
        password,
        submit
    );

    form.onsubmit =
        async event => {
            event.preventDefault();

            error.hidden =
                true;

            try {
                profile =
                    await auth.signIn(
                        loginId.value,
                        password.value
                    );

                home();
            } catch (
                exception
            ) {
                showError(
                    error,
                    exception
                );
            }
        };
}

function register() {
    const {
        form,
        error
    } =
        createPanel(
            "CREATE ACCOUNT"
        );

    const displayName =
        createInput(
            "Display name"
        );

    const loginId =
        createInput(
            "Login ID"
        );

    const password =
        createInput(
            "Password: 12+ characters",
            "password"
        );

    const confirmation =
        createInput(
            "Confirm password",
            "password"
        );

    const submit =
        createButton(
            "CREATE ACCOUNT",
            true
        );

    submit.type =
        "submit";

    form.append(
        displayName,
        loginId,
        password,
        confirmation,
        submit
    );

    form.onsubmit =
        async event => {
            event.preventDefault();

            error.hidden =
                true;

            try {
                const result =
                    await auth.register({
                        displayName:
                            displayName.value,

                        loginId:
                            loginId.value,

                        password:
                            password.value,

                        confirmPassword:
                            confirmation.value
                    });

                profile =
                    result.profile;

                recovery(
                    result.recoveryCode
                );
            } catch (
                exception
            ) {
                showError(
                    error,
                    exception
                );
            }
        };
}

function recovery(
    code
) {
    clear();

    screen =
        document.createElement(
            "section"
        );

    screen.className =
        "menu-screen";

    screen.innerHTML = `
        <article class="menu-panel">
            <h2>
                RECOVERY CODE
            </h2>

            <p
                class="recovery-code"
                data-code
            ></p>

            <div class="notice-box notice-box--danger">
                Save this code safely.
                Losing both password and code
                makes recovery impossible.
            </div>

            <div
                class="menu-actions"
                data-actions
            ></div>
        </article>
    `;

    screen
        .querySelector(
            "[data-code]"
        )
        .textContent =
            code;

    const copy =
        createButton(
            "COPY",
            true
        );

    const next =
        createButton(
            "CONTINUE"
        );

    copy.onclick =
        () =>
            navigator.clipboard
                .writeText(
                    code
                );

    next.onclick =
        home;

    screen
        .querySelector(
            "[data-actions]"
        )
        .append(
            copy,
            next
        );

    app.appendChild(
        screen
    );
}

function home() {
    clear();

    const identity =
        getIdentity(
            profile
        );

    const economy =
        getEconomy(
            profile
        );

    const selectedRank =
        getRankById(
            economy.selectedChatRank
        );

    screen =
        document.createElement(
            "section"
        );

    screen.className =
        "menu-screen";

    screen.innerHTML = `
        <article class="menu-panel home-panel">
            <p class="eyebrow">
                PLAYER PROFILE
            </p>

            <h2 class="profile-heading">
                ${getProfileTag(profile)}
                <span
                    class="profile-name"
                    data-name
                ></span>
            </h2>

            <div class="profile-grid">
                <div>
                    <small>COINS</small>
                    <strong data-coins></strong>
                </div>

                <div>
                    <small>CHAT RANK</small>
                    <strong
                        class="rank-text rank-text--${
                            selectedRank?.className ||
                            identity.className
                        }"
                    >
                        [${
                            selectedRank?.label ||
                            identity.label
                        }]
                    </strong>
                </div>

                <div>
                    <small>ROLE</small>
                    <strong
                        class="role-text--${identity.className}"
                    >
                        ${identity.label}
                    </strong>
                </div>
            </div>

            <div
                class="menu-actions"
                data-actions
            ></div>
        </article>
    `;

    screen
        .querySelector(
            "[data-name]"
        )
        .textContent =
            profile.displayName;

    screen
        .querySelector(
            "[data-coins]"
        )
        .textContent =
            formatCoins(
                economy.coins
            );

    const play =
        createButton(
            "PLAY NPC MATCH",
            true
        );

    const createRoom =
        createButton(
            "CREATE ROOM"
        );

    const join =
        createButton(
            "JOIN ROOM"
        );

    const shop =
        createButton(
            "CHAT RANK SHOP"
        );

    const draw =
        createButton(
            "RANK DRAW"
        );

    const gifts =
        createButton(
            "GIFT INVENTORY"
        );

    const signOutButton =
        createButton(
            "SIGN OUT"
        );

    play.onclick =
        roulette;

    createRoom.onclick =
        () => {
            lobby =
                new LocalLobbyService(
                    profile
                );

            lobby.createRoom();

            showLobby();
        };

    join.onclick =
        joinRoom;

    shop.onclick =
        showRankShop;

    draw.onclick =
        showRankDraw;

    gifts.onclick =
        showGiftInventory;

    signOutButton.onclick =
        () => {
            auth.signOut();

            profile =
                null;

            landing();
        };

    screen
        .querySelector(
            "[data-actions]"
        )
        .append(
            play,
            createRoom,
            join,
            shop,
            draw,
            gifts,
            signOutButton
        );

    app.appendChild(
        screen
    );
}

function showRankShop() {
    clear();

    const economy =
        getEconomy(
            profile
        );

    const nextRank =
        getNextPurchasableRank(
            profile
        );

    screen =
        document.createElement(
            "section"
        );

    screen.className =
        "menu-screen";

    screen.innerHTML = `
        <article class="menu-panel rank-shop">
            <p class="eyebrow">
                CHAT RANK SHOP
            </p>

            <h2>
                RANK SHOP
            </h2>

            <p class="shop-balance">
                ${formatCoins(economy.coins)}
            </p>

            <div
                class="rank-list"
                data-rank-list
            ></div>

            <p
                class="form-error"
                data-error
                hidden
            ></p>

            <div
                class="menu-actions"
                data-actions
            ></div>
        </article>
    `;

    const rankList =
        screen.querySelector(
            "[data-rank-list]"
        );

    for (
        const rank of
        CHAT_RANKS
    ) {
        const owned =
            economy
                .ownedChatRanks
                .includes(
                    rank.id
                );

        const activeChampion =
            rank.id ===
                "CHAMPION" &&
            hasActiveChampion(
                economy
            );

        const card =
            document.createElement(
                "div"
            );

        card.className =
            "rank-shop-card";

        card.innerHTML = `
            <div>
                <strong
                    class="rank-text rank-text--${rank.className}"
                >
                    [${rank.label}]
                </strong>

                <small>
                    ${
                        rank.id ===
                        "CHAMPION"
                            ? `${CHAMPION_PRICE.toLocaleString()} Coins / 30 days`
                            : `${rank.price.toLocaleString()} Coins`
                    }
                </small>
            </div>

            <span>
                ${
                    activeChampion
                        ? "ACTIVE"
                        : owned
                            ? "OWNED"
                            : nextRank?.id === rank.id
                                ? "AVAILABLE"
                                : "LOCKED"
                }
            </span>
        `;

        rankList.appendChild(
            card
        );
    }

    const errorElement =
        screen.querySelector(
            "[data-error]"
        );

    const actions =
        screen.querySelector(
            "[data-actions]"
        );

    if (
        nextRank
    ) {
        const purchase =
            createButton(
                `BUY [${nextRank.label}]`,
                true
            );

        purchase.onclick =
            () => {
                try {
                    buyNextRank(
                        profile
                    );

                    showRankShop();
                } catch (
                    exception
                ) {
                    showError(
                        errorElement,
                        exception
                    );
                }
            };

        actions.appendChild(
            purchase
        );
    } else {
        const champion =
            createButton(
                `CHAMPION: ${CHAMPION_PRICE.toLocaleString()} COINS`,
                true
            );

        champion.onclick =
            () => {
                try {
                    buyChampion(
                        profile
                    );

                    showRankShop();
                } catch (
                    exception
                ) {
                    showError(
                        errorElement,
                        exception
                    );
                }
            };

        actions.appendChild(
            champion
        );
    }

    const equip =
        createButton(
            "EQUIP OWNED RANK"
        );

    const back =
        createButton(
            "BACK"
        );

    equip.onclick =
        showOwnedRanks;

    back.onclick =
        home;

    actions.append(
        equip,
        back
    );

    app.appendChild(
        screen
    );
}

function showOwnedRanks() {
    clear();

    const economy =
        getEconomy(
            profile
        );

    screen =
        document.createElement(
            "section"
        );

    screen.className =
        "menu-screen";

    screen.innerHTML = `
        <article class="menu-panel">
            <p class="eyebrow">
                OWNED RANKS
            </p>

            <h2>
                SELECT CHAT RANK
            </h2>

            <div
                class="rank-list"
                data-list
            ></div>

            <p
                class="form-error"
                data-error
                hidden
            ></p>

            <div class="menu-actions">
                <button
                    class="menu-button"
                    data-back
                >
                    BACK
                </button>
            </div>
        </article>
    `;

    const list =
        screen.querySelector(
            "[data-list]"
        );

    const ownedIds = [
        "PLAYER",
        ...economy
            .ownedChatRanks
            .filter(
                rankId =>
                    rankId !==
                    "PLAYER"
            )
    ];

    if (
        hasActiveChampion(
            economy
        )
    ) {
        ownedIds.push(
            "CHAMPION"
        );
    }

    for (
        const rankId of
        [...new Set(
            ownedIds
        )]
    ) {
        const rank =
            rankId ===
            "PLAYER"
                ? {
                    id:
                        "PLAYER",

                    label:
                        "Player",

                    className:
                        "player"
                }
                : getRankById(
                    rankId
                );

        if (!rank) {
            continue;
        }

        const rankButton =
            createButton(
                `[${rank.label}]`
            );

        rankButton.classList.add(
            `rank-button--${rank.className}`
        );

        rankButton.onclick =
            () => {
                try {
                    equipRank(
                        profile,
                        rank.id
                    );

                    home();
                } catch (
                    exception
                ) {
                    showError(
                        screen.querySelector(
                            "[data-error]"
                        ),
                        exception
                    );
                }
            };

        list.appendChild(
            rankButton
        );
    }

    screen
        .querySelector(
            "[data-back]"
        )
        .onclick =
            showRankShop;

    app.appendChild(
        screen
    );
}

function showRankDraw() {
    clear();

    const economy =
        getEconomy(
            profile
        );

    screen =
        document.createElement(
            "section"
        );

    screen.className =
        "menu-screen";

    screen.innerHTML = `
        <article class="menu-panel">
            <p class="eyebrow">
                RANK DRAW
            </p>

            <h2>
                40,000 COIN DRAW
            </h2>

            <p class="shop-balance">
                ${formatCoins(economy.coins)}
            </p>

            <div class="notice-box">
                Cost:
                ${RANK_DRAW_PRICE.toLocaleString()}
                Coins.
                Duplicate ranks become gifts.
            </div>

            <div
                class="draw-probabilities"
                data-probabilities
            ></div>

            <p
                class="draw-result"
                data-result
            ></p>

            <p
                class="form-error"
                data-error
                hidden
            ></p>

            <div
                class="menu-actions"
                data-actions
            ></div>
        </article>
    `;

    const probabilities =
        screen.querySelector(
            "[data-probabilities]"
        );

    for (
        const rank of
        CHAT_RANKS
    ) {
        const line =
            document.createElement(
                "div"
            );

        line.innerHTML = `
            <strong
                class="rank-text rank-text--${rank.className}"
            >
                [${rank.label}]
            </strong>

            <span>
                ${rank.drawWeight}%
            </span>
        `;

        probabilities.appendChild(
            line
        );
    }

    const drawButton =
        createButton(
            `DRAW FOR ${RANK_DRAW_PRICE.toLocaleString()} COINS`,
            true
        );

    const back =
        createButton(
            "BACK"
        );

    drawButton.onclick =
        () => {
            try {
                const result =
                    drawRank(
                        profile
                    );

                const resultElement =
                    screen.querySelector(
                        "[data-result]"
                    );

                resultElement.className =
                    `draw-result rank-text--${result.rank.className}`;

                resultElement.textContent =
                    result.resultType ===
                    "OWNED"
                        ? `YOU WON [${result.rank.label}]`
                        : result.resultType ===
                            "CHAMPION_PASS"
                            ? "YOU WON A CHAMPION 30-DAY GIFT PASS"
                            : `DUPLICATE [${result.rank.label}] ADDED TO GIFTS`;

                setTimeout(
                    showRankDraw,
                    1800
                );
            } catch (
                exception
            ) {
                showError(
                    screen.querySelector(
                        "[data-error]"
                    ),
                    exception
                );
            }
        };

    back.onclick =
        home;

    screen
        .querySelector(
            "[data-actions]"
        )
        .append(
            drawButton,
            back
        );

    app.appendChild(
        screen
    );
}

function showGiftInventory() {
    clear();

    const economy =
        getEconomy(
            profile
        );

    screen =
        document.createElement(
            "section"
        );

    screen.className =
        "menu-screen";

    screen.innerHTML = `
        <article class="menu-panel">
            <p class="eyebrow">
                GIFT INVENTORY
            </p>

            <h2>
                GIFTS
            </h2>

            <div
                class="gift-list"
                data-list
            ></div>

            <p
                class="form-error"
                data-error
                hidden
            ></p>

            <div class="menu-actions">
                <button
                    class="menu-button"
                    data-back
                >
                    BACK
                </button>
            </div>
        </article>
    `;

    const list =
        screen.querySelector(
            "[data-list]"
        );

    const gifts =
        Object.entries(
            economy.giftInventory
        )
            .filter(
                (
                    [
                        rankId,
                        amount
                    ]
                ) =>
                    Number(
                        amount
                    ) >
                    0
            );

    if (
        gifts.length ===
        0
    ) {
        list.textContent =
            "No gifts available.";
    }

    for (
        const [
            rankId,
            amount
        ] of
        gifts
    ) {
        const rank =
            getRankById(
                rankId
            );

        if (!rank) {
            continue;
        }

        const row =
            document.createElement(
                "div"
            );

        row.className =
            "gift-row";

        row.innerHTML = `
            <strong
                class="rank-text rank-text--${rank.className}"
            >
                [${rank.label}]
            </strong>

            <span>
                ×${amount}
            </span>
        `;

        const send =
            createButton(
                "SEND"
            );

        send.onclick =
            () =>
                showGiftRecipient(
                    rankId
                );

        row.appendChild(
            send
        );

        list.appendChild(
            row
        );
    }

    screen
        .querySelector(
            "[data-back]"
        )
        .onclick =
            home;

    app.appendChild(
        screen
    );
}

function showGiftRecipient(
    rankId
) {
    const {
        form,
        error
    } =
        createPanel(
            "SEND GIFT",
            showGiftInventory
        );

    const recipient =
        createInput(
            "Login ID, player name, or NPC ID"
        );

    const submit =
        createButton(
            "SEND GIFT",
            true
        );

    submit.type =
        "submit";

    form.append(
        recipient,
        submit
    );

    form.onsubmit =
        event => {
            event.preventDefault();

            try {
                const identifier =
                    recipient.value
                        .trim()
                        .toLowerCase();

                const target =
                    getGiftRecipients()
                        .find(
                            candidate =>
                                String(
                                    candidate.id ||
                                    ""
                                )
                                    .toLowerCase() ===
                                    identifier ||
                                String(
                                    candidate.loginId ||
                                    ""
                                )
                                    .toLowerCase() ===
                                    identifier ||
                                String(
                                    candidate.displayName ||
                                    ""
                                )
                                    .toLowerCase() ===
                                    identifier
                        );

                if (!target) {
                    throw new Error(
                        "Player or NPC was not found."
                    );
                }

                giftRank(
                    profile,
                    target,
                    rankId
                );

                showGiftInventory();
            } catch (
                exception
            ) {
                showError(
                    error,
                    exception
                );
            }
        };
}

function joinRoom() {
    const {
        form,
        error
    } =
        createPanel(
            "JOIN ROOM",
            home
        );

    const roomCode =
        createInput(
            "6-character room code"
        );

    const submit =
        createButton(
            "JOIN",
            true
        );

    submit.type =
        "submit";

    form.append(
        roomCode,
        submit
    );

    form.onsubmit =
        event => {
            event.preventDefault();

            try {
                lobby =
                    new LocalLobbyService(
                        profile
                    );

                lobby.joinRoom(
                    roomCode.value
                );

                showLobby();
            } catch (
                exception
            ) {
                showError(
                    error,
                    exception
                );
            }
        };
}

function showLobby() {
    clear();

    screen =
        document.createElement(
            "section"
        );

    screen.className =
        "lobby-screen";

    screen.innerHTML = `
        <div class="lobby-layout">
            <section class="lobby-card">
                <h2>
                    ROOM
                    <span data-code></span>
                </h2>

                <div
                    data-players
                ></div>

                <div
                    class="menu-actions"
                    data-actions
                ></div>
            </section>

            <section class="lobby-card">
                <h2>
                    LOBBY CHAT
                </h2>

                <div
                    class="chat-log"
                    data-chat
                ></div>

                <form class="chat-form">
                    <input
                        maxlength="120"
                        placeholder="Type a message..."
                    >

                    <button
                        class="menu-button menu-button--primary"
                    >
                        SEND
                    </button>
                </form>

                <p
                    class="form-error"
                    data-error
                    hidden
                ></p>
            </section>
        </div>
    `;

    const render =
        room => {
            screen
                .querySelector(
                    "[data-code]"
                )
                .textContent =
                    room.code;

            const players =
                screen.querySelector(
                    "[data-players]"
                );

            players.replaceChildren(
                ...room.players.map(
                    roomPlayer => {
                        const row =
                            document.createElement(
                                "div"
                            );

                        row.className =
                            "player-row";

                        const identity =
                            getIdentity(
                                roomPlayer
                            );

                        row.innerHTML = `
                            <span
                                class="rank-text--${identity.className}"
                            >
                                ${getProfileTag(roomPlayer)}
                                <strong></strong>
                            </span>

                            <em>
                                ${
                                    roomPlayer.ready
                                        ? "READY"
                                        : "NOT READY"
                                }
                            </em>
                        `;

                        row
                            .querySelector(
                                "strong"
                            )
                            .textContent =
                                roomPlayer.displayName;

                        return row;
                    }
                )
            );

            const chatLog =
                screen.querySelector(
                    "[data-chat]"
                );

            chatLog.replaceChildren(
                ...room.messages.map(
                    message => {
                        const line =
                            document.createElement(
                                "p"
                            );

                        const identity =
                            document.createElement(
                                "span"
                            );

                        identity.className =
                            `role-tag role-tag--${message.className}`;

                        identity.textContent =
                            `[${message.label}] ${message.displayName}:`;

                        const content =
                            document.createElement(
                                "span"
                            );

                        content.className =
                            "chat-message__content";

                        content.textContent =
                            ` ${message.content}`;

                        line.append(
                            identity,
                            content
                        );

                        return line;
                    }
                )
            );

            chatLog.scrollTop =
                chatLog.scrollHeight;
        };

    lobby.addEventListener(
        "update",
        event =>
            render(
                event.detail
            )
    );

    const ready =
        createButton(
            "TOGGLE READY",
            true
        );

    const start =
        createButton(
            "START NPC MATCH"
        );

    const leave =
        createButton(
            "LEAVE"
        );

    ready.onclick =
        () =>
            lobby.toggleReady();

    start.onclick =
        roulette;

    leave.onclick =
        () => {
            lobby.leaveRoom();
            home();
        };

    screen
        .querySelector(
            "[data-actions]"
        )
        .append(
            ready,
            start,
            leave
        );

    const form =
        screen.querySelector(
            "form"
        );

    const chatInput =
        form.querySelector(
            "input"
        );

    const errorElement =
        screen.querySelector(
            "[data-error]"
        );

    form.onsubmit =
        event => {
            event.preventDefault();

            try {
                const command =
                    chatInput.value
                        .trim();

                if (
                    command
                        .toLowerCase()
                        .startsWith(
                            "/coin "
                        )
                ) {
                    const result =
                        executeAdminCoinCommand({
                            executor:
                                profile,

                            command,

                            profiles: [
                                profile,
                                ...auth.getProfiles(),
                                ...getGiftRecipients()
                            ]
                        });

                    lobby.sendMessage(
                        `[System] ${result.message}`
                    );
                } else {
                    lobby.sendMessage(
                        command
                    );
                }

                chatInput.value =
                    "";
            } catch (
                exception
            ) {
                showError(
                    errorElement,
                    exception
                );
            }
        };

    app.appendChild(
        screen
    );

    render(
        lobby.room
    );
}

function roulette() {
    clear();

    screen =
        document.createElement(
            "section"
        );

    screen.className =
        "roulette-screen";

    screen.innerHTML = `
        <div class="roulette-card">
            <h2>
                ROLE ROULETTE
            </h2>

            <div
                class="roulette-display"
                data-role
            >
                ESCAPEE
            </div>
        </div>
    `;

    app.appendChild(
        screen
    );

    const history =
        JSON.parse(
            localStorage.getItem(
                "rfl_roles"
            ) || "[]"
        );

    const previous =
        history.at(
            -1
        );

    const twoAgo =
        history.at(
            -2
        );

    let pursuerChance =
        0.25;

    if (
        previous ===
        "ESCAPEE"
    ) {
        pursuerChance =
            0.45;
    }

    if (
        previous ===
            "ESCAPEE" &&
        twoAgo ===
            "ESCAPEE"
    ) {
        pursuerChance =
            0.8;
    }

    if (
        previous ===
        "PURSUER"
    ) {
        pursuerChance =
            0.15;
    }

    if (
        previous ===
            "PURSUER" &&
        twoAgo ===
            "PURSUER"
    ) {
        pursuerChance =
            0;
    }

    const role =
        Math.random() <
        pursuerChance
            ? "PURSUER"
            : "ESCAPEE";

    localStorage.setItem(
        "rfl_roles",
        JSON.stringify(
            [
                ...history,
                role
            ].slice(
                -2
            )
        )
    );

    const roleElement =
        screen.querySelector(
            "[data-role]"
        );

    let count =
        0;

    const tick =
        () => {
            roleElement.textContent =
                count % 2
                    ? "PURSUER"
                    : "ESCAPEE";

            roleElement.dataset.role =
                roleElement.textContent;

            count +=
                1;

            if (
                count <
                18
            ) {
                setTimeout(
                    tick,
                    70 +
                    count *
                    12
                );

                return;
            }

            roleElement.textContent =
                role;

            roleElement.dataset.role =
                role;

            setTimeout(
                () =>
                    startGame(
                        role
                    ),
                1100
            );
        };

    tick();
}

function startGame(
    role
) {
    clear();

    game =
        new Game(
            app,
            {
                role,

                profile,

                profiles:
                    auth.getProfiles(),

                onExit:
                    home,

                onRetry:
                    () =>
                        startGame(
                            role
                        ),

                onCoinsChanged:
                    () => {}
            }
        );

    game.start();
}

if (profile) {
    home();
} else {
    landing();
}
