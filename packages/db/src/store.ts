import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { worlds,worldEvents,commands,snapshots } from './schema';
import { createWorld, clockTick } from '../../world-core/src/world';
import type { World } from '../../shared/src/types';
export const pool=new pg.Pool({connectionString:process.env.DATABASE_URL??'postgres://frontier:frontier_dev@127.0.0.1:54329/frontier_v2',max:10});
export const db=drizzle(pool);
export async function migrate(){await db.transaction(async tx=>{await tx.execute(sql`SELECT pg_advisory_xact_lock(734501)`);await tx.execute(sql.raw(readFileSync(new URL('../migrations/0001_world.sql',import.meta.url),'utf8')));});}
export async function listWorlds(){return (await db.select().from(worlds)).map(r=>({id:r.id,name:r.state.name,gameTime:r.state.gameTime,scenarioId:r.state.scenarioId}));}
export async function saveNew(w:World){await db.insert(worlds).values({id:w.id,version:w.version,state:w}).onConflictDoNothing(); return getWorld(w.id);}
export async function getWorld(id:string){const [r]=await db.select().from(worlds).where(eq(worlds.id,id));if(!r) throw Object.assign(new Error('世界不存在'),{statusCode:404});return r.state;}
export async function ensureStarter(){const w=await saveNew(createWorld('starter'));if(w.residents.some(r=>!r.needs)){const defaults=createWorld('starter');return mutate('starter','schema:residents:v1',undefined,s=>{s.residents=s.residents.map((r:any)=>({...defaults.residents.find(d=>d.id===r.id),...r}));});}return w;}
export async function mutate(id:string,key:string,expected:number|undefined,fn:(w:World)=>void|Promise<void>):Promise<World>{
  return db.transaction(async tx=>{
    const [r]=await tx.select().from(worlds).where(eq(worlds.id,id)).for('update');
    if(!r) throw Object.assign(new Error('世界不存在'),{statusCode:404});
    const [old]=await tx.select().from(commands).where(sql`${commands.worldId}=${id} AND ${commands.key}=${key}`);
    if(old) return r.state;
    if(expected!==undefined&&r.version!==expected) throw Object.assign(new Error('世界已变化，请刷新后重试'),{statusCode:409});
    const w=r.state,seq=w.eventSeq; await fn(w);const emitted=w.events.filter(e=>e.event_seq>seq);
    for(const [resource,n] of Object.entries(w.resources)) if(!Number.isFinite(n)||n<0) throw new Error(`非法库存: ${resource}`);
    w.version++;w.events=w.events.slice(-300);await tx.update(worlds).set({state:w,version:w.version,updatedAt:new Date()}).where(eq(worlds.id,id));
    for(const e of emitted) await tx.insert(worldEvents).values({worldId:id,seq:e.event_seq,data:e});
    await tx.insert(commands).values({worldId:id,key,result:{version:w.version}});
    return w;
  });
}
export async function tick(id:string,now=Date.now(),simulate=clockTick):Promise<World|null>{
  return db.transaction(async tx=>{
    const lock=await tx.execute(sql`SELECT pg_try_advisory_xact_lock(hashtext(${id})) AS acquired`);
    if(!lock.rows[0]?.acquired) return null;
    const [r]=await tx.select().from(worlds).where(eq(worlds.id,id)).for('update');
    if(!r||!r.state.running||r.state.nextTickAt>now) return null;
    const w=r.state,seq=w.eventSeq;simulate(w);const emitted=w.events.filter(e=>e.event_seq>seq);w.version++;w.nextTickAt=now+Number(process.env.TICK_INTERVAL_MS??1000);w.events=w.events.slice(-300);
    await tx.update(worlds).set({version:w.version,state:w,updatedAt:new Date()}).where(eq(worlds.id,id));
    for(const e of emitted)await tx.insert(worldEvents).values({worldId:id,seq:e.event_seq,data:e});
    return w;
  });
}
export async function snapshot(id:string){const w=await getWorld(id),checksum=createHash('sha256').update(JSON.stringify(w)).digest('hex'),snapId=randomUUID();await db.insert(snapshots).values({id:snapId,worldId:id,version:w.version,state:w,checksum});return {id:snapId,version:w.version,checksum};}
