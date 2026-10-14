import type {World,Point,Structure} from '../../shared/src/types';
import {event} from '../../world-core/src/world';
import {inventory,freeResource} from '../../economy/src/economy';
export const distance=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export function pathfind(w:World,start:Point,end:Point,extraBlocked=new Set<string>()):Point[]{
 const m=w.map,key=(p:Point)=>p.y*m.width+p.x,pass=(p:Point)=>p.x>=0&&p.y>=0&&p.x<m.width&&p.y<m.height&&m.navigation[key(p)]>0&&!extraBlocked.has(`${p.x},${p.y}`);
 if(!pass(end))return [];const queue=[start],prev=new Map<number,Point>();prev.set(key(start),start);
 for(let head=0;head<queue.length;head++){const p=queue[head];if(key(p)===key(end)){const result:Point[]=[];let n=end;while(key(n)!==key(start)){result.unshift(n);n=prev.get(key(n))!;}return result;}
  for(const n of [{x:p.x+1,y:p.y},{x:p.x-1,y:p.y},{x:p.x,y:p.y+1},{x:p.x,y:p.y-1}])if(pass(n)&&!prev.has(key(n))){prev.set(key(n),p);queue.push(n);}}
 return [];
}
export function entrance(w:World,b:Structure):Point {const around=[{x:b.x,y:b.y+b.height},{x:b.x+b.width,y:b.y},{x:b.x-1,y:b.y},{x:b.x,y:b.y-1}];return around.find(p=>w.map.navigation[p.y*w.map.width+p.x]>0)??{x:b.x,y:b.y};}
const jobType=(role:string)=>/水务/.test(role)?'WELL':/农/.test(role)?'FARM':/医|救护/.test(role)?'CLINIC':/财政|文书|教师/.test(role)?'TOWN_HALL':/商|旅舍|移民/.test(role)?'CARAVAN':'WORKSHOP';
export function residentTick(w:World,dt:number){
 const hour=(w.gameTime%1440)/60;
 for(const r of w.residents){
  if(!r.needs)continue;
  r.needs.thirst=Math.min(100,r.needs.thirst+100/1440*dt);r.needs.hunger=Math.min(100,r.needs.hunger+100/1440*dt);
  if(r.current_action==='SOCIALIZING'||r.projectId)continue;
  if(r.busyUntil>w.gameTime)continue;
  const action=r.needs.thirst>=85?'DRINKING':r.needs.hunger>=85?'EATING':hour>=22||hour<6?'SLEEPING':r.needs.energy<25?'RESTING':hour>=8&&hour<17?'WORKING':'RESTING';
  const type=action==='DRINKING'?'WELL':action==='EATING'?'KITCHEN':action==='SLEEPING'?'TENT':action==='WORKING'?jobType(r.role):'TOWN_HALL';
  const building=w.map.structures.find(b=>b.type===type)??w.map.structures[0],target=entrance(w,building);
  if(distance(r,target)>0){
   if(!r.path?.length||distance(r.path.at(-1),target)!==0||w.map.navigation[r.path[0].y*w.map.width+r.path[0].x]===0)r.path=pathfind(w,r,target);
   if(r.path.length){Object.assign(r,r.path.shift());r.current_action='MOVING';r.lastMovedAt=w.gameTime;}
   else{r.current_action='RESTING';r.reason='路径不可达，等待重规划';}continue;
  }
  r.current_action=action;r.reason=action==='WORKING'?`根据职业前往${building.name}`:'照顾个人需求';
  if(action==='DRINKING'||action==='EATING'){
   const resource=action==='DRINKING'?'water':'food';if(freeResource(w,resource)>=1){inventory(w,`tick:${w.version+1}:${r.id}:${resource}`,resource,-1,`${r.name}:${action}`);r.needs[resource==='water'?'thirst':'hunger']=0;r.busyUntil=w.gameTime+8;}else {r.health=Math.max(10,r.health-.01*dt);r.reason='公共库存不足，等待补给';}
  }
  r.needs.energy=Math.max(0,Math.min(100,r.needs.energy+(action==='SLEEPING'?.2:action==='RESTING'?.08:-.025)*dt));
 }
}
export function basicProduction(w:World,dt:number){
 const water=Math.min(w.settings.waterCapacity-w.resources.water,w.settings.waterDaily*dt/1440);
 w.resources.water+=Math.max(0,water);w.resources.food+=w.settings.foodDaily*dt/1440;
 // Agriculture's configured daily water budget is separate from residents' drinking.
 const irrigation=Math.min(w.resources.water,Math.max(0,w.settings.waterConsumption-w.residents.length)*dt/1440);w.resources.water-=irrigation;
}
