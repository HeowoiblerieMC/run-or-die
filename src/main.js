import "./style.css";
import {AccountService} from "./services/account.js";
import {authScreen} from "./ui/auth.js";
import {Hub} from "./hub/hub.js";
const root=document.querySelector("#app"),accounts=new AccountService;let hub;
async function enter(profile){root.replaceChildren();hub=new Hub(root,{profile,onLogout:async()=>{hub?.stop();if(!profile.guest)await accounts.signOut();showAuth()}});hub.start()}
function showAuth(){root.replaceChildren(authScreen({login:async v=>enter(await accounts.signIn(v.loginId,v.password)),register:async v=>enter(await accounts.register(v)),guest:async()=>enter(accounts.guest())}))}
(async()=>{try{const p=await accounts.current();p?enter(p):showAuth()}catch(e){console.error(e);showAuth()}})();
