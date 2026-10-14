import {it,expect} from 'vitest';
import {createWorld} from '../packages/world-core/src/world';
import {simulate} from '../packages/world-core/src/simulate';
import {audit,trade,reserve,available,transfer,initEconomy} from '../packages/economy/src/economy';
it('十天账本和库存完全可核算，固定规则可复现',()=>{function run(){const w=createWorld('fixed');for(let i=0;i<18000;i++){simulate(w);w.version++;w.events=w.events.slice(-300);}expect(w.resources.water).toBeGreaterThanOrEqual(0);expect(w.resources.food).toBeGreaterThanOrEqual(0);expect(audit(w).balanced).toBe(true);return w;}const a=run(),b=run();expect(b.resources).toEqual(a.resources);expect(b.ledger).toEqual(a.ledger);});
it('预留防重复承诺、交易报价合法、幂等与失败不改账',()=>{const w=createWorld();w.scenario.tradeOffers=[{resource:'food',price:3,stock:100}];reserve(w,'a',4000,{});expect(available(w)).toBe(1000);expect(()=>reserve(w,'b',2000,{})).toThrow();expect(()=>trade(w,'bad','food',500,3)).toThrow();expect(w.resources.cash).toBe(5000);trade(w,'purchase','food',10,3);trade(w,'purchase','food',10,3);expect(w.resources.food).toBe(120);expect(w.resources.cash).toBe(4970);expect(audit(w).balanced).toBe(true);});
