import {
    LEADERBOARD_CATEGORIES
} from "../config.js";

export function createLeaderboardUi({
    service,
    profile
}) {
    const overlay =
        document.createElement(
            "section"
        );

    overlay.className =
        "overlay";

    overlay.innerHTML = `
        <article class="panel leaderboard-panel">
            <header>
                <h2 data-title></h2>

                <button data-close>
                    CLOSE
                </button>
            </header>

            <nav data-tabs></nav>

            <p data-you></p>

            <ol data-list></ol>
        </article>
    `;

    const title =
        overlay.querySelector(
            "[data-title]"
        );

    const tabs =
        overlay.querySelector(
            "[data-tabs]"
        );

    const you =
        overlay.querySelector(
            "[data-you]"
        );

    const list =
        overlay.querySelector(
            "[data-list]"
        );

    async function load(
        category
    ) {
        title.textContent =
            category.title;

        list.textContent =
            "LOADING...";

        const data =
            await service.load(
                category.key,
                category.limit,
                profile
            );

        if (
            profile.guest
        ) {
            you.textContent =
                "You: Sign in to enter the leaderboard";
        } else {
            const value =
                data.viewer?.value ||
                0;

            const rank =
                data.viewer?.rank;

            you.textContent =
                `You: ${value} ${category.unit} ` +
                `(${rank ? `#${rank}` : "Unranked"})`;
        }

        const entries =
            Array.isArray(
                data.entries
            )
                ? data.entries
                : [];

        list.replaceChildren(
            ...entries.map(
                entry => {
                    const line =
                        document.createElement(
                            "li"
                        );

                    let rankLabel =
                        entry.selected_rank ||
                        "Player";

                    if (
                        entry.role ===
                        "ADMIN"
                    ) {
                        rankLabel =
                            "Admin";
                    }

                    if (
                        entry.role ===
                        "MODERATOR"
                    ) {
                        rankLabel =
                            "Mod";
                    }

                    line.textContent =
                        `#${entry.position} ` +
                        `[${rankLabel}] ` +
                        `${entry.display_name}: ` +
                        `${entry.value} ` +
                        `${category.unit}`;

                    return line;
                }
            )
        );
    }

    for (
        const category of
        LEADERBOARD_CATEGORIES
    ) {
        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.textContent =
            category.key ===
            "rank_gifts_sent"
                ? "GIFTS"
                : category.key
                    .toUpperCase();

        button.addEventListener(
            "click",
            () => {
                load(
                    category
                ).catch(
                    error => {
                        list.textContent =
                            error?.message ||
                            String(error);
                    }
                );
            }
        );

        tabs.appendChild(
            button
        );
    }

    overlay
        .querySelector(
            "[data-close]"
        )
        .addEventListener(
            "click",
            () =>
                overlay.remove()
        );

    document.body.appendChild(
        overlay
    );

    load(
        LEADERBOARD_CATEGORIES[
            0
        ]
    ).catch(
        error => {
            list.textContent =
                error?.message ||
                String(error);
        }
    );

    return overlay;
}
