export function createAuthScreen({
    onSignIn,
    onRegister,
    onGuest
}) {
    const screen =
        document.createElement(
            "main"
        );

    screen.className =
        "auth-screen";

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

            <form data-login>
                <h2>SIGN IN</h2>

                <label>
                    Login ID

                    <input
                        name="loginId"
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
                            minlength="3"
                            maxlength="16"
                            required
                        >
                    </label>

                    <label>
                        Login ID

                        <input
                            name="loginId"
                            minlength="4"
                            maxlength="20"
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
                            required
                        >
                    </label>

                    <label>
                        Confirm password

                        <input
                            name="confirmPassword"
                            type="password"
                            minlength="8"
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

    async function run(
        action
    ) {
        errorElement.hidden =
            true;

        try {
            await action();
        } catch (
            error
        ) {
            errorElement.textContent =
                error?.message ||
                String(error);

            errorElement.hidden =
                false;
        }
    }

    screen
        .querySelector(
            "[data-login]"
        )
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

                run(
                    () =>
                        onSignIn(
                            values
                        )
                );
            }
        );

    screen
        .querySelector(
            "[data-register]"
        )
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

                run(
                    () =>
                        onRegister(
                            values
                        )
                );
            }
        );

    screen
        .querySelector(
            "[data-guest]"
        )
        .addEventListener(
            "click",
            () =>
                run(
                    onGuest
                )
        );

    return screen;
}
