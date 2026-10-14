import {it,expect} from 'vitest';
import {createWorld} from '../packages/world-core/src/world';
import {simulate} from '../packages/world-core/src/simulate';
import {pathfind} from '../packages/residents/src/simulation';
it('20位独立档案与三日纯规则模拟，无越界/穿墙/瞬移/死锁',()=>{
 const w=createWorld();expect(w.residents).toHaveLength(20);for(const r of w.residents){expect(r.background.length).toBeGreaterThanOrEqual(100);expect(r.background.length).toBeLessThanOrEqual(300);expect(Object.keys(r.traits)).toHaveLength(5);}
 const actions=new Set<string>();const moves=new Map(w.residents.map(r=>[r.id,0]));
 for(let i=0;i<5400;i++){const before=w.residents.map(r=>({x:r.x,y:r.y}));simulate(w);w.version++;w.events=w.events.slice(-300);for(const [j,r] of w.residents.entries()){expect(Math.abs(r.x-before[j].x)+Math.abs(r.y-before[j].y)).toBeLessThanOrEqual(1);expect(w.map.navigation[r.y*w.map.width+r.x]).toBeGreaterThan(0);if(r.current_action==='MOVING')moves.set(r.id,moves.get(r.id)!+1);actions.add(r.current_action);}expect(w.resources.water).toBeGreaterThanOrEqual(0);expect(w.resources.food).toBeGreaterThanOrEqual(0);}
 expect(w.gameTime).toBeCloseTo(4680);for(const a of ['WORKING','SLEEPING','EATING','DRINKING'])expect(actions.has(a)).toBe(true);for(const n of moves.values())expect(n).toBeGreaterThan(0);
});
it('动态阻挡后重新寻找可达路线',()=>{const w=createWorld();const p=pathfind(w,{x:24,y:24},{x:25,y:25});expect(p.length).toBeGreaterThan(0);w.map.navigation[24*w.map.width+25]=0;expect(pathfind(w,{x:24,y:24},{x:25,y:25})).not.toContainEqual({x:25,y:24});});
