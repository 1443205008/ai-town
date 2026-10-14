import type {World} from '../../shared/src/types';
import {event} from './world';
import {submitProposal,parseProposal} from '../../governance/src/governance';
import {remember} from '../../agent-runtime/src/memory';
export function environmentTick(w:World,dt:number){
 w.roadObstructions??=[];
 for(const r of w.residents){r.needs??={energy:90,thirst:25,hunger:25,stress:10,sleep:0,social:50};for(const [key,value] of Object.entries({energy:90,thirst:25,hunger:25,stress:10,sleep:0,social:50}))r.needs[key]??=value;r.memories??=[];r.relations??={};r.knowledge??=[];}
 const day=Math.floor(w.gameTime/1440);if(w.environmentDay!==day){
  w.environmentDay=day;const kinds=['CLEAR','CLEAR','HEATWAVE','CLEAR','SANDSTORM','CLEAR','WELL_FAULT'];const type=kinds[(day+w.seed)%kinds.length];
  w.weather={type,day,temperature:type==='HEATWAVE'?45:32,warning:type==='SANDSTORM'?'沙暴来临，请暂停危险劳动':''};
  const well=w.map.structures.find(b=>b.type==='WELL');if(well)well.operational=type!=='WELL_FAULT';event(w,'weather.changed',w.weather);
  w.reports??=[];const actual=w.events.filter(e=>e.visibility==='PUBLIC'&&e.game_time>=(day-1)*1440&&e.game_time<day*1440);w.reports.push({day,headline:actual.some(e=>e.type==='project.progress')?'小镇工程与居民生活进展':'晨沙镇生活记录',eventIds:actual.map(e=>e.id),summary:actual.slice(-8).map(e=>`${e.type} · ${JSON.stringify(e.payload).slice(0,90)}`)});
  w.factions??=[{id:'water',name:'绿洲互助',members:['resident-001','resident-003','resident-006'],support:50},{id:'trade',name:'边境商路',members:['resident-004','resident-018'],support:50}];
  const charter=w.charter??w.scenario.charter;
  if(day>=1&&(charter?.permissions?.includes('OPEN_DISCUSSION')??false)&&!w.proposals.some(p=>p.initiator==='resident-001'&&p.title.includes('检修'))){submitProposal(w,{...parseProposal('建议检修水井并核实地下水'),kind:'OPEN_DISCUSSION'},`resident-well:${day}`,'resident-001');}
  if(w.resources.water<40&&!w.proposals.some(p=>p.kind==='RATIONING'&&!['CANCELLED','REJECTED'].includes(p.status))){submitProposal(w,parseProposal('临时限水，保留医疗用水'),`resident-ration:${day}`,'resident-003');}
  if(type==='SANDSTORM'){
   const routes=w.map.roads.length?w.map.roads:w.map.navigation.flatMap((cost,i)=>cost>0?[{x:i%w.map.width,y:Math.floor(i/w.map.width)}]:[]);
   const road=routes.find(p=>w.map.navigation[p.y*w.map.width+p.x]>0&&!w.residents.some(r=>r.x===p.x&&r.y===p.y));
   if(road){const index=road.y*w.map.width+road.x;w.roadObstructions.push({...road,previousCost:w.map.navigation[index],progress:0,day});w.map.navigation[index]=0;event(w,'road.blocked',{...road,day,cause:'SANDSTORM'});for(const r of w.residents)r.path=[];}
  }
  if(type==='SANDSTORM')for(const r of w.residents)remember(w,r.id,'沙暴预警已公开发布，我应避开危险工地。',`weather:${w.id}:${day}`,'PUBLIC','HEARSAY',[],.95);
 }
 w.environmentEfficiency=w.weather?.type==='HEATWAVE'?.7:w.weather?.type==='SANDSTORM'?.4:1;
 if(w.weather?.type==='SANDSTORM')for(const building of w.map.structures){const before=building.durability;building.durability=Math.max(10,before-.01*dt);if(Math.floor(before/10)!==Math.floor(building.durability/10))event(w,'building.damaged',{buildingId:building.id,durability:building.durability,cause:'SANDSTORM'});}
 if(w.weather?.type!=='SANDSTORM'){
  const obstruction=w.roadObstructions[0],crew=w.residents.find(r=>!r.projectId&&!r.conversationId&&r.needs.energy>=30&&(/维修|建设|工程/.test(r.role)||r.skills?.['建设']>=1));
  if(obstruction&&crew){crew.current_action='WORKING';crew.reason='清理沙暴道路阻塞';crew.busyUntil=w.gameTime+dt;crew.path=[];obstruction.progress+=dt*w.environmentEfficiency;crew.needs.energy=Math.max(0,crew.needs.energy-.01*dt);
   if(obstruction.progress>=60){const index=obstruction.y*w.map.width+obstruction.x;if(w.map.navigation[index]===0)w.map.navigation[index]=obstruction.previousCost;w.roadObstructions.shift();const e=event(w,'road.cleared',{x:obstruction.x,y:obstruction.y,residentId:crew.id});remember(w,crew.id,'我清理了沙暴堵塞的道路，恢复通行。',e.id,'PUBLIC');}}
 }
 if(w.weather?.type==='HEATWAVE')for(const r of w.residents)r.needs.thirst=Math.min(100,r.needs.thirst+.02*dt);
 if(w.weather?.type==='SANDSTORM')for(const r of w.residents){if(!r.projectId&&r.current_action!=='SLEEPING'){r.current_action='SHELTERING';r.busyUntil=w.gameTime+dt;}r.needs.stress=Math.min(100,r.needs.stress+.001*dt);}
 if(w.weather?.type==='WELL_FAULT'){const engineer=w.residents.find(r=>r.role==='水务工程师');if(engineer&&!engineer.projectId){engineer.current_action='WORKING';engineer.reason='修复水井故障';w.repairProgress=(w.repairProgress??0)+dt;if(w.repairProgress>120){const well=w.map.structures.find(b=>b.type==='WELL');if(well)well.operational=true;w.weather.type='CLEAR';w.repairProgress=0;const e=event(w,'well.repaired',{residentId:engineer.id});remember(w,engineer.id,'我修复了水井，恢复供水。',e.id,'PUBLIC');}}}
 for(const policy of w.policies??[])if(policy.effective_to&&policy.effective_to<=w.gameTime&&!policy.expired){policy.expired=true;w.settings.waterConsumption=w.scenario.rules.waterConsumption;event(w,'policy.expired',{id:policy.id});}
}
