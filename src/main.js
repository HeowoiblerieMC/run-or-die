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
let drawInProgress = false;

const clearScreen = () => {
    screen?.remove();
    screen = null;
};

const button = (text, primary = false) => {
    const element = document.createElement("button");
    element.type = "button";
    element.className = primary ? "menu-button menu-button--primary" : "menu-button";
    element.textContent = text;
    return element;
};

const input = (placeholder, type = "text") => {
    const element = document.createElement("input");
    element.type = type;
    element.placeholder = placeholder;
    return element;
};

const showError = (element, exception) => {
    element.hidden = false;
    element.textContent = exception?.message || String(exception);
};

const formatCoins = value => `${Math.floor(Number(value) || 0).toLocaleString()} Coins`;

function tagHtml(target) {
    const identity = getChatIdentity(target);
    return `<span class="role-tag role-tag--${identity.className}">[${identity.label}]</span>`;
}

function panel(title, back = landing) {
    clearScreen();
    screen = document.createElement("section");
    screen.className = "menu-screen";
    screen.innerHTML = `
        <article class="menu-panel account-panel">
            <p class="eyebrow">RUN FOR LIVE</p>
            <h2>${title}</h2>
            <form class="account-form" data-form></form>
            <p class="form-error" data-error hidden></p>
            <div class="menu-actions"><button type="button" class="menu-button" data-back>BACK</button></div>
        </article>`;
    screen.querySelector("[data-back]").onclick = back;
    app.appendChild(screen);
    return {
        form: screen.querySelector("[data-form]"),
        error: screen.querySelector("[data-error]")
    };
}

function npcProfiles() {
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

function landing() {
    clearScreen();
    screen = document.createElement("section");
    screen.className = "title-screen";
    screen.innerHTML = `
        <div class="title-card">
            <p class="eyebrow">NOVA INTERACTIVE</p>
            <h1><span>RUN</span><span>FOR LIVE</span></h1>
            <p class="lead">Restore. Run. Escape.</p>
            <div class="menu-actions" data-actions></div>
        </div>`;
    const guest = button("PLAY AS GUEST", true);
    const signInButton = button("SIGN IN");
    const registerButton = button("CREATE ACCOUNT");
    guest.onclick = () => {
        profile = auth.createGuest();
        home();
    };
    signInButton.onclick = signIn;
    registerButton.onclick = register;
    screen.querySelector("[data-actions]").append(guest, signInButton, registerButton);
    app.appendChild(screen);
}

function signIn() {
    const { form, error } = panel("SIGN IN");
    const loginId = input("Login ID");
    const password = input("Password", "password");
    const submit = button("SIGN IN", true);
    submit.type = "submit";
    form.append(loginId, password, submit);
    form.onsubmit = async event => {
        event.preventDefault();
        try {
            profile = await auth.signIn(loginId.value, password.value);
            home();
        } catch (exception) {
            showError(error, exception);
        }
    };
}

function register() {
    const { form, error } = panel("CREATE ACCOUNT");
    const displayName = input("Display name");
    const loginId = input("Login ID");
    const password = input("Password: 12+ characters", "password");
    const confirmation = input("Confirm password", "password");
    const submit = button("CREATE ACCOUNT", true);
    submit.type = "submit";
    form.append(displayName, loginId, password, confirmation, submit);
    form.onsubmit = async event => {
        event.preventDefault();
        try {
            const result = await auth.register({
                displayName: displayName.value,
                loginId: loginId.value,
                password: password.value,
                confirmPassword: confirmation.value
            });
            profile = result.profile;
            recovery(result.recoveryCode);
        } catch (exception) {
            showError(error, exception);
        }
    };
}

function recovery(code) {
    clearScreen();
    screen = document.createElement("section");
    screen.className = "menu-screen";
    screen.innerHTML = `
        <article class="menu-panel">
            <p class="eyebrow">ACCOUNT CREATED</p>
            <h2>RECOVERY CODE</h2>
            <p class="recovery-code" data-code></p>
            <div class="notice-box notice-box--danger">Save this code safely.</div>
            <div class="menu-actions" data-actions></div>
        </article>`;
    screen.querySelector("[data-code]").textContent = code;
    const copy = button("COPY", true);
    const next = button("CONTINUE");
    copy.onclick = () => navigator.clipboard.writeText(code);
    next.onclick = home;
    screen.querySelector("[data-actions]").append(copy, next);
    app.appendChild(screen);
}

function home() {
    clearScreen();
    const identity = getChatIdentity(profile);
    const economy = getEconomy(profile);
    const selected = economy.selectedChatRank === "PLAYER"
        ? { label: identity.label, className: identity.className }
        : getRankById(economy.selectedChatRank) || { label: "Player", className: "player" };

    screen = document.createElement("section");
    screen.className = "menu-screen";
    screen.innerHTML = `
        <article class="menu-panel home-panel">
            <p class="eyebrow">PLAYER PROFILE</p>
            <h2 class="profile-heading rank-text--${identity.className}">${tagHtml(profile)} <span data-name></span></h2>
            <div class="profile-grid">
                <div><small>COINS</small><strong>${formatCoins(economy.coins)}</strong></div>
                <div><small>CHAT RANK</small><strong class="rank-text--${selected.className}">[${selected.label}]</strong></div>
                <div><small>ROLE</small><strong class="role-text--${identity.className}">${identity.label}</strong></div>
            </div>
            <div class="menu-actions" data-actions></div>
        </article>`;
    screen.querySelector("[data-name]").textContent = profile.displayName;

    const play = button("PLAY NPC MATCH", true);
    const createRoom = button("CREATE ROOM");
    const join = button("JOIN ROOM");
    const shop = button("CHAT RANK SHOP");
    const draw = button("RANK DRAW");
    const gifts = button("GIFT INVENTORY");
    const signOut = button("SIGN OUT");
    play.onclick = roulette;
    createRoom.onclick = () => {
        lobby = new LocalLobbyService(profile);
        lobby.createRoom();
        showLobby();
    };
    join.onclick = joinRoom;
    shop.onclick = rankShop;
    draw.onclick = rankDraw;
    gifts.onclick = giftInventory;
    signOut.onclick = () => {
        auth.signOut();
        profile = null;
        landing();
    };
    screen.querySelector("[data-actions]").append(play, createRoom, join, shop, draw, gifts, signOut);
    app.appendChild(screen);
}

function rankShop() {
    clearScreen();
    const economy = getEconomy(profile);
    const next = getNextPurchasableRank(profile);
    screen = document.createElement("section");
    screen.className = "menu-screen";
    screen.innerHTML = `
        <article class="menu-panel">
            <p class="eyebrow">CHAT RANK SHOP</p>
            <h2>RANK SHOP</h2>
            <p class="shop-balance">${formatCoins(economy.coins)}</p>
            <div class="rank-list" data-list></div>
            <p class="form-error" data-error hidden></p>
            <div class="menu-actions" data-actions></div>
        </article>`;
    const list = screen.querySelector("[data-list]");
    CHAT_RANKS.forEach(rank => {
        const owned = economy.ownedChatRanks.includes(rank.id);
        const active = rank.id === "CHAMPION" && hasActiveChampion(economy);
        const card = document.createElement("div");
        card.className = "rank-shop-card";
        card.innerHTML = `
            <div><strong class="rank-text--${rank.className}">[${rank.label}]</strong>
            <small>${rank.id === "CHAMPION" ? `${CHAMPION_PRICE.toLocaleString()} Coins / 30 days` : `${rank.price.toLocaleString()} Coins`}</small></div>
            <span>${active ? "ACTIVE" : owned ? "OWNED" : next?.id === rank.id ? "AVAILABLE" : "LOCKED"}</span>`;
        list.appendChild(card);
    });
    const actions = screen.querySelector("[data-actions]");
    const error = screen.querySelector("[data-error]");
    if (next) {
        const buy = button(`BUY [${next.label}]`, true);
        buy.onclick = () => {
            try {
                buyNextRank(profile);
                rankShop();
            } catch (exception) {
                showError(error, exception);
            }
        };
        actions.appendChild(buy);
    } else {
        const champion = button(`CHAMPION: ${CHAMPION_PRICE.toLocaleString()} COINS`, true);
        champion.onclick = () => {
            try {
                buyChampion(profile);
                rankShop();
            } catch (exception) {
                showError(error, exception);
            }
        };
        actions.appendChild(champion);
    }
    const equip = button("EQUIP OWNED RANK");
    const back = button("BACK");
    equip.onclick = ownedRanks;
    back.onclick = home;
    actions.append(equip, back);
    app.appendChild(screen);
}

function ownedRanks() {
    clearScreen();
    const economy = getEconomy(profile);
    screen = document.createElement("section");
    screen.className = "menu-screen";
    screen.innerHTML = `
        <article class="menu-panel">
            <p class="eyebrow">OWNED RANKS</p><h2>SELECT CHAT RANK</h2>
            <div class="rank-list" data-list></div>
            <p class="form-error" data-error hidden></p>
            <div class="menu-actions"><button class="menu-button" data-back>BACK</button></div>
        </article>`;
    const ids = ["PLAYER", ...economy.ownedChatRanks.filter(id => id !== "PLAYER")];
    if (hasActiveChampion(economy)) ids.push("CHAMPION");
    const list = screen.querySelector("[data-list]");
    [...new Set(ids)].forEach(id => {
        const rank = id === "PLAYER"
            ? { id: "PLAYER", label: "Player", className: "player" }
            : getRankById(id);
        if (!rank) return;
        const choice = button(`[${rank.label}]`);
        choice.classList.add(`rank-button--${rank.className}`);
        choice.onclick = () => {
            try {
                equipRank(profile, rank.id);
                home();
            } catch (exception) {
                showError(screen.querySelector("[data-error]"), exception);
            }
        };
        list.appendChild(choice);
    });
    screen.querySelector("[data-back]").onclick = rankShop;
    app.appendChild(screen);
}

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function rarityClass(rank) {
    if (rank.id === "CHAMPION") return "champion";
    if (rank.id === "KING") return "legendary";
    if (["PRO", "PRO_PLUS"].includes(rank.id)) return "epic";
    if (["MVP", "MVP_PLUS"].includes(rank.id)) return "rare";
    if (["GOOD_PLUS", "VIP", "VIP_PLUS"].includes(rank.id)) return "uncommon";
    return "common";
}

async function playDrawAnimation(result) {
    const overlay = document.createElement("section");
    overlay.className = "draw-overlay";
    overlay.innerHTML = `
        <div class="draw-stage" data-stage>
            <p class="draw-stage__eyebrow">RANK DRAW</p>
            <div class="draw-stage__rank rank-text--plus" data-rank>[Plus]</div>
            <div class="draw-stage__drum" data-drum>DRRRRRR...</div>
            <div class="draw-stage__status" data-status>ROLLING...</div>
        </div>`;
    document.body.appendChild(overlay);
    const stage = overlay.querySelector("[data-stage]");
    const rankElement = overlay.querySelector("[data-rank]");
    const drum = overlay.querySelector("[data-drum]");
    const status = overlay.querySelector("[data-status]");

    const sequence = [];
    for (let index = 0; index < 30; index += 1) {
        sequence.push(CHAT_RANKS[Math.floor(Math.random() * CHAT_RANKS.length)]);
    }
    sequence.push(result.rank);

    for (let index = 0; index < sequence.length; index += 1) {
        const rank = sequence[index];
        rankElement.className = `draw-stage__rank rank-text--${rank.className}`;
        rankElement.textContent = `[${rank.label}]`;
        stage.classList.remove("draw-stage--tick");
        void stage.offsetWidth;
        stage.classList.add("draw-stage--tick");
        drum.textContent = index < 18 ? "DRRRRRRRR..." : index < 27 ? "DRR... DRR..." : "DRR...";
        const progress = index / (sequence.length - 1);
        const delay = Math.round(45 + Math.pow(progress, 3) * 430);
        await wait(delay);
    }

    const rarity = rarityClass(result.rank);
    overlay.classList.add(`draw-overlay--${rarity}`);
    stage.classList.add("draw-stage--winner");
    drum.textContent = "";
    status.textContent = result.resultType === "OWNED"
        ? "NEW RANK UNLOCKED"
        : result.resultType === "CHAMPION_PASS"
            ? "30-DAY GIFT PASS ACQUIRED"
            : "DUPLICATE ADDED TO GIFT INVENTORY";

    const actions = document.createElement("div");
    actions.className = "draw-stage__actions";
    const continueButton = button("CONTINUE", true);
    continueButton.onclick = () => {
        overlay.remove();
        drawInProgress = false;
        rankDraw();
    };
    actions.appendChild(continueButton);
    stage.appendChild(actions);
}

function rankDraw() {
    if (drawInProgress) return;
    clearScreen();
    const economy = getEconomy(profile);
    screen = document.createElement("section");
    screen.className = "menu-screen";
    screen.innerHTML = `
        <article class="menu-panel">
            <p class="eyebrow">RANK DRAW</p>
            <h2>40,000 COIN DRAW</h2>
            <p class="shop-balance">${formatCoins(economy.coins)}</p>
            <div class="notice-box">Cost: ${RANK_DRAW_PRICE.toLocaleString()} Coins. Duplicates become gifts.</div>
            <div class="draw-probabilities" data-list></div>
            <p class="form-error" data-error hidden></p>
            <div class="menu-actions" data-actions></div>
        </article>`;
    const list = screen.querySelector("[data-list]");
    CHAT_RANKS.forEach(rank => {
        const row = document.createElement("div");
        row.innerHTML = `<strong class="rank-text--${rank.className}">[${rank.label}]</strong><span>${rank.drawWeight}%</span>`;
        list.appendChild(row);
    });
    const drawButton = button(`DRAW FOR ${RANK_DRAW_PRICE.toLocaleString()} COINS`, true);
    const back = button("BACK");
    drawButton.onclick = async () => {
        if (drawInProgress) return;
        try {
            drawInProgress = true;
            drawButton.disabled = true;
            back.disabled = true;
            const result = drawRank(profile);
            await playDrawAnimation(result);
        } catch (exception) {
            drawInProgress = false;
            drawButton.disabled = false;
            back.disabled = false;
            showError(screen.querySelector("[data-error]"), exception);
        }
    };
    back.onclick = home;
    screen.querySelector("[data-actions]").append(drawButton, back);
    app.appendChild(screen);
}

function giftInventory() {
    clearScreen();
    const economy = getEconomy(profile);
    screen = document.createElement("section");
    screen.className = "menu-screen";
    screen.innerHTML = `
        <article class="menu-panel">
            <p class="eyebrow">GIFT INVENTORY</p><h2>GIFTS</h2>
            <div class="gift-list" data-list></div>
            <div class="menu-actions"><button class="menu-button" data-back>BACK</button></div>
        </article>`;
    const list = screen.querySelector("[data-list]");
    const gifts = Object.entries(economy.giftInventory).filter(([, count]) => Number(count) > 0);
    if (!gifts.length) list.textContent = "No gifts available.";
    gifts.forEach(([rankId, count]) => {
        const rank = getRankById(rankId);
        if (!rank) return;
        const row = document.createElement("div");
        row.className = "gift-row";
        row.innerHTML = `<strong class="rank-text--${rank.className}">[${rank.label}]</strong><span>Ã${count}</span>`;
        const send = button("SEND");
        send.onclick = () => giftRecipient(rankId);
        row.appendChild(send);
        list.appendChild(row);
    });
    screen.querySelector("[data-back]").onclick = home;
    app.appendChild(screen);
}

function giftRecipient(rankId) {
    const { form, error } = panel("SEND GIFT", giftInventory);
    const recipient = input("Login ID, player name, or NPC ID");
    const submit = button("SEND GIFT", true);
    submit.type = "submit";
    form.append(recipient, submit);
    form.onsubmit = event => {
        event.preventDefault();
        try {
            const search = recipient.value.trim().toLowerCase();
            const candidates = [...auth.getProfiles(), ...npcProfiles()];
            const target = candidates.find(candidate =>
                [candidate.id, candidate.loginId, candidate.displayName]
                    .filter(Boolean)
                    .some(value => String(value).toLowerCase() === search)
            );
            if (!target) throw new Error("Player or NPC was not found.");
            giftRank(profile, target, rankId);
            giftInventory();
        } catch (exception) {
            showError(error, exception);
        }
    };
}

function joinRoom() {
    const { form, error } = panel("JOIN ROOM", home);
    const code = input("6-character room code");
    const submit = button("JOIN", true);
    submit.type = "submit";
    form.append(code, submit);
    form.onsubmit = event => {
        event.preventDefault();
        try {
            lobby = new LocalLobbyService(profile);
            lobby.joinRoom(code.value);
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
            <section class="lobby-card"><h2>ROOM <span data-code></span></h2><div data-players></div><div class="menu-actions" data-actions></div></section>
            <section class="lobby-card"><h2>LOBBY CHAT</h2><div class="chat-log" data-chat></div><form class="chat-form"><input maxlength="120" placeholder="Type a message..."><button class="menu-button menu-button--primary">SEND</button></form><p class="form-error" data-error hidden></p></section>
        </div>`;
    const render = room => {
        screen.querySelector("[data-code]").textContent = room.code;
        const players = screen.querySelector("[data-players]");
        players.innerHTML = room.players.map(player => `<div class="player-row"><span>${tagHtml(player)} ${player.displayName}</span><em>${player.ready ? "READY" : "NOT READY"}</em></div>`).join("");
        const log = screen.querySelector("[data-chat]");
        log.replaceChildren(...room.messages.map(message => {
            const line = document.createElement("p");
            const identity = document.createElement("span");
            identity.className = `role-tag role-tag--${message.className}`;
            identity.textContent = `[${message.label}] ${message.displayName}:`;
            const body = document.createElement("span");
            body.className = "chat-message__content";
            body.textContent = ` ${message.content}`;
            line.append(identity, body);
            return line;
        }));
    };
    lobby.addEventListener("update", event => render(event.detail));
    const ready = button("TOGGLE READY", true);
    const start = button("START NPC MATCH");
    const leave = button("LEAVE");
    ready.onclick = () => lobby.toggleReady();
    start.onclick = roulette;
    leave.onclick = () => {
        lobby.leaveRoom();
        home();
    };
    screen.querySelector("[data-actions]").append(ready, start, leave);
    const form = screen.querySelector("form");
    const chatInput = form.querySelector("input");
    const error = screen.querySelector("[data-error]");
    form.onsubmit = event => {
        event.preventDefault();
        try {
            const content = chatInput.value.trim();
            if (content.toLowerCase().startsWith("/coin ") || content.toLowerCase().startsWith("/give coin ")) {
                const result = executeAdminCoinCommand({
                    executor: profile,
                    command: content,
                    profiles: [profile, ...auth.getProfiles(), ...npcProfiles()]
                });
                lobby.sendMessage(`[System] ${result.message}`);
            } else {
                lobby.sendMessage(content);
            }
            chatInput.value = "";
        } catch (exception) {
            showError(error, exception);
        }
    };
    app.appendChild(screen);
    render(lobby.room);
}

function roulette() {
    clearScreen();
    screen = document.createElement("section");
    screen.className = "roulette-screen";
    screen.innerHTML = `<div class="roulette-card"><h2>ROLE ROULETTE</h2><div class="roulette-display" data-role>ESCAPEE</div></div>`;
    app.appendChild(screen);
    const history = JSON.parse(localStorage.getItem("rfl_roles") || "[]");
    const previous = history.at(-1);
    const twoAgo = history.at(-2);
    let chance = 0.25;
    if (previous === "ESCAPEE") chance = 0.45;
    if (previous === "ESCAPEE" && twoAgo === "ESCAPEE") chance = 0.8;
    if (previous === "PURSUER") chance = 0.15;
    if (previous === "PURSUER" && twoAgo === "PURSUER") chance = 0;
    const role = Math.random() < chance ? "PURSUER" : "ESCAPEE";
    localStorage.setItem("rfl_roles", JSON.stringify([...history, role].slice(-2)));
    const element = screen.querySelector("[data-role]");
    let count = 0;
    const tick = () => {
        element.textContent = count % 2 ? "PURSUER" : "ESCAPEE";
        element.dataset.role = element.textContent;
        count += 1;
        if (count < 18) setTimeout(tick, 70 + count * 12);
        else {
            element.textContent = role;
            setTimeout(() => startGame(role), 1100);
        }
    };
    tick();
}

function startGame(role) {
    clearScreen();
    game = new Game(app, {
        role,
        profile,
        profiles: auth.getProfiles(),
        onExit: home,
        onRetry: () => startGame(role),
        onCoinsChanged: () => {}
    });
    game.start();
}

profile ? home() : landing();
