import { supabase } from "../supabase.js";
export class LeaderboardService{async load(category,limit,viewer){const {data,error}=await supabase.rpc("get_leaderboard",{p_category:category,p_limit:limit,p_viewer:viewer?.guest?null:viewer?.id});if(error)throw new Error(error.message);return data}}
