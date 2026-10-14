import type {World,Point} from '../../shared/src/types';
import {event} from '../../world-core/src/world';
import {available,freeResource,reserve,transfer,inventory,acceptTask} from '../../economy/src/economy';
import {pathfind,entrance,distance} from '../../residents/src/simulation';
import {transition} from '../../governance/src/governance';
import {remember} from '../../agent-runtime/src/memory';
export function buildingRule(w:World,type:string){const rule=w.scenario.buildings?.[type];if(!rule)throw new Error('尚未解锁的建筑类型');return rule;}
export function validateSite(w:World,type:string,site:Point,rotation=0){
 const rule=buildingRule(w,type),width=rotation%180?rule.height:rule.width,height=rotation%180?rule.width:rule.height,m=w.map;
 if(!Number.isInteger(site.x)||!Number.isInteger(site.y)||site.x<0||site.y<0||site.x+width>m.width||site.y+height>m.height)throw new Error('选址超出地图');
 const occupied=new Set<string>();for(let y=site.y;y<site.y+height;y++)for(let x=site.x;x<site.x+width;x++){const i=y*m.width+x;if(!m.fog_of_war[i]||m.terrain[i]===3||m.terrain[i]===4||m.elevation[i]>1)throw new Error('未探明/危险/地形不允许建设');if(m.zoning.some(z=>z.x===x&&z.y===y&&z.zone==='PROTECTED'))throw new Error('无用地使用权');occupied.add(`${x},${y}`);}
 if(m.structures.some(b=>site.x<b.x+b.width&&site.x+width>b.x&&site.y<b.y+b.height&&site.y+height>b.y)||m.blueprints.some(b=>b.status!=='CANCELLED'&&b.status!=='COMPLETED'&&site.x<b.x+b.width&&site.x+width>b.x&&site.y<b.y+b.height&&site.y+height>b.y))throw new Error('建筑或蓝图占地冲突');
 if(w.residents.some(r=>occupied.has(`${r.x},${r.y}`)))throw new Error('居民尚未撤离占地');
 const base=w.map.structures[0],start=entrance(w,base),target={x:site.x,y:site.y+height};if(!pathfind(w,start,target,occupied).length&&distance(start,target)>0)throw new Error('工地无法通行');
 for(const b of m.structures){const end=entrance(w,b);if(distance(start,end)>0&&!pathfind(w,start,end,occupied).length)throw new Error('新建筑会阻断现有通路');}
 return {...site,width,height,rotation};
}
export function blueprint(w:World,type:string,site:Point,key:string,rotation=0){const location=validateSite(w,type,site,rotation),b={id:`blueprint:${key}`,type,...location,status:'DRAFT'};w.map.blueprints.push(b);event(w,'map.chunk_changed',{layer:'blueprints',operation:'add',data:b},'MAYOR','PUBLIC',key);return b;}
export function startProject(w:World,p:any){
 if(!['STAFFING','FUNDING_PENDING','APPROVED'].includes(p.status))throw new Error('项目尚未获得决议授权');if(w.projects.some(j=>j.proposalId===p.id))throw new Error('项目已经创建');
 const rule=buildingRule(w,p.structureType);if(rule.cash>p.budgetCap)throw new Error(`项目预算不足，实际需要${rule.cash}`);
 const location=validateSite(w,p.structureType,p.site,p.rotation??0);if(available(w)<rule.cash){if(p.status==='APPROVED')transition(w,p,'FUNDING_PENDING','资金不足');throw new Error('可用财政不足');}
 const id=`project:${p.id}`;reserve(w,id,rule.cash,rule.resources);
 const b=blueprint(w,p.structureType,p.site,id,p.rotation??0);b.status='APPROVED';
 const project={id,proposalId:p.id,blueprintId:b.id,type:p.structureType,...location,status:'STAFFING',progress:0,cashSpent:0,resourceSpent:{},workers:[],reason:'招募自愿工人',duration:rule.minutes};w.projects.push(project);
 w.tasks??=[];w.tasks.push({id:`task:${id}`,projectId:id,status:'OPEN',skill:'建设',level:rule.skill,wage:rule.wage,hours:rule.minutes/60});
 if(p.status==='FUNDING_PENDING')transition(w,p,'STAFFING','资金预留成功');return project;
}
function releaseCrew(w:World,j:any){for(const id of j.workers){const r=w.residents.find(r=>r.id===id);r.projectId=undefined;r.taskId=undefined;r.current_action='IDLE';}j.workers=[];}
export function projectControl(w:World,j:any,action:string){const p=w.proposals.find(p=>p.id===j.proposalId),b=w.map.blueprints.find(b=>b.id===j.blueprintId);
 if(action==='cancel'&&!['COMPLETED','CANCELLED'].includes(j.status)){j.status='CANCELLED';b.status='CANCELLED';delete w.reservations[j.id];releaseCrew(w,j);transition(w,p,'CANCELLED','退回未消耗预留，已发生成本保留','MAYOR');}
 else if(action==='pause'&&['STAFFING','IN_PROGRESS'].includes(j.status)){j.status='PAUSED';releaseCrew(w,j);transition(w,p,'PAUSED','镇长暂停施工','MAYOR');}
 else if(action==='resume'&&j.status==='PAUSED'){j.status='STAFFING';j.reason='重新审查资源并招工';w.tasks.find((t:any)=>t.projectId===j.id).status='OPEN';transition(w,p,'STAFFING','恢复招工','MAYOR');}
 else throw new Error('非法项目控制');event(w,'project.progress',{id:j.id,status:j.status,progress:j.progress},'MAYOR');
}
export function constructionTick(w:World,dt:number){
 for(const j of w.projects){if(['CANCELLED','COMPLETED','PAUSED'].includes(j.status))continue;const p=w.proposals.find(p=>p.id===j.proposalId),b=w.map.blueprints.find(b=>b.id===j.blueprintId),rule=buildingRule(w,j.type);
  if(j.status==='STAFFING'){
   const task=w.tasks.find((t:any)=>t.projectId===j.id);for(const r of w.residents){try{acceptTask(w,task.id,r.id);j.workers=[r.id];break;}catch{}}
   if(!j.workers.length){j.reason='暂无愿意且符合技能/工具/精力/工钱条件的工人';continue;}
   j.status='IN_PROGRESS';b.status='UNDER_CONSTRUCTION';transition(w,p,'IN_PROGRESS','居民自愿接受施工任务');
  }
  const r=w.residents.find(r=>r.id===j.workers[0]);if(r.needs.energy<20){j.reason='工人疲劳，施工暂停';projectControl(w,j,'pause');continue;}
  const target={x:j.x,y:j.y+j.height};if(distance(r,target)>0){const path=pathfind(w,r,target);if(!path.length){j.reason='道路阻塞，暂停施工';projectControl(w,j,'pause');continue;}Object.assign(r,path[0]);r.current_action='MOVING';continue;}
  if(w.weather?.type==='SANDSTORM'){j.reason='沙暴，工地暂时停工';r.current_action='SHELTERING';continue;}
  r.current_action='WORKING';r.needs.energy-=dt*.015;
  const progress=Math.min(1-j.progress,dt*(w.environmentEfficiency??1)/j.duration),reservation=w.reservations[j.id],key=`tick:${w.version+1}:${j.id}`;
  const pay=rule.cash*progress;reservation.cash=Math.max(0,reservation.cash-pay);transfer(w,`${key}:wage`,'PUBLIC',r.id,pay,'施工工时成本');j.cashSpent+=pay;
  for(const [resource,amount] of Object.entries(rule.resources) as [string,number][]){const consume=amount*progress;reservation.resources[resource]=Math.max(0,reservation.resources[resource]-consume);inventory(w,`${key}:${resource}`,resource,-consume,'施工材料');j.resourceSpent[resource]=(j.resourceSpent[resource]??0)+consume;}
  j.progress+=progress;j.reason='按实际工时推进';event(w,'project.progress',{id:j.id,progress:j.progress,workers:j.workers});
  if(j.progress>=1-1e-9){j.status='COMPLETED';b.status='COMPLETED';delete w.reservations[j.id];
   if(j.type==='ROAD')for(let y=j.y;y<j.y+j.height;y++)for(let x=j.x;x<j.x+j.width;x++){w.map.roads.push({x,y});w.map.navigation[y*w.map.width+x]=.5;}
   else {w.map.structures.push({id:`building:${j.id}`,type:j.type,name:rule.name,x:j.x,y:j.y,width:j.width,height:j.height,durability:100,operational:true});if(j.type!=='FARM')for(let y=j.y;y<j.y+j.height;y++)for(let x=j.x;x<j.x+j.width;x++)w.map.navigation[y*w.map.width+x]=0;}
   w.settings.waterCapacity+=rule.waterCapacity??0;w.settings.housingCapacity+=rule.housingCapacity??0;w.settings.foodDaily+=rule.foodDaily??0;w.settings.waterConsumption+=rule.waterConsumption??0;
   const crew=[...j.workers];releaseCrew(w,j);transition(w,p,'COMPLETED','工程竣工，设施规则正式生效');const e=event(w,'map.chunk_changed',{projectId:j.id,type:j.type,status:'COMPLETED'});for(const resident of w.residents)remember(w,resident.id,`工程「${p.title}」已经竣工。`,e.id,'PUBLIC',crew.includes(resident.id)?'EXPERIENCED':'HEARSAY',[p.id],crew.includes(resident.id)?1:.95);
  }
 }
}
