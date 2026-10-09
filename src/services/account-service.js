import { supabase,testConnection } from "../supabase.js";
const clean=v=>String(v||"").trim().toLowerCase();
const email=id=>`${clean(id)}@players.runforlive.example`;
const profile=row=>({id:row.id,loginId:row.login_id,displayName:row.display_name,role:row.role,selectedRank:row.selected_rank||"PLAYER",guest:false});
export class AccountService{
 async current(){const {data,error}=await supabase.auth.getSession();if(error)throw error;if(!data.session)return null;return this.profile(data.session.user.id)}
 async profile(id){const {data,error}=await supabase.from("profiles").select("id,login_id,display_name,role,selected_rank").eq("id",id).single();if(error)throw new Error(`Profile load failed: ${error.message}`);return profile(data)}
 async register({displayName,loginId,password}){
  await testConnection();const n=String(displayName||"").trim(),id=clean(loginId),pw=String(password||"");
  if(n.length<3||n.length>16)throw new Error("Name must be 3 to 16 characters.");
  if(!/^[a-z0-9_]{4,20}$/.test(id))throw new Error("Login ID must be 4 to 20 lowercase letters, numbers, or underscores.");
  if(pw.length<8)throw new Error("Password must be at least 8 characters.");
  const {data,error}=await supabase.auth.signUp({email:email(id),password:pw,options:{data:{login_id:id,display_name:n}}});
  if(error)throw new Error(error.message);if(!data.user)throw new Error("Account creation failed.");
  if(!data.session)throw new Error("Account created, but email confirmation is enabled. Turn Confirm email OFF in Supabase Authentication settings.");
  return this.profile(data.user.id)
 }
 async signIn(id,password){await testConnection();const {data,error}=await supabase.auth.signInWithPassword({email:email(id),password});if(error)throw new Error("Login ID or password is incorrect.");return this.profile(data.user.id)}
 guest(){return{id:`guest_${crypto.randomUUID()}`,displayName:"Guest",role:"GUEST",selectedRank:"PLAYER",guest:true}}
 async signOut(){await supabase.auth.signOut()}
}
