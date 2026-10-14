import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { World, WorldEvent } from '../../shared/src/types';
export const seedRoot = new URL('../../../seed/',import.meta.url);
export const loadJSON = (path:string) => JSON.parse(readFileSync(new URL(path,seedRoot),'utf8'));
export function createWorld(id:string=randomUUID(),scenarioId='starter'):World {
  const scenario=loadJSON(`scenarios/${scenarioId}.json`), map=loadJSON(`maps/${scenario.map}.json`);
  return {id,name:scenario.name,seed:scenario.seed,scenarioId,version:0,gameTime:360,running:true,speed:1,nextTickAt:0,eventSeq:0,map,
    resources:{...scenario.resources},residents:scenario.residents.map((r:any)=>({...loadJSON(`residents/${r.id}.json`),...r,needs:{energy:90,thirst:25,hunger:25,stress:10,sleep:0,social:50},health:100,busyUntil:0,path:[]})),proposals:[],projects:[],conversations:[],events:[],
    settings:{...scenario.rules,aiEnabled:true},scenario};
}
export function event(w:World,type:string,payload:WorldEvent['payload'],actor='WORLD',visibility:WorldEvent['visibility']='PUBLIC',commandId=`tick:${w.version+1}`) {
  const e={id:`${w.id}:${++w.eventSeq}`,world_id:w.id,event_seq:w.eventSeq,game_time:w.gameTime,type,actor,payload,visibility,command_id:commandId};
  w.events.push(e); return e;
}
export function clockTick(w:World) {
  w.gameTime+= w.settings.gameMinutesPerTick*w.speed;
  event(w,'world.clock',{gameTime:w.gameTime});
}
export function publicWorld(w:World):World {
  const out=structuredClone(w);
  out.events=out.events.filter(e=>e.visibility==='PUBLIC');
  out.conversations=out.conversations.map(c=>({...c,messages:c.messages.filter((m:any)=>m.privacy==='PUBLIC')}));
  delete out.aiJobs;
  out.residents=out.residents.map(({memories,knowledge,secret,...r}:any)=>({...r,memories:(memories??[]).filter((m:any)=>m.privacy==='PUBLIC'),knowledge:(knowledge??[]).filter((m:any)=>m.privacy==='PUBLIC')}));
  delete out.scenario; return out;
}
