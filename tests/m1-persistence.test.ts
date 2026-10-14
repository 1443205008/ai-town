import {it,expect,afterAll} from 'vitest';
import {createWorld} from '../packages/world-core/src/world';
import {simulate} from '../packages/world-core/src/simulate';
import {migrate,saveNew,getWorld,tick,pool} from '../packages/db/src/store';
afterAll(()=>pool.end());
it('规则生活动作/需求/位置写入数据库并正确重载',async()=>{await migrate();const w=createWorld();await saveNew(w);await tick(w.id,1000,simulate);const restored=await getWorld(w.id);expect(restored.residents[0].needs.thirst).toBeGreaterThan(w.residents[0].needs.thirst);expect(restored.residents[0].current_action).toBe('MOVING');expect(restored.residents[0].background).toBe(w.residents[0].background);expect(restored.gameTime).toBeCloseTo(360.8);});
