import type {World} from '../../shared/src/types';
import {distance} from '../../residents/src/simulation';
import {event} from '../../world-core/src/world';
import {remember} from './memory';
export function invite(w:World,aId:string,bId:string,topic='水井与开拓生活'){
 const a=w.residents.find(r=>r.id===aId),b=w.residents.find(r=>r.id===bId);
 if(!a||!b||a===b||distance(a,b)>3)throw new Error('无法在当前地点邀请');
 const id=`conversation-${w.eventSeq+1}`;
 if([a,b].some(r=>r.conversationId||r.projectId||r.current_action==='SLEEPING'||r.needs.thirst>90||r.needs.hunger>90||r.busyUntil>w.gameTime)){
  const c={id,participants:[aId,bId],topic,status:'REJECTED',messages:[],start:w.gameTime,end:w.gameTime,reason:'当前需求或承诺优先'};w.conversations.push(c);event(w,'conversation.rejected',{id,participants:c.participants,reason:c.reason});return c;
 }
 const c={id,participants:[aId,bId],topic,status:'ACTIVE',messages:[] as any[],start:w.gameTime,end:undefined as number|undefined,nextAt:w.gameTime,turns:0,maxTurns:4,maxMinutes:30};
 w.conversations.push(c);for(const r of [a,b]){r.conversationId=id;r.current_action='SOCIALIZING';}event(w,'conversation.started',{id,participants:c.participants,topic});return c;
}
export function speak(w:World,id:string,speakerId:string,text:string,privacy='PUBLIC'){
 const c=w.conversations.find(c=>c.id===id);if(!c||c.status!=='ACTIVE'||!c.participants.includes(speakerId))throw new Error('无效会话');
 if(text.length>500)throw new Error('发言过长');const message={seq:c.messages.length+1,speakerId,text,game_time:w.gameTime,privacy};c.messages.push(message);
 const e=event(w,'resident.speech',{conversationId:id,...message},speakerId,privacy==='PUBLIC'?'PUBLIC':c.participants);
 for(const rId of c.participants)remember(w,rId,text,e.id,privacy,'EXPERIENCED',[speakerId]);
 return message;
}
export function endConversation(w:World,c:any){if(c.status!=='ACTIVE')return;c.status='ENDED';c.end=w.gameTime;
 for(const id of c.participants){const r=w.residents.find(r=>r.id===id);r.conversationId=undefined;r.current_action='IDLE';r.busyUntil=w.gameTime+20;const other=c.participants.find((n:string)=>n!==id);if(r.relations[other]){r.relations[other].familiarity=Math.min(100,r.relations[other].familiarity+2);r.relations[other].trust=Math.min(100,r.relations[other].trust+1);}remember(w,id,`与${w.residents.find(r=>r.id===other).name}讨论${c.topic}；决定留意水井与合作机会。`,c.id,'PRIVATE','EXPERIENCED',[other]);if(!r.goals.some((g:any)=>g.content==='留意水井并寻找合作机会'))r.goals.push({id:`goal:${c.id}:${id}`,term:'SHORT',content:'留意水井并寻找合作机会',status:'ACTIVE'});}
 event(w,'conversation.ended',{id:c.id});}
export function socialTick(w:World){
 for(const c of w.conversations.filter(c=>c.status==='ACTIVE')){
  if(w.gameTime-c.start>c.maxMinutes||c.turns>=c.maxTurns||c.participants.some((id:string)=>{const r=w.residents.find(r=>r.id===id);return r.needs.thirst>90||r.needs.hunger>90;})){endConversation(w,c);continue;}
  if(w.gameTime<c.nextAt)continue;const r=w.residents.find(r=>r.id===c.participants[c.turns%2]);
  const memory=r.memories.find((m:any)=>m.game_time<w.gameTime-1440&&m.salience>=70);
  const text=memory?`我还记得${memory.content.slice(0,65)}。今天也想把${r.goals.at(-1)?.content??'工作'}做好。`:
   c.turns<2?`${r.name}：我想${r.goals.find((g:any)=>g.term==='LONG')?.content}。${r.values[1]}对我很重要，我们需要先了解井和物资的实际情况。`:`我愿意留意${c.topic}，如果条件安全、报酬合理，可以一起合作。`;
  speak(w,c.id,r.id,text);c.turns++;c.nextAt=w.gameTime+3;
 }
 if(w.gameTime<(w.nextSocialAt??0))return;w.nextSocialAt=w.gameTime+25;
 const idle=w.residents.filter(r=>!r.conversationId&&!r.projectId&&r.current_action==='RESTING'&&r.busyUntil<=w.gameTime);
 for(const a of idle){const b=idle.find(b=>b!==a&&!b.conversationId&&distance(a,b)<=3);if(b&&!a.conversationId)invite(w,a.id,b.id);}
}
