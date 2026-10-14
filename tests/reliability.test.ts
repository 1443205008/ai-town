import {afterAll,beforeAll,it,expect} from 'vitest';
import {createWorld} from '../packages/world-core/src/world';
import {simulate} from '../packages/world-core/src/simulate';
import {buildApp} from '../apps/server/src/app';
import {pool} from '../packages/db/src/store';

beforeAll(()=>{process.env.MAYOR_PASSWORD='test-only-password';process.env.SESSION_SECRET='test-only-session-secret-32-characters';process.env.DEBUG_SANDBOX_ENABLED='true';});
afterAll(()=>pool.end());

it('拒绝损坏存档并可将一致的导出恢复为隔离世界',async()=>{
 const app=await buildApp();try{const login=await app.inject({method:'POST',url:'/api/login',payload:{password:'test-only-password'}}),cookie=login.cookies.map(c=>`${c.name}=${c.value}`).join('; '),headers={cookie};
  const invalid=await app.inject({method:'POST',url:'/api/worlds/restore',headers,payload:{schema:'frontier-save-v1',state:{map:{width:2,height:2,terrain:[1],elevation:[],navigation:[],fog_of_war:[]}}}});expect(invalid.statusCode).toBe(400);
  const source=createWorld();const exported=await app.inject({method:'POST',url:`/api/worlds/${source.id}/export`,headers});expect(exported.statusCode).toBe(404);
  const created=await app.inject({method:'POST',url:'/api/worlds',headers,payload:{scenarioId:'starter'}});expect(created.statusCode).toBe(200);const id=created.json().id;
  const sandbox=await app.inject({method:'POST',url:`/api/worlds/${id}/debug-sandbox`,headers,payload:{ticks:5}});expect(sandbox.statusCode).toBe(200);expect(sandbox.json().state.id).toMatch(/^debug-/);expect(sandbox.json().state.residents.every((r:any)=>!('secret' in r)&&r.memories.every((m:any)=>m.privacy==='PUBLIC'))).toBe(true);expect((await app.inject({url:`/api/worlds/${id}/state`,headers})).json().version).toBe(created.json().version);expect((await app.inject({url:'/api/worlds',headers})).json().some((w:any)=>w.id===sandbox.json().state.id)).toBe(false);expect((await app.inject({url:`/api/worlds/${sandbox.json().state.id}/export`,headers})).statusCode).toBe(404);
  const experiment=await app.inject({method:'POST',url:`/api/worlds/${id}/decision-experiment`,headers,payload:{residentId:'resident-001'}});expect(experiment.statusCode).toBe(200);expect(experiment.json().rules.metrics.samples).toBe(5);expect(experiment.json().committee.records).toHaveLength(4);expect(experiment.json().committee.records[0].residentId).toBeTruthy();
  const metrics=await app.inject({url:`/api/worlds/${id}/metrics`,headers});expect(metrics.statusCode).toBe(200);expect(metrics.json().ai.pending).toBe(0);expect(metrics.json().ledger.balanced).toBe(true);expect(metrics.json().websocketConnections).toBe(0);
  const save=await app.inject({method:'POST',url:`/api/worlds/${id}/export`,headers});expect(save.statusCode).toBe(200);expect(JSON.stringify(save.json())).not.toMatch(/apiKey|authorization|sk-[A-Za-z0-9]{12}/i);
  const restored=await app.inject({method:'POST',url:'/api/worlds/restore',headers,payload:save.json()});expect(restored.statusCode).toBe(200);expect(restored.json().id).not.toBe(id);expect(restored.json().residents).toHaveLength(20);expect(restored.json().gameTime).toBe(save.json().state.gameTime);
 }finally{await app.close();}
});

it('20人与50人规则负载可持续运行且地图/库存不损坏',()=>{
 const results=[] as Array<{population:number;ticks:number;elapsedMs:number}>;
 for(const population of [20,50]){const w=createWorld();while(w.residents.length<population){const clone=structuredClone(w.residents[w.residents.length%20]);clone.id=`stress-${w.residents.length}`;clone.x=8+(w.residents.length%20);clone.y=16+Math.floor(w.residents.length/20);w.residents.push(clone);}const ticks=population===20?1000:1000,start=performance.now();for(let i=0;i<ticks;i++)simulate(w);const elapsedMs=performance.now()-start;results.push({population,ticks,elapsedMs});expect(w.residents).toHaveLength(population);expect(w.resources.water).toBeGreaterThanOrEqual(0);expect(w.resources.food).toBeGreaterThanOrEqual(0);for(const resident of w.residents){expect(w.map.navigation[resident.y*w.map.width+resident.x]).toBeGreaterThan(0);}}
 expect(results).toHaveLength(2);expect(results.every(r=>Number.isFinite(r.elapsedMs)&&r.elapsedMs<30000)).toBe(true);console.info('population simulation benchmark',results);
});
