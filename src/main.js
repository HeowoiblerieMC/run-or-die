import "./style.css";
import { Game } from "./game.js";
import { AccountService, getChatIdentity } from "./account.js";
import { LocalLobbyService } from "./multiplayer.js";
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

const app = document.querySelector("#app");
const auth = new AccountService();
document.querySelector("#startup-status")?.remove();

let profile = auth.getSession();
let screen = null;
let game = null;
let lobby = null;

function clearScreen() {
    screen?.remove();
    screen = null;
}

function createButton(text, primary = false) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = primary
        ? "menu-button menu-button--primary"
        : "menu-button";
    element.textContent = text;
    return element;
}

function createInput(placeholder, type = "text") {
    const element = document.createElement("input");
    element.type = type;
    element.placeholder = placeholder;
    return element;
}

function showError(element, exception) {
    element.hidden = false;
    element.textContent = exception?.message || String(exception);
}

function formatCoins(value) {
    return `${Math.floor(Number(value) || 0).toLocaleString()} Coins`;
}

function identityFor(targetProfile) {
    return getChatIdentity(targetProfile);
}

function tagHtml(targetProfile) {
    const identity = identityFor(targetProfile);
    return `<span class="role-tag role-tag--${identity.className}">[${identity.label}]</span>`;
}

function createPanel(title, backAction = showLanding) {
    clearScreen();
    screen = document.createElement("section");
    screen.className = "menu-screen";
    screen.innerHTML = `
        <article class="menu-panel account-panel">
            <p class="eyebrow">RUN FOR LIVE</p>
            <h2>${title}</h2>
            <form class="account-form" data-form></form>
            <p class="form-error" data-error hidden></p>
            <div class="menu-actions">
                <button type="button" class="menu-button" data-back>BACK</button>
            </div>
        </article>
    `;
    screen.querySelector("[data-back]").onclick = backAction;
    app.appendChild(screen);
    return {
        form: screen.querySelector("[data-form]"),
        error: screen.querySelector("[data-error]")
    };
}

function getNpcProfiles() {
    return Array.from({ length: 1000 }, (_, index) => {
        const number = String(index + 1).padStart(4, "0");
        return {
            id: `npc_${number}`,
            loginId: `npc_${number}`,
            displayName: `NOVA-${number}`,
            role: "PLAYER",
            title: null,
            npc: true
        };
    });
}

function getGiftRecipients() {
    return [...auth.getProfiles(), ...getNpcProfiles()];
}

function findRecipient(identifier) {
    const search = String(identifier || "").trim().toLowerCase();
    const matches = getGiftRecipients().filter(candidate => {
        return [candidate.id, candidate.loginId, candidate.displayName]
            .filter(Boolean)
            .some(value => String(value).trim().toLowerCase() === search);
    });
    if (matches.length > 1) {
        throw new Error("Multiple recipients use that name. Use a login ID or NPC ID.");
    }
    return matches[0] || null;
}

function showLanding() {
    clearScreen();
    screen = document.createElement("section");
    screen.className = "title-screen";
    screen.innerHTML = `
        <div class="title-card">
            <p class="eyebrow">NOVA INTERACTIVE</p>
            <h1><span>RUN</span><span>FOR LIVE</span></h1>
            <p class="lead">Restore. Run. Escape.</p>
            <div class="menu-actions" data-actions></div>
        </div>
    `;
    const guest = createButton("PLAY AS GUEST", true);
    const signIn = createButton("SIGN IN");
    const register = createButton("CREATE ACCOUNT");
    guest.onclick = () => {
        profile = auth.createGuest();
        showHome();
    };
    signIn.onclick = showSignIn;
    register.onclick = showRegister;
    screen.querySelector("[data-actions]").append(guest, signIn, register);
    app.appendChild(screen);
}

function showSignIn() {
    const { form, error } = createPanel("SIGN IN");
    const loginId = createInput("Login ID");
    const password = createInput("Password", "password");
    const submit = createButton("SIGN IN", true);
    submit.type = "submit";
    form.append(loginId, password, submit);
    form.onsubmit = async event => {
        event.preventDefault();
        error.hidden = true;
        try {
            profile = await auth.signIn(loginId.value, password.value);
            showHome();
        } catch (exception) {
            showError(error, exception);
        }
    };
}

function showRegister() {
    const { form, error } = createPanel("CREATE ACCOUNT");
    const displayName = createInput("Display name");
    const loginId = createInput("Login ID");
    const password = createInput("Password: 12+ characters", "password");
    const confirmation = createInput("Confirm password", "password");
    const submit = createButton("CREATE ACCOUNT", true);
    submit.type = "submit";
    form.append(displayName, loginId, password, confirmation, submit);
    form.onsubmit = async event => {
        event.preventDefault();
        error.hidden = true;
        try {
            const result = await auth.register({
                displayName: displayName.value,
                loginId: loginId.value,
                password: password.value,
                confirmPassword: confirmation.value
            });
            profile = result.profile;
            showRecovery(result.recoveryCode);
        } catch (exception) {
            showError(error, exception);
        }
    };
}

function showRecovery(code) {
    clearScreen();
    screen = document.createElement("section");
    screen.className = "menu-screen";
    screen.innerHTML = `
        <article class="menu-panel">
            <p class="eyebrow">ACCOUNT CREATED</p>
            <h2>RECOVERY CODE</h2>
            <p class="recovery-code" data-code></p>
            <div class="notice-box notice-box--danger">
                Save this code safely. Losing both password and code makes recovery impossible.
            </div>
            <div class="menu-actions" data-actions></div>
        </article>
    `;
    screen.querySelector("[data-code]").textContent = code;
    const copy = createButton("COPY", true);
    const next = createButton("CONTINUE");
    copy.onclick = () => navigator.clipboard.writeText(code);
    next.onclick = showHome;
    screen.querySelector("[data-actions]").append(copy, next);
    app.appendChild(screen);
}

function showHome() {
    clearScreen();
    const identity = identityFor(profile);
    const economy = getEconomy(profile);
    const selectedRank = economy.selectedChatRank === "PLAYER"
        ? { label: identity.label, className: identity.className }
        : getRankById(economy.selectedChatRank) || { label: "Player", className: "player" };

    screen = document.createElement("section");
    screen.className = "menu-screen";
    screen.innerHTML = `
        <article class="menu-panel home-panel">
            <p class="eyebrow">PLAYER PROFILE</p>
            <h2 class="profile-heading rank-text--${identity.className}">
                ${tagHtml(profile)} <span class="profile-name" data-name></span>
            </h2>
            <div class="profile-grid">
                <div><small>COINS</small><strong data-coins></strong></div>
                <div>
                    <small>CHAT RANK</small>
                    <strong class="rank-text--${selectedRank.className}">[${selectedRank.label}]</strong>
                </div>
                <div><small>ROLE</small><strong class="role-text--${identity.className}">${identity.label}</strong></div>
            </div>
            <div class="menu-actions" data-actions></div>
        </article>
    `;
    screen.querySelector("[data-name]").textContent = profile.displayName;
    screen.querySelector("[data-coins]").textContent = formatCoins(economy.coins);

    const play = createButton("PLAY NPC MATCH", true);
    const createRoom = createButton("CREATE ROOM");
    const joinRoom = createButton("JOIN ROOM");
    const shop = createButton("CHAT RANK SHOP");
    const draw = createButton("RANK DRAW");
    const gifts = createButton("GIFT INVENTORY");
    const signOut = createButton("SIGN OUT");

    play.onclick = showRoulette;
    createRoom.onclick = () => {
        lobby = new LocalLobbyService(profile);
        lobby.createRoom();
        showLobby();
    };
    joinRoom.onclick = showJoinRoom;
    shop.onclick = showRankShop;
    draw.onclick = showRankDraw;
    gifts.onclick = showGiftInventory;
    signOut.onclick = () => {
        auth.signOut();
        profile = null;
        showLanding();
    };

    screen.querySelector("[data-actions]").append(
        play,
        createRoom,
        joinRoom,
        shop,
        draw,
        gifts,
        signOut
    );
    app.appendChild(screen);
}

function showRankShop() {
    clearScreen();
    const economy = getEconomy(profile);
    const nextRank = getNextPurchasableRank(profile);
    screen = document.createElement("section");
    screen.className = "menu-screen";
    screen.innerHTML = `
        <article class="menu-panel rank-shop">
            <p class="eyebrow">CHAT RANK SHOP</p>
            <h2>RANK SHOP</h2>
            <p class="shop-balance">${formatCoins(economy.coins)}</p>
            <div class="rank-list" data-list></div>
            <p class="form-error" data-error hidden></p>
            <div class="menu-actions" data-actions></div>
        </article>
    `;
    const list = screen.querySelector("[data-list]");
    CHAT_RANKS.forEach(rank => {
        const owned = economy.ownedChatRanks.includes(rank.id);
        const activeChampion = rank.id === "CHAMPION" && hasActiveChampion(economy);
        const card = document.createElement("div");
        card.className = "rank-shop-card";
        card.innerHTML = `
            <div>
                <strong class="rank-text--${rank.className}">[${rank.label}]</strong>
                <small>${rank.id === "CHAMPION"
                    ? `${CHAMPION_PRICE.toLocaleString()} Coins / 30 days`
                    : `${rank.price.toLocaleString()} Coins`}</small>
            </div>
            <span>${activeChampion
                ? "ACTIVE"
                : owned
                    ? "OWNED"
                    : nextRank?.id === rank.id
                        ? "AVAILABLE"
                        : "LOCKED"}</span>
        `;
        list.appendChild(card);
    });

    const actions = screen.querySelector("[data-actions]");
    const error = screen.querySelector("[data-error]");
    if (nextRank) {
        const buy = createButton(`BUY [${nextRank.label}]`, true);
        buy.onclick = () => {
            try {
                buyNextRank(profile);
                showRankShop();
            } catch (exception) {
                showError(error, exception);
            }
        };
        actions.appendChild(buy);
    } else {
        const champion = createButton(`CHAMPION: ${CHAMPION_PRICE.toLocaleString()} COINS`, true);
        champion.onclick = () => {
            try {
                buyChampion(profile);
                showRankShop();
            } catch (exception) {
                showError(error, exception);
            }
        };
        actions.appendChild(champion);
    }
    const equip = createButton("EQUIP OWNED RANK");
    const back = createButton("BACK");
    equip.onclick = showOwnedRanks;
    back.onclick = showHome;
    actions.append(equip, back);
    app.appendChild(screen);
}

function showOwnedRanks() {
    clearScreen();
    const economy = getEconomy(profile);
    screen = document.createElement("section");
    screen.className = "menu-screen";
    screen.innerHTML = `
        <article class="menu-panel">
            <p class="eyebrow">OWNED RANKS</p>
            <h2>SELECT CHAT RANK</h2>
            <div class="rank-list" data-list></div>
            <p class="form-error" data-error hidden></p>
            <div class="menu-actions"><button class="menu-button" data-back>BACK</button></div>
        </article>
    `;
    const ids = ["PLAYER", ...economy.ownedChatRanks.filter(id => id !== "PLAYER")];
    if (hasActiveChampion(economy)) ids.push("CHAMPION");
    const list = screen.querySelector("[data-list]");
    [...new Set(ids)].forEach(rankId => {
        const rank = rankId === "PLAYER"
            ? { id: "PLAYER", label: "Player", className: "player" }
            : getRankById(rankId);
        if (!rank) return;
        const rankButton = createButton(`[${rank.label}]`);
        rankButton.classList.add(`rank-button--${rank.className}`);
        rankButton.onclick = () => {
            try {
                equipRank(profile, rank.id);
                showHome();
            } catch (exception) {
                showError(screen.querySelector("[data-error]"), exception);
            }
        };
        list.appendChild(rankButton);
    });
    screen.querySelector("[data-back]").onclick = showRankShop;
    app.appendChild(screen);
}

function showRankDraw() {
    clearScreen();
    const economy = getEconomy(profile);
    screen = document.createElement("section");
    screen.className = "menu-screen";
    screen.innerHTML = `
        <article class="menu-panel">
            <p class="eyebrow">RANK DRAW</p>
            <h2>40,000 COIN DRAW</h2>
            <p class="shop-balance">${formatCoins(economy.coins)}</p>
            <div class="notice-box">
                Cost: ${RANK_DRAW_PRICE.toLocaleString()} Coins. Duplicate ranks become gifts.
            </div>
            <div class="draw-probabilities" data-list></div>
            <p class="draw-result" data-result></p>
            <p class="form-error" data-error hidden></p>
            <div class="menu-actions" data-actions></div>
        </article>
    `;
    const list = screen.querySelector("[data-list]");
    CHAT_RANKS.forEach(rank => {
        const line = document.createElement("div");
        line.innerHTML = `
            <strong class="rank-text--${rank.className}">[${rank.label}]</strong>
            <span>${rank.drawWeight}%</span>
        `;
        list.appendChild(line);
    });
    const drawButton = createButton(`DRAW FOR ${RANK_DRAW_PRICE.toLocaleString()} COINS`, true);
    const back = createButton("BACK");
    drawButton.onclick = () => {
        try {
            const result = drawRank(profile);
            const resultElement = screen.querySelector("[data-result]");
            resultElement.className = `draw-result rank-text--${result.rank.className}`;
            resultElement.textContent = result.resultType === "OWNED"
                ? `YOU WON [${result.rank.label}]`
                : result.resultType === "CHAMPION_PASS"
                    ? "YOU WON A CHAMPION 30-DAY GIFT PASS"
                    : `DUPLICATE [${result.rank.label}] ADDED TO GIFTS`;
            setTimeout(showRankDraw, 1800);
        } catch (exception) {
            showError(screen.querySelector("[data-error]"), exception);
        }
    };
    back.onclick = showHome;
    screen.querySelector("[data-actions]").append(drawButton, back);
    app.appendChild(screen);
}

function showGiftInventory() {
    clearScreen();
    const economy = getEconomy(profile);
    screen = document.createElement("section");
    screen.className = "menu-screen";
    screen.innerHTML = `
        <article class="menu-panel">
            <p class="eyebrow">GIFT INVENTORY</p>
            <h2>GIFTS</h2>
            <div class="gift-list" data-list></div>
            <p class="form-error" data-error hidden></p>
            <div class="menu-actions"><button class="menu-button" data-back>BACK</button></div>
        </article>
    `;
    const list = screen.querySelector("[data-list]");
    const gifts = Object.entries(economy.giftInventory)
        .filter(([, amount]) => Number(amount) > 0);
    if (!gifts.length) list.textContent = "No gifts available.";
    gifts.forEach(([rankId, amount]) => {
        const rank = getRankById(rankId);
        if (!rank) return;
        const row = document.createElement("div");
        row.className = "gift-row";
        row.innerHTML = `
            <strong class="rank-text--${rank.className}">[${rank.label}]</strong>
            <span>Ã${amount}</span>
        `;
        const send = createButton("SEND");
        send.onclick = () => showGiftRecipient(rankId);
        row.appendChild(send);
        list.appendChild(row);
    });
    screen.querySelector("[data-back]").onclick = showHome;
    app.appendChild(screen);
}

function showGiftRecipient(rankId) {
    const { form, error } = createPanel("SEND GIFT", showGiftInventory);
    const recipient = createInput("Login ID, player name, or NPC ID");
    const submit = createButton("SEND GIFT", true);
    submit.type = "submit";
    form.append(recipient, submit);
    form.onsubmit = event => {
        event.preventDefault();
        try {
            const target = findRecipient(recipient.value);
            if (!target) throw new Error("Player or NPC was not found.");
            giftRank(profile, target, rankId);
            showGiftInventory();
        } catch (exception) {
            showError(error, exception);
        }
    };
}

function showJoinRoom() {
    const { form, error } = createPanel("JOIN ROOM", showHome);
    const roomCode = createInput("6-character room code");
    const submit = createButton("JOIN", true);
    submit.type = "submit";
    form.append(roomCode, submit);
    form.onsubmit = event => {
        event.preventDefault();
        try {
            lobby = new LocalLobbyService(profile);
            lobby.joinRoom(roomCode.value);
            showLobby();
        } catch (exception) {
            showError(error, exception);
        }
    };
}

function showLobby() {
    clearScreen();
    screen = document.createElement("section");
    screen.className = "lobby-screen";
    screen.innerHTML = `
        <div class="lobby-layout">
            <section class="lobby-card">
                <h2>ROOM <span data-code></span></h2>
                <div data-players></div>
                <div class="menu-actions" data-actions></div>
            </section>
            <section class="lobby-card">
                <h2>LOBBY CHAT</h2>
                <div class="chat-log" data-chat></div>
                <form class="chat-form">
                    <input maxlength="120" placeholder="Type a message...">
                    <button class="menu-button menu-button--primary">SEND</button>
                </form>
                <p class="form-error" data-error hidden></p>
            </section>
        </div>
    `;

    const render = room => {
        screen.querySelector("[data-code]").textContent = room.code;
        const players = screen.querySelector("[data-players]");
        players.replaceChildren(...room.players.map(roomPlayer => {
            const identity = identityFor(roomPlayer);
            const row = document.createElement("div");
            row.className = "player-row";
            row.innerHTML = `
                <span class="rank-text--${identity.className}">
                    ${tagHtml(roomPlayer)} <strong></strong>
                </span>
                <em>${roomPlayer.ready ? "READY" : "NOT READY"}</em>
            `;
            row.querySelector("strong").textContent = roomPlayer.displayName;
            return row;
        }));

        const log = screen.querySelector("[data-chat]");
        log.replaceChildren(...room.messages.map(message => {
            const line = document.createElement("p");
            const identity = document.createElement("span");
            identity.className = `role-tag role-tag--${message.className}`;
            identity.textContent = `[${message.label}] ${message.displayName}:`;
            const content = document.createElement("span");
            content.className = "chat-message__content";
            content.textContent = ` ${message.content}`;
            line.append(identity, content);
            return line;
        }));
        log.scrollTop = log.scrollHeight;
    };

    lobby.addEventListener("update", event => render(event.detail));
    const ready = createButton("TOGGLE READY", true);
    const start = createButton("START NPC MATCH");
    const leave = createButton("LEAVE");
    ready.onclick = () => lobby.toggleReady();
    start.onclick = showRoulette;
    leave.onclick = () => {
        lobby.leaveRoom();
        showHome();
    };
    screen.querySelector("[data-actions]").append(ready, start, leave);

    const form = screen.querySelector("form");
    const input = form.querySelector("input");
    const error = screen.querySelector("[data-error]");
    form.onsubmit = event => {
        event.preventDefault();
        try {
            const command = input.value.trim();
            if (command.toLowerCase().startsWith("/coin ")) {
                const result = executeAdminCoinCommand({
                    executor: profile,
                    command,
                    profiles: [profile, ...auth.getProfiles(), ...getNpcProfiles()]
                });
                lobby.sendMessage(`[System] ${result.message}`);
            } else {
                lobby.sendMessage(command);
            }
            input.value = "";
        } catch (exception) {
            showError(error, exception);
        }
    };

    app.appendChild(screen);
    render(lobby.room);
}

function showRoulette() {
    clearScreen();
    screen = document.createElement("section");
    screen.className = "roulette-screen";
    screen.innerHTML = `
        <div class="roulette-card">
            <h2>ROLE ROULETTE</h2>
            <div class="roulette-display" data-role>ESCAPEE</div>
        </div>
    `;
    app.appendChild(screen);

    const history = JSON.parse(localStorage.getItem("rfl_roles") || "[]");
    const previous = history.at(-1);
    const twoAgo = history.at(-2);
    let pursuerChance = 0.25;
    if (previous === "ESCAPEE") pursuerChance = 0.45;
    if (previous === "ESCAPEE" && twoAgo === "ESCAPEE") pursuerChance = 0.8;
    if (previous === "PURSUER") pursuerChance = 0.15;
    if (previous === "PURSUER" && twoAgo === "PURSUER") pursuerChance = 0;
    const role = Math.random() < pursuerChance ? "PURSUER" : "ESCAPEE";
    localStorage.setItem("rfl_roles", JSON.stringify([...history, role].slice(-2)));

    const roleElement = screen.querySelector("[data-role]");
    let count = 0;
    const tick = () => {
        roleElement.textContent = count % 2 ? "PURSUER" : "ESCAPEE";
        roleElement.dataset.role = roleElement.textContent;
        count += 1;
        if (count < 18) {
            setTimeout(tick, 70 + count * 12);
            return;
        }
        roleElement.textContent = role;
        roleElement.dataset.role = role;
        setTimeout(() => startGame(role), 1100);
    };
    tick();
}

function startGame(role) {
    clearScreen();
    game = new Game(app, {
        role,
        profile,
        profiles: auth.getProfiles(),
        onExit: showHome,
        onRetry: () => startGame(role),
        onCoinsChanged: () => {}
    });
    game.start();
}

if (profile) showHome();
else showLanding();
