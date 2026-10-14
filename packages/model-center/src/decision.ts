import {z} from 'zod';
import {validateURL,decrypt,callOpenAI,type Provider} from './provider';
export type DecisionQuestion={id:string;kind:'choice'|'score'|'noul';options?:string[]};
export interface DecisionProvider{decide(state:Record<string,unknown>,questions:DecisionQuestion[]):Promise<Record<string,string|number|boolean>>;}
export class RulesDecisionAdapter implements DecisionProvider{async decide(state:Record<string,unknown>,questions:DecisionQuestion[]){return Object.fromEntries(questions.map(q=>[q.id,q.kind==='choice'?(q.options?.[0]??'DECLINE'):q.kind==='score'?50:false]));}}
export class OpenAIDecisionAdapter implements DecisionProvider{
 lastUsage:{cost:number;latency:number}|undefined;
 constructor(private provider:Provider){}
 async decide(state:Record<string,unknown>,questions:DecisionQuestion[]){
  this.lastUsage=undefined;
  const response=await callOpenAI(this.provider,{purpose:'decision_experiment',task:'Answer each listed question as the resident. Return a JSON object mapping each question id to a legal answer. Use only the supplied resident profile and known information. Score answers must be integers from 0 to 100; noul answers must be booleans.',state,questions});this.lastUsage={cost:response.usage.cost,latency:response.usage.latency};
  const parsed=z.record(z.union([z.string(),z.number(),z.boolean()])).parse(JSON.parse(response.output.content));
  for(const q of questions){const value=parsed[q.id];if(value===undefined)throw new Error('模型遗漏决策问题');if(q.kind==='choice'&&(typeof value!=='string'||!q.options?.includes(value)))throw new Error('模型返回非法选项');if(q.kind==='score'&&(typeof value!=='number'||value<0||value>100))throw new Error('模型返回非法分数');if(q.kind==='noul'&&typeof value!=='boolean')throw new Error('模型返回非法概率结论');}
  return parsed;
 }
}
export class JevDecisionAdapter implements DecisionProvider{
 lastUsage:{cost:number|null;latency:number;source:string}|undefined;
 constructor(private config:Provider & {decisionPath:string;version:string}){}
 async decide(state:Record<string,unknown>,questions:DecisionQuestion[]){
  this.lastUsage=undefined;const started=performance.now();
  await validateURL(this.config.baseUrl);if(!/^\/[a-zA-Z0-9/_-]+$/.test(this.config.decisionPath))throw new Error('无效决策接口路径');
  const typed=Object.fromEntries(questions.map(q=>[q.id,{type:q.kind,instructions:q.id,...(q.kind==='choice'?{criteria:Object.fromEntries((q.options??[]).map(v=>[v,v]))}:q.kind==='score'?{criteria:['low','medium','high','urgent']}: {})}]));
  const r=await fetch(this.config.baseUrl.replace(/\/$/,'')+this.config.decisionPath,{method:'POST',redirect:'error',signal:AbortSignal.timeout(this.config.timeoutMs),headers:{'Content-Type':'application/json',...(this.config.secret?{Authorization:`Bearer ${decrypt(this.config.secret)}`}:{})},body:JSON.stringify({model:this.config.version,state,questions:typed})});if(!r.ok)throw new Error(`Jev请求失败${r.status}`);
  const data=z.object({usage:z.object({cost:z.number().finite().nonnegative().optional(),input_tokens:z.number().int().nonnegative().optional(),output_tokens:z.number().int().nonnegative().optional()}).optional(),answers:z.record(z.object({type:z.enum(['choice','score','noul']),choice:z.string().optional(),score:z.number().optional(),noul:z.number().optional()}))}).parse(await r.json()),result:Record<string,string|number|boolean>={};
  for(const q of questions){const a=data.answers[q.id];if(!a||a.type!==q.kind)throw new Error('决策类型不符合问题');if(q.kind==='choice'){if(!q.options?.includes(a.choice??''))throw new Error('非法选项');result[q.id]=a.choice!;}else if(q.kind==='score'){if(a.score===undefined||a.score<0||a.score>3)throw new Error('非法分数');result[q.id]=a.score/3*100;}else{if(a.noul===undefined||a.noul<0||a.noul>1)throw new Error('非法概率');result[q.id]=a.noul>=.5;}}
  const usage=data.usage,hasTokens=usage?.input_tokens!==undefined&&usage?.output_tokens!==undefined;
  this.lastUsage={latency:performance.now()-started,cost:usage?.cost??(hasTokens?((usage!.input_tokens!*this.config.inputPrice+usage!.output_tokens!*this.config.outputPrice)/1e6):null),source:usage?.cost!==undefined?'provider-reported-cost':hasTokens?'reported-tokens-configured-prices':'unavailable'};
  return result;
 }
}
export async function withFallback(provider:DecisionProvider,state:Record<string,unknown>,questions:DecisionQuestion[]){const start=performance.now();try{return {answers:await provider.decide(state,questions),fallback:false,latency:performance.now()-start};}catch{return {answers:await new RulesDecisionAdapter().decide(state,questions),fallback:true,latency:performance.now()-start};}}
