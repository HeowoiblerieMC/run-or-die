export function openModeMenu({
    onSelect
}) {
    const overlay =
        document.createElement(
            "section"
        );

    overlay.className =
        "overlay";

    overlay.innerHTML = `
        <article class="panel mode-panel">
            <h2>PLAY</h2>

            <button data-mode="QUICK">
                QUICK PLAY
            </button>

            <button data-mode="CREATE">
                CREATE ROOM
            </button>

            <button data-mode="JOIN">
                JOIN ROOM
            </button>

            <button data-mode="SOLO">
                SOLO TRAINING
            </button>

            <button data-close>
                CLOSE
            </button>
        </article>
    `;

    overlay
        .querySelectorAll(
            "[data-mode]"
        )
        .forEach(
            button => {
                button.addEventListener(
                    "click",
                    () => {
                        onSelect?.(
                            button.dataset.mode
                        );
                    }
                );
            }
        );

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

    return overlay;
}
