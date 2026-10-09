export function createAuthScreen({ onSignIn, onRegister, onGuest }) {
    const root = document.createElement("main");
    root.className = "auth-screen";
    root.innerHTML = `
        <section class="panel auth-panel">
            <p class="eyebrow">ONLINE REBUILD</p>
            <h1>RUN FOR LIVE</h1>
            <p class="muted">Sign in, then enter the main lobby.</p>

            <form data-sign-in>
                <h2>Sign in</h2>
                <label>Login ID<input name="loginId" required autocomplete="username"></label>
                <label>Password<input name="password" type="password" required autocomplete="current-password"></label>
                <button class="primary">SIGN IN</button>
            </form>

            <details>
                <summary>Create account</summary>
                <form data-register>
                    <label>Name<input name="displayName" minlength="3" maxlength="16" required></label>
                    <label>Login ID<input name="loginId" minlength="4" maxlength="20" required></label>
                    <label>Password<input name="password" type="password" minlength="12" required></label>
                    <button class="primary">CREATE ACCOUNT</button>
                </form>
            </details>

            <button data-guest>CONTINUE AS GUEST</button>
            <p class="error" data-error hidden></p>
        </section>
    `;

    const error = root.querySelector("[data-error]");
    const run = async task => {
        error.hidden = true;
        try { await task(); }
        catch (exception) {
            error.textContent = exception.message || String(exception);
            error.hidden = false;
        }
    };

    root.querySelector("[data-sign-in]").onsubmit = event => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget));
        run(() => onSignIn(values));
    };

    root.querySelector("[data-register]").onsubmit = event => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget));
        run(() => onRegister(values));
    };

    root.querySelector("[data-guest]").onclick = () => run(onGuest);
    return root;
}
