import "./style.css";
import { AccountService } from "./services/account-service.js";
import { createAuthScreen } from "./ui/auth-screen.js";
import { Hub } from "./hub/hub.js";

const app = document.querySelector("#app");
const accounts = new AccountService();
let hub = null;

async function showHub(profile) {
    app.replaceChildren();
    hub = new Hub(app, {
        profile,
        onSignOut: async () => {
            await hub?.stop();
            hub = null;
            if (!profile.guest) await accounts.signOut();
            showAuth();
        }
    });
    await hub.start();
}

function showAuth() {
    app.replaceChildren(createAuthScreen({
        onSignIn: async values => showHub(await accounts.signIn(values.loginId, values.password)),
        onRegister: async values => showHub(await accounts.register(values)),
        onGuest: async () => showHub(accounts.createGuest())
    }));
}

async function boot() {
    try {
        const profile = await accounts.getCurrentProfile();
        if (profile) await showHub(profile);
        else showAuth();
    } catch (error) {
        console.error(error);
        showAuth();
    }
}

boot();
