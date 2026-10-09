export function createAuthScreen({
    onSignIn,
    onRegister,
    onGuest
}) {
    const screen =
        document.createElement("main");

    screen.className = "auth-screen";

    screen.innerHTML = `
        <section class="auth-panel panel">
            <p class="eyebrow">
                ONLINE
            </p>

            <h1>
                RUN FOR LIVE
            </h1>

            <p class="muted">
                Sign in and enter the main lobby.
            </p>

            <form data-sign-in>
                <h2>SIGN IN</h2>

                <label>
                    Login ID

                    <input
                        name="loginId"
                        type="text"
                        minlength="4"
                        maxlength="20"
                        autocomplete="username"
                        autocapitalize="none"
                        spellcheck="false"
                        required
                    >
                </label>

                <label>
                    Password

                    <input
                        name="password"
                        type="password"
                        minlength="8"
                        autocomplete="current-password"
                        required
                    >
                </label>

                <button
                    class="primary"
                    type="submit"
                >
                    SIGN IN
                </button>
            </form>

            <details class="register-panel">
                <summary>
                    CREATE ACCOUNT
                </summary>

                <form data-register>
                    <label>
                        Display name

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
                        Login ID

                        <input
                            name="loginId"
                            type="text"
                            minlength="4"
                            maxlength="20"
                            autocomplete="username"
                            autocapitalize="none"
                            spellcheck="false"
                            required
                        >
                    </label>

                    <label>
                        Password

                        <input
                            name="password"
                            type="password"
                            minlength="8"
                            autocomplete="new-password"
                            required
                        >
                    </label>

                    <label>
                        Confirm password

                        <input
                            name="confirmPassword"
                            type="password"
                            minlength="8"
                            autocomplete="new-password"
                            required
                        >
                    </label>

                    <button
                        class="primary"
                        type="submit"
                    >
                        CREATE ACCOUNT
                    </button>
                </form>
            </details>

            <button
                data-guest
                type="button"
            >
                CONTINUE AS GUEST
            </button>

            <p
                class="auth-status"
                data-status
                hidden
            >
                CONNECTING...
            </p>

            <p
                class="error"
                data-error
                hidden
            ></p>
        </section>
    `;

    const errorElement =
        screen.querySelector(
            "[data-error]"
        );

    const statusElement =
        screen.querySelector(
            "[data-status]"
        );

    const buttons =
        screen.querySelectorAll(
            "button"
        );

    async function run(action) {
        errorElement.hidden = true;
        statusElement.hidden = false;

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
            statusElement.hidden = true;

            buttons.forEach(button => {
                button.disabled = false;
            });
        }
    }

    screen
        .querySelector("[data-sign-in]")
        .addEventListener(
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

    screen
        .querySelector("[data-register]")
        .addEventListener(
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
