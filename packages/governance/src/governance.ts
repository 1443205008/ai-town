import type {World} from '../../shared/src/types';
import {event} from '../../world-core/src/world';
import {available} from '../../economy/src/economy';
import {remember} from '../../agent-runtime/src/memory';
export function parseProposal(text:string){
 const construction=/水塔|住宅|住房|农田|道路/.test(text),structureType=/水塔/.test(text)?'WATER_TOWER':/住宅|住房/.test(text)?'HOUSING':/农田/.test(text)?'FARM':'ROAD';
 return {title:text.slice(0,100),objective:text,kind:construction?'CONSTRUCTION':/限水|节水/.test(text)?'RATIONING':/税/.test(text)?'TAX':/移民/.test(text)?'MIGRATION':'OPEN_DISCUSSION',structureType:construction?structureType:undefined,budgetCap:Number(text.match(/预算\s*(\d+)/)?.[1]??3000),rationLevel:2,taxRate:Number(text.match(/(\d+)%/)?.[1]??5)/100,site:null,status:'DRAFT'};
}
export function submitProposal(w:World,draft:any,key:string,actor='MAYOR'){
 if(!w.charter)w.charter=structuredClone(w.scenario.charter);
 if(!w.charter?.permissions?.includes(draft.kind))throw new Error('章程未授权此提案类型');
 const p={...draft,id:`proposal:${key}`,initiator:actor,status:'DRAFT',revision:0,comments:[],votes:[],history:[],created:w.gameTime};w.proposals.push(p);event(w,'proposal.created',{id:p.id,title:p.title},actor,'PUBLIC',key);return p;
}
const transitions:Record<string,string[]>={DRAFT:['VALIDATING','CANCELLED'],VALIDATING:['CONSULTATION','REVISION_REQUESTED','REJECTED'],CONSULTATION:['VOTING','APPROVED','REJECTED','REVISION_REQUESTED'],VOTING:['APPROVED','REJECTED'],REVISION_REQUESTED:['DRAFT','CANCELLED'],APPROVED:['FUNDING_PENDING','STAFFING','IN_PROGRESS','COMPLETED','CANCELLED'],FUNDING_PENDING:['STAFFING','CANCELLED'],STAFFING:['IN_PROGRESS','PAUSED','CANCELLED'],IN_PROGRESS:['COMPLETED','PAUSED','FAILED','CANCELLED'],PAUSED:['STAFFING','IN_PROGRESS','CANCELLED'],FAILED:['CANCELLED'],COMPLETED:[],CANCELLED:[],REJECTED:['DRAFT']};
export function transition(w:World,p:any,status:string,cause:string,actor='WORLD'){
 if(!transitions[p.status]?.includes(status))throw new Error(`非法状态转换 ${p.status}→${status}`);
 const previous=p.status;p.status=status;p.revision++;p.history.push({actor,cause,game_time:w.gameTime,revision:p.revision,previous,status});event(w,'proposal.status_changed',{id:p.id,previous,status,cause,revision:p.revision},actor);
}
export function stance(w:World,r:any,p:any){
 const distrust=r.relations['resident-002']?.trust??45,memories=r.memories.filter((m:any)=>m.subject_ids?.includes('MAYOR'));
 let score=45+r.traits.agreeableness*.2+(memories.length?memories.at(-1).confidence*10:0);
 let reason='希望在公平且资源充足的前提下改善小镇';
 if(p.kind==='RATIONING'){if(/农/.test(r.role)){score-=40;reason='灌溉减配可能降低粮食产量，希望保留最低灌溉。';}else if(/医/.test(r.role)){reason='必须保留医用水才能支持限水。';score+=5;}else if(/商/.test(r.role)){reason='可以考虑从商队采购水，不宜只依靠限水。';score-=10;}}
 if(p.kind==='CONSTRUCTION'){if(/财政/.test(r.role)){score=available(w)>=p.budgetCap?65:20;reason=score<40?`可用财政不足，缺口${Math.max(0,p.budgetCap-available(w))}金币。`:'先预留预算，不应重复承诺资金。';}else if(/水务/.test(r.role)){score=p.structureType==='WATER_TOWER'?85:50;reason='储水能力和产水能力不同，选址与接入需实际核验。';}else if(/建筑/.test(r.role)){reason='必须保证工具、工钱、合理工期与自愿工人。';score=60;}}
 if(p.kind==='TAX'){score-=r.cash*.015;reason='税率需要基于实际交易征收，应公开说明用途。';}
 return {residentId:r.id,stance:score>=65?'SUPPORT':score>=40?'CONDITIONAL':'OPPOSE',score,reason,conditions:score>=40&&score<65?['满足基本生活与劳动保障']:[],known_facts:r.knowledge.filter((k:any)=>k.privacy==='PUBLIC').map((k:any)=>k.id)};
}
export function deliberate(w:World,p:any){
 if(p.status!=='DRAFT')throw new Error('请先修订为草案');transition(w,p,'VALIDATING','章程与初始资源审查');
 if(p.kind==='CONSTRUCTION'&&!p.site){transition(w,p,'REVISION_REQUESTED','请在地图明确选址');return;}
 transition(w,p,'CONSULTATION','公开征询居民');p.comments=w.residents.map(r=>stance(w,r,p));for(const c of p.comments)event(w,'proposal.comment_added',{id:p.id,...c},c.residentId);
 if(p.kind==='OPEN_DISCUSSION'){transition(w,p,'REVISION_REQUESTED','保存为讨论；尚无可执行动作');return;}
 if(p.kind==='MIGRATION'){transition(w,p,'REVISION_REQUESTED','人口承载需单独核验，不直接增加居民');return;}
 if(p.comments.filter((c:any)=>c.stance==='OPPOSE').length>w.residents.length*.6){transition(w,p,'REJECTED','居民反对超过章程阈值');return;}
 if(w.charter.votingKinds.includes(p.kind)){transition(w,p,'VOTING','章程要求公议');p.votes=p.comments.map((c:any)=>({residentId:c.residentId,decision:c.stance==='OPPOSE'?'NO':'YES',game_time:w.gameTime,reason:c.reason}));}
 transition(w,p,'APPROVED','经公开征询/公议通过，尚未物理执行');
 if(p.kind==='CONSTRUCTION'){transition(w,p,available(w)<p.budgetCap?'FUNDING_PENDING':'STAFFING',available(w)<p.budgetCap?'可用财政不足':'等待项目审查与自愿劳动力');return;}
 if(p.kind==='RATIONING'){w.policies??=[];w.policies.push({id:p.id,type:p.kind,level:p.rationLevel,effective_from:w.gameTime,effective_to:w.gameTime+7*1440,source_proposal_id:p.id});w.settings.waterConsumption=w.scenario.rules.waterConsumption*.85;transition(w,p,'COMPLETED','限水规则生效，保留基本饮水和医疗优先');}
 if(p.kind==='TAX'){w.policies??=[];w.policies.push({id:p.id,type:p.kind,rate:p.taxRate,effective_from:w.gameTime,source_proposal_id:p.id});transition(w,p,'COMPLETED','税率依法生效，尚无交易不产生收入');}
 for(const r of w.residents)remember(w,r.id,`公开提案「${p.title}」的决定为${p.status}。`,p.id,'PUBLIC','HEARSAY',['MAYOR'],.95);
}
export function revise(w:World,p:any,changes:any){if(!['DRAFT','REVISION_REQUESTED','REJECTED'].includes(p.status))throw new Error('当前状态不能直接修改提案');if(p.status!=='DRAFT')transition(w,p,'DRAFT','镇长修订','MAYOR');for(const key of ['title','budgetCap','site','rationLevel','taxRate'])if(changes[key]!==undefined)p[key]=changes[key];p.comments=[];p.votes=[];p.revision++;}
