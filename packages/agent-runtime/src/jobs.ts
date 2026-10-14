import type {World} from '../../shared/src/types';
import {contextFor,remember} from './memory';
import {callOpenAI,type Provider} from '../../model-center/src/provider';
import {mutate} from '../../db/src/store';
export function scheduleJobs(w:World){
 w.aiJobs??=[];w.aiUsage??=[];w.modelPolicies??={default:{providers:[],dailyBudget:.5,maxCalls:50},residents:{},purposes:{}};
 if(!w.settings.aiEnabled||w.gameTime<(w.nextAIAt??0))return;w.nextAIAt=w.gameTime+120;
 const n=Math.floor(w.gameTime/120)%w.residents.length,r=w.residents[n];if(!r)return;
 if(w.aiJobs.filter((j:any)=>['PENDING','RETRY'].includes(j.status)).length>=5)return;
 w.aiJobs.push({id:`${w.id}:ai:${w.gameTime}`,residentId:r.id,purpose:'planning',version:w.version+1,status:'PENDING',created:w.gameTime});
 w.aiJobs=w.aiJobs.slice(-50);
}
export async function runJob(w:World,job:any,providers:Provider[]){
 const requestVersion=w.version;
 const policy=w.modelPolicies.residents[job.residentId]??w.modelPolicies.purposes[job.purpose]??w.modelPolicies.default;
 const usage=w.aiUsage.filter((u:any)=>Math.floor(u.game_time/1440)===Math.floor(w.gameTime/1440));
 let response:any,reason='未配置模型，使用规则',chosen='RULES',failedProvider='',duration=0,cost=0,input=0,output=0;
 if(usage.reduce((n:number,u:any)=>n+u.cost,0)>=policy.dailyBudget||usage.length>=policy.maxCalls)reason='预算/调用上限，使用规则';
 else for(const id of policy.providers){const p=providers.find(p=>p.id===id&&p.enabled&&p.protocol==='OPENAI');if(!p)continue;const circuit=w.modelCircuit?.[id];if(circuit?.openUntil>Date.now())continue;const begin=performance.now();try{response=await callOpenAI(p,contextFor(w,job.residentId));chosen=p.id;({cost,input,output,latency:duration}=response.usage);break;}catch(e:any){failedProvider=p.id;reason=e.code?`模型错误 ${e.code}，回退规则`:'模型超时/网络/输出不合法，回退规则';duration=performance.now()-begin;}}
 return mutate(w.id,`ai-result:${job.id}:${job.attempts??0}`,undefined,s=>{
  const current=s.aiJobs.find((j:any)=>j.id===job.id);if(!current||!['PENDING','RETRY'].includes(current.status))return;
  s.modelCircuit??={};if(response){s.modelCircuit[chosen]={failures:0,openUntil:0};}else if(failedProvider){const previous=s.modelCircuit[failedProvider]??{failures:0,openUntil:0},failures=previous.failures+1;s.modelCircuit[failedProvider]={failures,openUntil:failures>=3?Date.now()+60000:0};}
  const resident=s.residents.find(r=>r.id===job.residentId);const stale=s.version!==requestVersion;
  if(response&&!stale&&response.output.kind==='GOAL')resident.goals.push({id:`goal:${job.id}`,term:'SHORT',content:response.output.content,status:'IDEA',origin:'LLM'});
  const attempts=job.attempts??0,retry=!response&&!stale&&Boolean(failedProvider)&&attempts<2;
  current.attempts=attempts+(retry?1:0);current.status=stale?'STALE':retry?'RETRY':'DONE';current.nextAttemptAt=retry?Date.now()+Math.min(30000,1000*2**attempts):undefined;current.reason=stale?'版本已变化，模型建议未执行':retry?`${reason}；${Math.ceil((current.nextAttemptAt-Date.now())/1000)}秒后重试`:reason;
  s.aiUsage.push({job_id:job.id,provider:response?chosen:failedProvider||'RULES',model:providers.find(p=>p.id===(response?chosen:failedProvider))?.model??'rules',input,output,cost,latency:duration,error:response?null:reason,game_time:s.gameTime});s.aiUsage=s.aiUsage.slice(-1000);
  if(!response&&!stale&&!retry)remember(s,resident.id,'当前先保证休息与职业工作，等待更多可靠信息。',job.id,'PRIVATE','INFERRED',[],.7);
 });
}
