import { getChatIdentity } from "./account.js";
const rooms=new Map();
const roomCode=()=>Array.from({length:6},()=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random()*32)]).join("");
export class LocalLobbyService extends EventTarget{
 constructor(profile){super();this.profile=profile;this.room=null;this.lastMessageAt=0;this.lastMessage=""}
 createRoom(){let code;do code=roomCode();while(rooms.has(code));this.room={code,ownerId:this.profile.id,players:[{...this.profile,ready:false}],messages:[]};rooms.set(code,this.room);this.emit();return this.room}
 joinRoom(code){const room=rooms.get(code.trim().toUpperCase());if(!room)throw Error("Room was not found in this browser session.");if(room.players.length>=5)throw Error("Room is full.");if(!room.players.some(p=>p.id===this.profile.id))room.players.push({...this.profile,ready:false});this.room=room;this.emit();return room}
 toggleReady(){const p=this.room?.players.find(x=>x.id===this.profile.id);if(p){p.ready=!p.ready;this.emit()}}
 leaveRoom(){if(!this.room)return;this.room.players=this.room.players.filter(p=>p.id!==this.profile.id);if(!this.room.players.length)rooms.delete(this.room.code);this.room=null;this.emit()}
 sendMessage(content){if(!this.room)throw Error("Join a room first.");const text=content.trim().slice(0,120),now=Date.now();if(!text)return;if(now-this.lastMessageAt<1000)throw Error("Please wait before sending another message.");if(text===this.lastMessage)throw Error("Duplicate messages are not allowed.");const role=getChatIdentity(this.profile);this.room.messages.push({id:crypto.randomUUID(),displayName:this.profile.displayName,label:role.label,className:role.className,content:text});this.lastMessageAt=now;this.lastMessage=text;this.emit()}
 emit(){this.dispatchEvent(new CustomEvent("update",{detail:this.room}))}
}
