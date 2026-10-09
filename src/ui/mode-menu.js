export function openModeMenu({ onClose, onSelect }) {
    const overlay = document.createElement("section");
    overlay.className = "overlay";
    overlay.innerHTML = `
        <article class="panel mode-panel">
            <p class="eyebrow">PLAY</p>
            <h2>Choose a mode</h2>
            <div class="mode-grid">
                <button data-mode="QUICK">QUICK PLAY<small>Find an open room</small></button>
                <button data-mode="CREATE">CREATE ROOM<small>Make a private room</small></button>
                <button data-mode="JOIN">JOIN ROOM<small>Enter a room code</small></button>
                <button data-mode="SOLO">SOLO TRAINING<small>Practice with NPCs</small></button>
            </div>
            <button data-close>CLOSE</button>
        </article>
    `;
    overlay.querySelectorAll("[data-mode]").forEach(button => {
        button.onclick = () => onSelect(button.dataset.mode);
    });
    overlay.querySelector("[data-close]").onclick = () => {
        overlay.remove();
        onClose?.();
    };
    document.body.appendChild(overlay);
    return overlay;
}
