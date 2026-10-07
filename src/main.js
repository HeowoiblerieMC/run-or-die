import "./style.css";
import { Game } from "./game.js";

const app = document.querySelector("#app");
if (!app) throw new Error("#app was not found.");
document.querySelector("#startup-status")?.remove();

const ROLE_HISTORY_KEY = "runForLiveRoleHistory";
let game = null;
let screen = null;

function getRoleHistory() {
    try {
        const value = JSON.parse(localStorage.getItem(ROLE_HISTORY_KEY) || "[]");
        return Array.isArray(value) ? value.slice(-2) : [];
    } catch {
        localStorage.removeItem(ROLE_HISTORY_KEY);
        return [];
    }
}

function decideRole() {
    const history = getRoleHistory();
    const previous = history.at(-1);
    const twoAgo = history.at(-2);
    let pursuerChance = 0.25;

    if (previous === "ESCAPEE") pursuerChance = 0.45;
    if (previous === "ESCAPEE" && twoAgo === "ESCAPEE") pursuerChance = 0.8;
    if (previous === "PURSUER") pursuerChance = 0.15;
    if (previous === "PURSUER" && twoAgo === "PURSUER") pursuerChance = 0;

    const role = Math.random() < pursuerChance ? "PURSUER" : "ESCAPEE";
    localStorage.setItem(ROLE_HISTORY_KEY, JSON.stringify([...history, role].slice(-2)));
    return role;
}

function clearScreen() { screen?.remove(); screen = null; }
function stopGame() { game?.stop(); game = null; }
function makeButton(label, className = "") {
    const element = document.createElement("button");
    element.className = `menu-button ${className}`.trim();
    element.textContent = label;
    return element;
}

function showTitle() {
    stopGame();
    clearScreen();
    screen = document.createElement("section");
    screen.className = "title-screen";
    screen.innerHTML = `
        <div class="title-card">
            <p class="eyebrow">NOVA INTERACTIVE</p>
            <h1><span>RUN</span><span>FOR LIVE</span></h1>
            <p class="lead">Restore the facility. Avoid the pursuer. Escape alive.</p>
            <div class="status-grid">
                <div><small>MATCH</small><strong>4 ESCAPEES VS 1 PURSUER</strong></div>
                <div><small>ROLE</small><strong>HISTORY-BALANCED ROULETTE</strong></div>
                <div><small>TEAM</small><strong>NPCS FILL EMPTY SLOTS</strong></div>
            </div>
            <div class="menu-actions" data-actions></div>
        </div>`;
    const play = makeButton("PLAY", "menu-button--primary");
    const help = makeButton("HOW TO PLAY");
    play.addEventListener("click", showRoleRoulette);
    help.addEventListener("click", showHelp);
    screen.querySelector("[data-actions]").append(play, help);
    app.appendChild(screen);
}

function showHelp() {
    clearScreen();
    screen = document.createElement("section");
    screen.className = "menu-screen";
    screen.innerHTML = `
        <article class="menu-panel">
            <p class="eyebrow">FIELD MANUAL</p><h2>HOW TO PLAY</h2>
            <div class="help-grid">
                <div><strong>PC</strong><span>WASD move, mouse or drag look, W + R sprint, Shift sneak, E interact, Esc pause.</span></div>
                <div><strong>TABLET</strong><span>Left joystick move, right drag look, RUN, SNEAK, USE and MENU.</span></div>
                <div><strong>ESCAPEE</strong><span>Restore three terminals with three allies, then escape.</span></div>
                <div><strong>PURSUER</strong><span>Capture four escapees before the exit opens.</span></div>
            </div><div class="menu-actions" data-actions></div>
        </article>`;
    const back = makeButton("BACK");
    back.addEventListener("click", showTitle);
    screen.querySelector("[data-actions]").append(back);
    app.appendChild(screen);
}

function showRoleRoulette() {
    clearScreen();
    screen = document.createElement("section");
    screen.className = "roulette-screen";
    screen.innerHTML = `<div class="roulette-card"><p class="eyebrow">MATCH ASSIGNMENT</p><h2>ROLE ROULETTE</h2><div class="roulette-display" data-role>ESCAPEE</div><p data-message>Determining your role...</p></div>`;
    app.appendChild(screen);

    const roleElement = screen.querySelector("[data-role]");
    const message = screen.querySelector("[data-message]");
    const finalRole = decideRole();
    let count = 0;

    const tick = () => {
        roleElement.textContent = count % 2 === 0 ? "ESCAPEE" : "PURSUER";
        roleElement.dataset.role = roleElement.textContent;
        count += 1;
        if (count < 18) return window.setTimeout(tick, 65 + count * 13);
        roleElement.textContent = finalRole;
        roleElement.dataset.role = finalRole;
        message.textContent = finalRole === "ESCAPEE"
            ? "Three NPC teammates and one NPC pursuer are joining."
            : "Four NPC escapees are joining.";
        window.setTimeout(() => startGame(finalRole), 1500);
    };
    tick();
}

function startGame(role) {
    clearScreen();
    stopGame();
    game = new Game(app, { role, onExit: showTitle, onRetry: () => startGame(role) });
    game.start();
}

showTitle();
