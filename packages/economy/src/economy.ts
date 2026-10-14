import type {World} from '../../shared/src/types';
import {event} from '../../world-core/src/world';
const indexes=new WeakMap<any[],Set<string>>();
function hasKey(list:any[],key:string){let index=indexes.get(list);if(!index){index=new Set(list.map(e=>e.id));indexes.set(list,index);}return index.has(key);}
export function initEconomy(w:World){
 if(w.accounts)return;w.accounts={PUBLIC:w.resources.cash,EXTERNAL:0};for(const r of w.residents)w.accounts[r.id]=r.cash;
 w.ledger=[];w.inventoryTransactions=[];w.reservations={};w.tasks=[];w.openingAccounts={...w.accounts};w.openingResources={...w.resources};
}
export function available(w:World){initEconomy(w);return w.accounts.PUBLIC-Object.values(w.reservations).reduce((s:number,r:any)=>s+r.cash,0);}
export function freeResource(w:World,type:string){initEconomy(w);return w.resources[type]-Object.values(w.reservations).reduce((s:number,r:any)=>s+(r.resources[type]??0),0);}
export function transfer(w:World,key:string,from:string,to:string,amount:number,reason:string){
 initEconomy(w);if(hasKey(w.ledger,key))return;
 if(!Number.isFinite(amount)||amount<0||!(from in w.accounts)||!(to in w.accounts))throw new Error('非法交易');
 if(from!=='EXTERNAL'&&w.accounts[from]<amount)throw new Error('余额不足');
 w.accounts[from]-=amount;w.accounts[to]+=amount;w.resources.cash=w.accounts.PUBLIC;
 for(const r of w.residents)r.cash=w.accounts[r.id];
 const e=event(w,'finance.changed',{from,to,amount,reason},'WORLD','PUBLIC',key);w.ledger.push({id:key,game_time:w.gameTime,source_event_id:e.id,entries:[{account:from,debit:amount,credit:0},{account:to,debit:0,credit:amount}],reason});indexes.get(w.ledger)?.add(key);
}
export function inventory(w:World,key:string,resource:string,delta:number,reason:string){
 initEconomy(w);if(hasKey(w.inventoryTransactions,key))return;
 if(!Number.isFinite(delta)||!['water','food','wood','stone','tools'].includes(resource)||w.resources[resource]+delta<-.000001)throw new Error('库存不足或非法变动');
 w.resources[resource]=Math.max(0,w.resources[resource]+delta);const e=event(w,'inventory.changed',{resource,delta,balance:w.resources[resource],reason},'WORLD','PUBLIC',key);
 w.inventoryTransactions.push({id:key,resource,delta,balance:w.resources[resource],source_event_id:e.id,reason,game_time:w.gameTime});indexes.get(w.inventoryTransactions)?.add(key);
}
export function reserve(w:World,id:string,cash:number,resources:Record<string,number>){
 initEconomy(w);if(w.reservations[id])return;if(cash>available(w)||Object.entries(resources).some(([k,v])=>v>freeResource(w,k)))throw new Error('预算或物资不足');
 w.reservations[id]={cash,resources:{...resources}};
}
export function trade(w:World,key:string,resource:string,amount:number,price:number){
 initEconomy(w);if(w.ledger.some((j:any)=>j.id===key))return;
 const offer=w.scenario.tradeOffers?.find((o:any)=>o.resource===resource);if(!offer||price!==offer.price||amount<=0||!Number.isInteger(amount)||amount>offer.stock)throw new Error('商队报价或库存不满足');
 if(available(w)<amount*price)throw new Error('可用资金不足');
 transfer(w,key,'PUBLIC','EXTERNAL',amount*price,`采购${resource}`);inventory(w,`${key}:goods`,resource,amount,'商队补给');offer.stock-=amount;
}
export function acceptTask(w:World,id:string,residentId:string){const task=w.tasks.find((t:any)=>t.id===id),r=w.residents.find(r=>r.id===residentId);if(!task||!r||task.status!=='OPEN')throw new Error('任务不存在或已接受');if(r.conversationId||r.projectId||r.busyUntil>w.gameTime||r.needs.energy<30||task.wage<r.wagePreference||r.skills[task.skill]<task.level||freeResource(w,'tools')<1)throw new Error('居民拒绝：承诺、身体、技能、工具或工钱不满足');task.status='ACCEPTED';task.assignee=residentId;r.projectId=task.projectId;r.taskId=id;return task;}
export function economyTick(w:World,dt:number){
 initEconomy(w);const k=`tick:${w.version+1}`;
 const well=w.map.structures.find(b=>b.type==='WELL'&&b.operational);
 const production=well?w.settings.waterDaily*dt/1440*(well.durability/100)*(w.environmentEfficiency??1):0;
 inventory(w,`${k}:water`,'water',Math.max(0,Math.min(w.settings.waterCapacity-w.resources.water,production)),'井产出');
 const agriculture=Math.max(0,w.settings.waterConsumption-w.residents.length)*dt/1440,used=Math.min(freeResource(w,'water'),agriculture);
 inventory(w,`${k}:irrigation`,'water',-Math.max(0,used),'农业耗水');
 inventory(w,`${k}:food`,'food',w.settings.foodDaily*dt/1440*(agriculture>0?used/agriculture:1)*(w.environmentEfficiency??1),'农田产出');
 for(const r of w.residents){if(r.current_action==='WORKING'&&!r.projectId){const wage=r.wagePreference*dt/(8*60);if(available(w)>=wage)transfer(w,`${k}:wage:${r.id}`,'PUBLIC',r.id,wage,'职业工时工资');}}
}
export function audit(w:World){initEconomy(w);const balance={...w.openingAccounts};for(const j of w.ledger){if(j.entries.reduce((n:number,e:any)=>n+e.debit-e.credit,0)!==0)throw new Error('账本不平');for(const e of j.entries)balance[e.account]+=e.credit-e.debit;}for(const id in balance)if(Math.abs(balance[id]-w.accounts[id])>1e-6)throw new Error('账实不符');const resources={...w.openingResources};for(const t of w.inventoryTransactions)resources[t.resource]+=t.delta;for(const r of ['water','food','wood','stone','tools'])if(Math.abs(resources[r]-w.resources[r])>1e-6)throw new Error('库存流水不符');return {balanced:true,entries:w.ledger.length,inventoryEntries:w.inventoryTransactions.length,available:available(w)};}
