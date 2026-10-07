import "./style.css";

import {
    Game
} from "./game.js";

const app =
    document.querySelector(
        "#app"
    );

if (!app) {
    throw new Error(
        "Application container was not found."
    );
}

let game = null;
let currentScreen = null;

function clearScreen() {
    currentScreen?.remove();
    currentScreen = null;
}

function stopGame() {
    game?.stop();
    game = null;
}

function createButton(
    label,
    className = ""
) {
    const button =
        document.createElement(
            "button"
        );

    button.className =
        `menu-button ${className}`;

    button.textContent =
        label;

    return button;
}

function showTitleScreen() {
    stopGame();
    clearScreen();

    const screen =
        document.createElement(
            "section"
        );

    screen.className =
        "title-screen";

    screen.innerHTML = `
        <div class="title-screen__noise"></div>

        <div class="title-screen__content">
            <p class="eyebrow">
                NOVA INTERACTIVE PRESENTS
            </p>

            <h1>
                <span>RUN</span>
                <span>FOR LIVE</span>
            </h1>

            <p class="title-description">
                Restore the facility systems.
                Avoid the pursuer.
                Reach the exit before time runs out.
            </p>

            <div class="title-status">
                <div>
                    <span>FACILITY</span>
                    <strong>RESEARCH SITE 07</strong>
                </div>

                <div>
                    <span>OBJECTIVE</span>
                    <strong>ESCAPE</strong>
                </div>

                <div>
                    <span>THREAT</span>
                    <strong>ACTIVE</strong>
                </div>
            </div>

            <div
                class="title-actions"
                data-title-actions
            ></div>

            <p class="version-label">
                PROTOTYPE 0.1
            </p>
        </div>
    `;

    const actions =
        screen.querySelector(
            "[data-title-actions]"
        );

    const startButton =
        createButton(
            "START",
            "menu-button--primary"
        );

    const instructionsButton =
        createButton(
            "HOW TO PLAY"
        );

    startButton.addEventListener(
        "click",
        () => {
            startGame();
        }
    );

    instructionsButton.addEventListener(
        "click",
        () => {
            showInstructions();
        }
    );

    actions.append(
        startButton,
        instructionsButton
    );

    app.appendChild(
        screen
    );

    currentScreen =
        screen;
}

function showInstructions() {
    clearScreen();

    const screen =
        document.createElement(
            "section"
        );

    screen.className =
        "menu-screen";

    screen.innerHTML = `
        <article class="menu-panel">
            <p class="eyebrow">
                SURVIVAL GUIDE
            </p>

            <h1>
                HOW TO PLAY
            </h1>

            <div class="instructions-grid">
                <div>
                    <span>W / A / S / D</span>
                    <strong>Move</strong>
                </div>

                <div>
                    <span>MOUSE</span>
                    <strong>Look around</strong>
                </div>

                <div>
                    <span>W + R</span>
                    <strong>Sprint</strong>
                </div>

                <div>
                    <span>SHIFT</span>
                    <strong>Sneak</strong>
                </div>

                <div>
                    <span>E</span>
                    <strong>Repair or use exit</strong>
                </div>

                <div>
                    <span>ESC</span>
                    <strong>Pause</strong>
                </div>
            </div>

            <div class="instructions-objective">
                <h2>OBJECTIVE</h2>

                <ol>
                    <li>
                        Locate all three repair terminals.
                    </li>

                    <li>
                        Hold E near a terminal to restore it.
                    </li>

                    <li>
                        Avoid the pursuer.
                    </li>

                    <li>
                        Reach the exit after all terminals are restored.
                    </li>
                </ol>
            </div>

            <div
                class="menu-actions"
                data-menu-actions
            ></div>
        </article>
    `;

    const backButton =
        createButton(
            "BACK"
        );

    backButton.addEventListener(
        "click",
        showTitleScreen
    );

    screen
        .querySelector(
            "[data-menu-actions]"
        )
        .appendChild(
            backButton
        );

    app.appendChild(
        screen
    );

    currentScreen =
        screen;
}

function startGame() {
    clearScreen();
    stopGame();

    game =
        new Game(
            app,
            {
                onExit:
                    showTitleScreen
            }
        );

    game.start();
}

document
    .querySelector(
        "#startup-status"
    )
    ?.remove();

showTitleScreen();
