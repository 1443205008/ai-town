import type {World} from '../../shared/src/types';
export function remember(w:World,ownerId:string,content:string,sourceId:string,privacy='PRIVATE',sourceType='EXPERIENCED',subjectIds:string[]=[],confidence=1){
 const r=w.residents.find(r=>r.id===ownerId);if(!r)throw new Error('居民不存在');
 r.memories??=[];
 const id=`${ownerId}:${sourceId}:${content}`;if(r.memories.some((m:any)=>m.id===id))return;
 r.memories.push({id,owner_id:ownerId,type:'EPISODIC',content,source_type:sourceType,source_id:sourceId,subject_ids:subjectIds,location_id:`${r.x},${r.y}`,game_time:w.gameTime,salience:70,confidence,privacy,hearsay_depth:sourceType==='HEARSAY'?1:0,created_at:w.gameTime,updated_at:w.gameTime});
}
export function contextFor(w:World,residentId:string,purpose='planning'){
 const r=w.residents.find(r=>r.id===residentId);if(!r)throw new Error('居民不存在');
 const memories=[...r.memories].sort((a:any,b:any)=>(b.salience+b.confidence*20-(w.gameTime-b.game_time)/1440*3)-(a.salience+a.confidence*20-(w.gameTime-a.game_time)/1440*3)).slice(0,20);
 return {purpose,profile:{id:r.id,name:r.name,role:r.role,background:r.background,traits:r.traits,tendencies:r.tendencies,values:r.values,skills:r.skills},state:{position:{x:r.x,y:r.y},needs:r.needs,health:r.health,cash:r.cash,current_action:r.current_action},goals:r.goals,memories,knowledge:r.knowledge,relations:r.relations,secret:r.secret,publicNotices:w.events.filter(e=>e.visibility==='PUBLIC').slice(-10),version:w.version};
}
export function hear(w:World,from:string,to:string,memoryId:string){
 const a=w.residents.find(r=>r.id===from),b=w.residents.find(r=>r.id===to),m=a?.memories.find((m:any)=>m.id===memoryId);
 if(!a||!b||!m)throw new Error('未知转述来源');if(m.privacy==='CONFIDENTIAL')throw new Error('保密内容禁止传播');
 remember(w,to,`${a.name}告诉我：${m.content}`,m.id,'PRIVATE','HEARSAY',[from],m.confidence*.8);
 const last=b.memories.at(-1);last.hearsay_depth=m.hearsay_depth+1;
}
