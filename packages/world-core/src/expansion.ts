import type {World,Point} from '../../shared/src/types';
import {event,loadJSON} from './world';
import {inventory,transfer,available} from '../../economy/src/economy';
import {remember} from '../../agent-runtime/src/memory';
export function explore(w:World,key:string,site:Point,team:string[]){
 if(site.x<0||site.y<0||site.x>=w.map.width||site.y>=w.map.height||!team.length)throw new Error('探索目标非法');
 const people=team.map(id=>w.residents.find(r=>r.id===id));if(people.some(r=>!r||r.projectId||r.conversationId||r.needs.energy<30))throw new Error('探索志愿者当前不可用');
 if(w.resources.water<team.length*2||w.resources.food<team.length*2)throw new Error('探索补给不足');
 inventory(w,`${key}:water`,'water',-team.length*2,'探索队补给');inventory(w,`${key}:food`,'food',-team.length*2,'探索队补给');
 w.expeditions??=[];const e={id:key,site,team,status:'IN_PROGRESS',started:w.gameTime,completes:w.gameTime+180};w.expeditions.push(e);for(const r of people){r.projectId=key;r.current_action='EXPLORING';}event(w,'expedition.started',e,'MAYOR','PUBLIC',key);
}
export function expansionTick(w:World){
 for(const e of w.expeditions??[])if(e.status==='IN_PROGRESS'&&e.completes<=w.gameTime){e.status='COMPLETED';for(let y=Math.max(0,e.site.y-5);y<Math.min(w.map.height,e.site.y+6);y++)for(let x=Math.max(0,e.site.x-5);x<Math.min(w.map.width,e.site.x+6);x++)w.map.fog_of_war[y*w.map.width+x]=true;const ev=event(w,'expedition.completed',{id:e.id,site:e.site,discovery:'勘察地形与潜在水源'});for(const id of e.team){const r=w.residents.find(r=>r.id===id);r.projectId=undefined;r.current_action='IDLE';remember(w,id,'我完成了地形与水源勘察。',ev.id,'PUBLIC');}w.surveyed??=[];w.surveyed.push(e.site);}
}
export function expandChunk(w:World,key:string){
 if(!w.surveyed?.length)throw new Error('需先完成勘察才能扩展');if(available(w)<200)throw new Error('开拓预算不足');transfer(w,key,'PUBLIC','EXTERNAL',200,'区域测绘并入规划');
 const m=w.map,oldWidth=m.width,newWidth=oldWidth+16;if(newWidth>128)throw new Error('当前有限地图扩容达到上限');
 for(const name of ['terrain','elevation','navigation','fog_of_war'] as const){const old=m[name],next:any[]=[];for(let y=0;y<m.height;y++){next.push(...old.slice(y*oldWidth,(y+1)*oldWidth));for(let x=oldWidth;x<newWidth;x++)next.push(name==='navigation'?1:name==='fog_of_war'?true:name==='terrain'?((x*7+y*3+w.seed)%37===0?3:0):0);}m[name]=next as never;}
 m.width=newWidth;w.chunks??=[{x:0,y:0,width:oldWidth,height:m.height,loaded:true}];w.chunks.push({x:oldWidth,y:0,width:16,height:m.height,loaded:true});w.surveyed=[];event(w,'map.chunk_changed',{layer:'terrain',newWidth,source:key},'MAYOR','PUBLIC',key);
}
export function admitMigrant(w:World,key:string,name:string){
 if(w.residents.length>=w.settings.housingCapacity||w.resources.water<3||w.resources.food<3)throw new Error('住房/粮水承载不足，移民延期');
 const template=loadJSON('residents/resident-020.json'),id=`migrant:${key}`,r={...template,id,name,background:`${name}来自邻近商路，听闻晨沙镇愿意接待新居民，带着愿意劳动的希望到来。${template.background}`,cash:80,secret:'希望在新家重新开始',relations:{},goals:template.goals.map((g:any)=>({...g,id:`${id}:${g.id}`})),memories:[],knowledge:[],x:39,y:24,needs:{energy:80,thirst:30,hunger:30,stress:20,sleep:0,social:50},health:100,current_action:'IDLE',busyUntil:0,path:[]};
 w.residents.push(r);w.accounts[id]=80;w.openingAccounts[id]=80;inventory(w,`${key}:water`,'water',-3,'移民安置');inventory(w,`${key}:food`,'food',-3,'移民安置');event(w,'migration.admitted',{id,name},'MAYOR','PUBLIC',key);
}
export function startBusiness(w:World,key:string,residentId:string,type:string){const r=w.residents.find(r=>r.id===residentId);if(!r||r.cash<50||!['WORKSHOP','FOOD_STALL','WATER_REPAIR'].includes(type))throw new Error('创业条件不足');transfer(w,key,residentId,'EXTERNAL',50,'私人创业登记及设备');w.businesses??=[];w.businesses.push({id:key,owner:residentId,type,status:'OPEN',location:r.homeId});event(w,'business.opened',{residentId,type});}
export function moveHome(w:World,residentId:string,buildingId:string){const r=w.residents.find(r=>r.id===residentId),b=w.map.structures.find(b=>b.id===buildingId&&['HOUSING','TENT'].includes(b.type));if(!r||!b)throw new Error('居民或住宅不存在');if(w.residents.filter(r=>r.homeId===buildingId).length>=8)throw new Error('此住宅已满');r.homeId=buildingId;event(w,'resident.moved_home',{residentId,buildingId});}
