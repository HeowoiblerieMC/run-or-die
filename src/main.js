import "./style.css";

import {
    AccountService
} from "./services/account.js";

import {
    createAuthScreen
} from "./ui/auth.js";

import {
    Hub
} from "./hub/hub.js";

const app =
    document.querySelector("#app");

const accounts =
    new AccountService();

let currentHub = null;

async function enterHub(profile) {
    if (currentHub) {
        await currentHub.stop();
        currentHub = null;
    }

    app.replaceChildren();

    currentHub = new Hub(app, {
        profile,

        onLogout: async () => {
            try {
                await currentHub?.stop();
            } finally {
                currentHub = null;
            }

            if (!profile.guest) {
                await accounts.signOut();
            }

            showAuthentication();
        }
    });

    await currentHub.start();
}

function showAuthentication() {
    app.replaceChildren(
        createAuthScreen({
            onSignIn: async values => {
                const profile =
                    await accounts.signIn(
                        values.loginId,
                        values.password
                    );

                await enterHub(profile);
            },

            onRegister: async values => {
                const profile =
                    await accounts.register(
                        values
                    );

                await enterHub(profile);
            },

            onGuest: async () => {
                await enterHub(
                    accounts.createGuest()
                );
            }
        })
    );
}

async function startApplication() {
    try {
        const profile =
            await accounts.getCurrentProfile();

        if (profile) {
            await enterHub(profile);
        } else {
            showAuthentication();
        }
    } catch (error) {
        console.error(
            "Application start failed:",
            error
        );

        showAuthentication();
    }
}

startApplication();
