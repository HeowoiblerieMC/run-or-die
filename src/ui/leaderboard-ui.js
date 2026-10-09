import { LEADERBOARD_CATEGORIES } from "../config.js";
import { rankForProfile } from "../services/economy-service.js";

const plural = (value, unit) => value === 1 ? unit.replace(/s$/, "") : unit;

export function createLeaderboardUi({ service, profile }) {
    const overlay = document.createElement("section");
    overlay.className = "overlay";
    overlay.innerHTML = `
        <article class="panel leaderboard-panel">
            <header>
                <div>
                    <p class="eyebrow">MAIN LOBBY</p>
                    <h2 data-title>WIN LEADS</h2>
                </div>
                <button data-close>×</button>
            </header>
            <nav data-tabs></nav>
            <p class="you-line" data-you>Loading...</p>
            <ol data-list></ol>
        </article>
    `;

    const tabs = overlay.querySelector("[data-tabs]");
    const list = overlay.querySelector("[data-list]");
    const title = overlay.querySelector("[data-title]");
    const you = overlay.querySelector("[data-you]");
    let active = LEADERBOARD_CATEGORIES[0];

    async function load(category) {
        active = category;
        title.textContent = category.title;
        list.innerHTML = "<li>Loading...</li>";
        const result = await service.load(category.key, category.limit, profile);
        const mine = result.viewer;
        you.textContent = profile.guest
            ? "You: Sign in to enter the leaderboard"
            : `You: ${mine?.value || 0} ${plural(mine?.value || 0, category.unit)} (${mine?.rank ? `#${mine.rank}` : "Unranked"})`;
        list.replaceChildren(...result.entries.map(entry => {
            const item = document.createElement("li");
            const rank = rankForProfile({ role: entry.role, selectedRank: entry.selected_rank });
            item.innerHTML = `<strong>#${entry.position}</strong> <span class="rank rank--${rank.className}">[${rank.label}]</span> ${entry.display_name}: <b>${entry.value} ${plural(entry.value, category.unit)}</b>`;
            return item;
        }));
    }

    for (const category of LEADERBOARD_CATEGORIES) {
        const button = document.createElement("button");
        button.textContent = category.key === "rank_gifts_sent" ? "GIFTS" : category.key.toUpperCase();
        button.onclick = () => load(category).catch(error => {
            list.innerHTML = `<li>${error.message}</li>`;
        });
        tabs.appendChild(button);
    }

    overlay.querySelector("[data-close]").onclick = () => overlay.remove();
    document.body.appendChild(overlay);
    load(active).catch(error => { list.innerHTML = `<li>${error.message}</li>`; });
    return overlay;
}

