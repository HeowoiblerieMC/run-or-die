import "./style.css";
import { Game } from "./game.js";

const app = document.querySelector("#app");
if (!app) throw new Error("#app was not found.");

document.querySelector("#startup-status")?.remove();

let game = null;
let screen = null;

function clearScreen() {
    screen?.remove();
    screen = null;
}

function stopGame() {
    game?.stop();
    game = null;
}

function button(label, className = "") {
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
                <div><small>ROLE</small><strong>DECIDED BY ROULETTE</strong></div>
                <div><small>TEAM</small><strong>NPCS FILL EMPTY SLOTS</strong></div>
            </div>
            <div class="menu-actions" data-actions></div>
        </div>
    `;

    const play = button("PLAY", "menu-button--primary");
    const help = button("HOW TO PLAY");
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
            <p class="eyebrow">FIELD MANUAL</p>
            <h2>HOW TO PLAY</h2>
            <div class="help-grid">
                <div><strong>PC</strong><span>WASD move, mouse or drag look, W + R sprint, Shift sneak, E interact, Esc pause.</span></div>
                <div><strong>TABLET</strong><span>Left joystick move, right-side drag look, RUN, SNEAK, USE and MENU buttons.</span></div>
                <div><strong>ESCAPEE</strong><span>Restore three terminals with three NPC teammates, then reach the exit.</span></div>
                <div><strong>PURSUER</strong><span>Track and capture four NPC escapees before they open the exit.</span></div>
            </div>
            <div class="menu-actions" data-actions></div>
        </article>
    `;
    const back = button("BACK");
    back.addEventListener("click", showTitle);
    screen.querySelector("[data-actions]").append(back);
    app.appendChild(screen);
}

function showRoleRoulette() {
    clearScreen();
    screen = document.createElement("section");
    screen.className = "roulette-screen";
    screen.innerHTML = `
        <div class="roulette-card">
            <p class="eyebrow">MATCH ASSIGNMENT</p>
            <h2>ROLE ROULETTE</h2>
            <div class="roulette-display" data-role>ESCAPEE</div>
            <p data-message>Determining your role...</p>
        </div>
    `;
    app.appendChild(screen);

    const roleText = screen.querySelector("[data-role]");
    const message = screen.querySelector("[data-message]");
    const finalRole = Math.random() < 0.7 ? "ESCAPEE" : "PURSUER";
    let count = 0;
    const maximum = 18;

    const tick = () => {
        roleText.textContent = count % 2 === 0 ? "ESCAPEE" : "PURSUER";
        roleText.dataset.role = roleText.textContent;
        count += 1;
        if (count < maximum) {
            window.setTimeout(tick, 65 + count * 13);
            return;
        }
        roleText.textContent = finalRole;
        roleText.dataset.role = finalRole;
        message.textContent = finalRole === "ESCAPEE"
            ? "Three NPC teammates and one NPC pursuer are joining."
            : "Four NPC escapees are joining.";
        window.setTimeout(() => startGame(finalRole), 1600);
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
