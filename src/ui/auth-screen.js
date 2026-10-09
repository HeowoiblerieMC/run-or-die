export function createAuthScreen({
    onSignIn,
    onRegister,
    onGuest
}) {
    const screen = document.createElement("main");

    screen.className = "auth-screen";

    screen.innerHTML = `
        <section class="auth-card">
            <div class="auth-brand">
                <span class="auth-brand__status">
                    ONLINE
                </span>

                <h1>
                    RUN FOR<br>
                    LIVE
                </h1>

                <p>
                    Sign in and enter the main lobby.
                </p>
            </div>

            <form
                class="auth-form"
                data-sign-in
            >
                <h2>SIGN IN</h2>

                <label>
                    <span>Login ID</span>

                    <input
                        name="loginId"
                        type="text"
                        minlength="4"
                        maxlength="20"
                        autocapitalize="none"
                        autocomplete="username"
                        spellcheck="false"
                        required
                    >
                </label>

                <label>
                    <span>Password</span>

                    <input
                        name="password"
                        type="password"
                        minlength="8"
                        autocomplete="current-password"
                        required
                    >
                </label>

                <button
                    class="auth-primary"
                    type="submit"
                >
                    SIGN IN
                </button>
            </form>

            <details class="register-panel">
                <summary>
                    CREATE ACCOUNT
                </summary>

                <form
                    class="auth-form"
                    data-register
                >
                    <label>
                        <span>Display name</span>

                        <input
                            name="displayName"
                            type="text"
                            minlength="3"
                            maxlength="16"
                            autocomplete="nickname"
                            required
                        >
                    </label>

                    <label>
                        <span>Login ID</span>

                        <input
                            name="loginId"
                            type="text"
                            minlength="4"
                            maxlength="20"
                            autocapitalize="none"
                            autocomplete="username"
                            spellcheck="false"
                            required
                        >
                    </label>

                    <label>
                        <span>Password</span>

                        <input
                            name="password"
                            type="password"
                            minlength="8"
                            autocomplete="new-password"
                            required
                        >
                    </label>

                    <label>
                        <span>Confirm password</span>

                        <input
                            name="confirmPassword"
                            type="password"
                            minlength="8"
                            autocomplete="new-password"
                            required
                        >
                    </label>

                    <button
                        class="auth-primary"
                        type="submit"
                    >
                        CREATE ACCOUNT
                    </button>
                </form>
            </details>

            <button
                class="auth-guest"
                data-guest
                type="button"
            >
                CONTINUE AS GUEST
            </button>

            <div
                class="auth-loading"
                data-loading
                hidden
            >
                CONNECTING...
            </div>

            <p
                class="auth-error"
                data-error
                hidden
            ></p>
        </section>
    `;

    const errorElement =
        screen.querySelector("[data-error]");

    const loadingElement =
        screen.querySelector("[data-loading]");

    const buttons =
        screen.querySelectorAll("button");

    async function run(action) {
        errorElement.hidden = true;
        loadingElement.hidden = false;

        buttons.forEach(button => {
            button.disabled = true;
        });

        try {
            await action();
        } catch (error) {
            errorElement.textContent =
                error?.message ||
                String(error);

            errorElement.hidden = false;
        } finally {
            loadingElement.hidden = true;

            buttons.forEach(button => {
                button.disabled = false;
            });
        }
    }

    const signInForm =
        screen.querySelector("[data-sign-in]");

    signInForm.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            const values =
                Object.fromEntries(
                    new FormData(
                        event.currentTarget
                    )
                );

            run(() => onSignIn(values));
        }
    );

    const registerForm =
        screen.querySelector("[data-register]");

    registerForm.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            const values =
                Object.fromEntries(
                    new FormData(
                        event.currentTarget
                    )
                );

            run(() => onRegister(values));
        }
    );

    screen
        .querySelector("[data-guest]")
        .addEventListener(
            "click",
            () => run(onGuest)
        );

    return screen;
}
