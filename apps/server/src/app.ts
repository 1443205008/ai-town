import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import { createHmac,timingSafeEqual,randomUUID } from 'node:crypto';
import { z } from 'zod';
import { migrate,listWorlds,ensureStarter,getWorld,mutate,snapshot,saveNew } from '../../../packages/db/src/store';
import { createWorld,event,publicWorld } from '../../../packages/world-core/src/world';
import {modelMigrate,providers,saveProvider} from '../../../packages/model-center/src/storage';
import {callOpenAI} from '../../../packages/model-center/src/provider';
import {trade,audit} from '../../../packages/economy/src/economy';
import {parseProposal,submitProposal,deliberate,revise,transition,stance} from '../../../packages/governance/src/governance';
import {validateSite,startProject,projectControl} from '../../../packages/city-planning/src/construction';
import {explore,expandChunk,admitMigrant,startBusiness,moveHome} from '../../../packages/world-core/src/expansion';
import {visit,diplomacy,civilizationTick} from '../../../packages/world-core/src/civilization';
import {JevDecisionAdapter,OpenAIDecisionAdapter,RulesDecisionAdapter,withFallback} from '../../../packages/model-center/src/decision';
import {contextFor} from '../../../packages/agent-runtime/src/memory';
import {simulate} from '../../../packages/world-core/src/simulate';
import {worldEvents} from '../../../packages/db/src/schema';
import {db} from '../../../packages/db/src/store';
import {eq} from 'drizzle-orm';
export async function buildApp(){
  const password=process.env.MAYOR_PASSWORD,secret=process.env.SESSION_SECRET;
  if(!password||!secret||secret.length<32)throw new Error('请配置 MAYOR_PASSWORD 与至少32字符 SESSION_SECRET');
  const app=Fastify({logger:{redact:['req.headers.cookie','req.headers.authorization','req.body.password','req.body.apiKey']},bodyLimit:2_000_000});
  await app.register(cookie);await app.register(websocket);
  const sign=(value:string)=>createHmac('sha256',secret).update(value).digest('hex');
  const secureEqual=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
  const loginAttempts=new Map<string,{count:number;resetAt:number}>();
  const wsConnections=new Map<string,number>();
  const valid=(token?:string)=>{if(!token)return false;const [expires,mac]=token.split('.');return Number(expires)>Date.now()&&secureEqual(mac??'',sign(expires));};
  app.addHook('onRequest',async(req,reply)=>{
    if(req.url==='/health'||req.url==='/api/login')return;
    if(!valid(req.cookies.frontier_session))return reply.code(401).send({message:'请先登录镇长账号'});
    const origin=req.headers.origin;
    if(origin&&origin!==process.env.APP_ORIGIN)return reply.code(403).send({message:'来源不被允许'});
  });
  app.setErrorHandler((err,req,reply)=>{const e=err as Error & {statusCode?:number};return reply.code(err instanceof z.ZodError?400:e.statusCode??400).send({message:e.message});});
  app.get('/health',async()=>({ok:true}));
  app.post('/api/login',async(req,reply)=>{
    const address=req.ip,now=Date.now(),attempt=loginAttempts.get(address);if(attempt&&attempt.resetAt<=now)loginAttempts.delete(address);else if(attempt&&attempt.count>=5)return reply.code(429).send({message:'登录尝试过多，请五分钟后重试'});
    const {password:input}=z.object({password:z.string().max(300)}).parse(req.body);
    if(!secureEqual(input,password)){const current=loginAttempts.get(address);loginAttempts.set(address,{count:(current?.count??0)+1,resetAt:current?.resetAt??now+300000});return reply.code(401).send({message:'密码不正确'});}loginAttempts.delete(address);
    const expires=String(Date.now()+86400000);
    return reply.setCookie('frontier_session',`${expires}.${sign(expires)}`,{httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true',path:'/',maxAge:86400}).send({ok:true});
  });
  app.post('/api/logout',async(_,reply)=>reply.clearCookie('frontier_session',{path:'/'}).send({ok:true}));
  app.get('/api/worlds',listWorlds);
  app.post('/api/worlds',async req=>{const b=z.object({scenarioId:z.enum(['starter','scarcity']).default('starter')}).parse(req.body??{});return publicWorld(await saveNew(createWorld(randomUUID(),b.scenarioId)));});
  app.get<{Params:{id:string}}>('/api/worlds/:id/state',async req=>publicWorld(await getWorld(req.params.id)));
  app.post<{Params:{id:string}}>('/api/worlds/:id/control',async req=>{
    const b=z.object({action:z.enum(['pause','resume','speed']),speed:z.union([z.literal(1),z.literal(2),z.literal(4)]).optional(),key:z.string().min(8),expectedVersion:z.number().int()}).parse(req.body);
    return publicWorld(await mutate(req.params.id,b.key,b.expectedVersion,w=>{if(b.action==='speed'){if(!b.speed)throw new Error('缺少速度');w.speed=b.speed;}else w.running=b.action==='resume';event(w,'world.control',b,'MAYOR','PUBLIC',b.key);}));
  });
  app.post<{Params:{id:string}}>('/api/worlds/:id/snapshot',req=>snapshot(req.params.id));
  app.get('/api/model-providers',()=>providers());
  app.get<{Params:{id:string}}>('/api/worlds/:id/events',async req=>(await db.select().from(worldEvents).where(eq(worldEvents.worldId,req.params.id))).map(r=>r.data).filter(e=>e.visibility==='PUBLIC'));
  app.get<{Params:{id:string}}>('/api/worlds/:id/metrics',async req=>{const w=await getWorld(req.params.id),ticks=(w.events??[]).filter(e=>e.type==='world.clock').slice(-100),gaps=ticks.slice(1).map((e,i)=>e.game_time-ticks[i].game_time);return {worldId:w.id,version:w.version,gameTime:w.gameTime,tick:{recentSamples:gaps.length,meanGameMinutesPerTick:gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:null,scheduledInMs:w.nextTickAt?Math.max(0,w.nextTickAt-Date.now()):null},ai:{pending:(w.aiJobs??[]).filter((j:any)=>['PENDING','RETRY'].includes(j.status)).length,retries:(w.aiJobs??[]).filter((j:any)=>j.status==='RETRY').length,completed:(w.aiJobs??[]).filter((j:any)=>j.status==='DONE').length,usageSamples:(w.aiUsage??[]).length,circuitsOpen:Object.values(w.modelCircuit??{}).filter((c:any)=>c.openUntil>Date.now()).length},ledger:audit(w),websocketConnections:wsConnections.get(w.id)??0};});
  app.post<{Params:{id:string}}>('/api/worlds/:id/export',async req=>({schema:'frontier-save-v1',state:await getWorld(req.params.id)}));
  if(process.env.DEBUG_SANDBOX_ENABLED==='true')app.post<{Params:{id:string}}>('/api/worlds/:id/debug-sandbox',async req=>{const {ticks}=z.object({ticks:z.number().int().min(1).max(500)}).parse(req.body),sandbox=structuredClone(await getWorld(req.params.id));sandbox.id=`debug-${randomUUID()}`;sandbox.version=0;sandbox.events=[];sandbox.eventSeq=0;for(let i=0;i<ticks;i++){simulate(sandbox);sandbox.version++;}return {sandbox:true,ticks,state:publicWorld(sandbox)};});
  app.post('/api/worlds/restore',async req=>{const point=z.object({x:z.number().int().nonnegative(),y:z.number().int().nonnegative()});const stateSchema=z.object({name:z.string().min(1).max(100),seed:z.number().int(),scenarioId:z.enum(['starter','scarcity']),gameTime:z.number().finite().nonnegative(),running:z.boolean(),speed:z.union([z.literal(1),z.literal(2),z.literal(4)]),map:z.object({width:z.number().int().positive().max(256),height:z.number().int().positive().max(256),tileSize:z.number().int().positive(),terrain:z.array(z.number()),elevation:z.array(z.number()),resource_nodes:z.array(z.any()),roads:z.array(point),zoning:z.array(z.any()),structures:z.array(z.any()),blueprints:z.array(z.any()),navigation:z.array(z.number()),fog_of_war:z.array(z.boolean())}),resources:z.record(z.number().finite().nonnegative()),residents:z.array(z.object({id:z.string(),name:z.string(),x:z.number().int(),y:z.number().int()}).passthrough()).min(1).max(100),proposals:z.array(z.any()),projects:z.array(z.any()),conversations:z.array(z.any()),settings:z.record(z.any()),version:z.number().int().nonnegative(),eventSeq:z.number().int().nonnegative()}).passthrough();const payload=z.object({schema:z.literal('frontier-save-v1'),state:stateSchema}).parse(req.body);const state=payload.state;if(state.map.terrain.length!==state.map.width*state.map.height||state.map.elevation.length!==state.map.terrain.length||state.map.navigation.length!==state.map.terrain.length||state.map.fog_of_war.length!==state.map.terrain.length)throw new Error('存档地图图层尺寸不一致');if(state.residents.some((r:any)=>r.x>=state.map.width||r.y>=state.map.height))throw new Error('存档居民坐标越界');const restored={...state,id:randomUUID(),version:0,eventSeq:0,events:[],nextTickAt:0,conversations:state.conversations??[]};delete (restored as any).aiJobs;delete (restored as any).aiUsage;await saveNew(restored as any);return publicWorld(restored as any);});
  const commandBase={key:z.string().min(8).max(100),expectedVersion:z.number().int().nonnegative()};
  const site=z.object({x:z.number().int(),y:z.number().int()});
  app.post<{Params:{id:string}}>('/api/worlds/:id/frontier',async req=>{const b=z.object({...commandBase,action:z.enum(['explore','expand','migrate','business','move','visit','diplomacy','fastForward']),site:site.optional(),team:z.array(z.string()).optional(),residentId:z.string().optional(),buildingId:z.string().optional(),name:z.string().max(40).optional(),text:z.string().max(500).optional(),type:z.string().optional(),settlementId:z.string().optional(),minutes:z.number().int().min(1).max(180).optional()}).parse(req.body);return publicWorld(await mutate(req.params.id,b.key,b.expectedVersion,w=>{if(b.action==='explore'){if(!b.site||!b.team)throw new Error('缺少目标/团队');explore(w,b.key,b.site,b.team);}else if(b.action==='expand')expandChunk(w,b.key);else if(b.action==='migrate')admitMigrant(w,b.key,b.name??'新移民');else if(b.action==='business')startBusiness(w,b.key,b.residentId??'',b.type??'');else if(b.action==='move')moveHome(w,b.residentId??'',b.buildingId??'');else if(b.action==='visit')visit(w,b.key,b.residentId??'',b.text??'你好');else if(b.action==='diplomacy'){civilizationTick(w,0);diplomacy(w,b.key,b.settlementId??'',b.type??'');}else{if(w.running)throw new Error('先暂停世界再短时间快进');for(let i=0;i<(b.minutes??1)/w.settings.gameMinutesPerTick;i++){simulate(w);w.version++;}event(w,'world.fast_forward',{minutes:b.minutes},'MAYOR','PUBLIC',b.key);}}));});
  app.post<{Params:{id:string}}>('/api/worlds/:id/decision-experiment',async req=>{
    const b=z.object({residentId:z.string(),providerId:z.string().optional(),llmProviderId:z.string().optional()}).parse(req.body),w=await getWorld(req.params.id),state=contextFor(w,b.residentId,'decision'),questions=[{id:'support_water',kind:'choice' as const,options:['SUPPORT','CONDITIONAL','OPPOSE']},{id:'urgency',kind:'score' as const},{id:'willing',kind:'noul' as const}],trials=3;
    const rules=await Promise.all(Array.from({length:5},()=>withFallback(new RulesDecisionAdapter(),state,questions)));
    const jev=(await providers(true)).find(p=>p.id===b.providerId&&p.enabled&&p.protocol==='JEV'),jevAdapter=jev?new JevDecisionAdapter({...jev,decisionPath:'/v1/decide',version:jev.model}):undefined,jevRuns:any[]=[];
    if(jevAdapter){for(let i=0;i<trials;i++){const run:any=await withFallback(jevAdapter,state,questions);if(jevAdapter.lastUsage){run.cost=jevAdapter.lastUsage.cost;run.costSource=jevAdapter.lastUsage.source;}jevRuns.push(run);if(run.fallback)break;}}
    const llm=(await providers(true)).find(p=>p.id===b.llmProviderId&&p.enabled&&p.protocol==='OPENAI'),llmAdapter=llm?new OpenAIDecisionAdapter(llm):undefined,llmRuns:any[]=[];
    if(llmAdapter){for(let i=0;i<trials;i++){const run:any=await withFallback(llmAdapter,state,questions);if(llmAdapter.lastUsage)run.cost=llmAdapter.lastUsage.cost;llmRuns.push(run);if(run.fallback)break;}}
    const mean=(runs:any[],key:string)=>{const values=runs.map(r=>r[key]).filter((n:any)=>typeof n==='number'&&Number.isFinite(n));return values.length?Number((values.reduce((a:number,b:number)=>a+b,0)/values.length).toFixed(6)):null;};
    const summarize=(runs:any[],expected?:string)=>({samples:runs.length,meanLatencyMs:mean(runs,'latency'),meanCost:mean(runs,'cost'),fallbacks:runs.filter(r=>r.fallback).length,attitudeStability:runs.length<2?null:runs.filter(r=>r.answers.support_water===runs[0].answers.support_water).length/runs.length,characterConsistency:expected&&runs.length?runs.filter(r=>r.answers.support_water===expected).length/runs.length:null,expectedRoleStance:expected??null});
    const targetResident=w.residents.find(r=>r.id===b.residentId),canonical=targetResident?stance(w,targetResident,{id:'experiment:water',kind:'RATIONING'} as any).stance:null;
    const committeeRoles=[['工程师','工程师'],['医生','医生'],['商贩','商贩'],['居民代表','居民']];
    const committeeRecords=committeeRoles.map(([role,match])=>{const resident=w.residents.find(r=>String(r.role).includes(match))??w.residents[0],thirst=resident.needs?.thirst??0,view=role==='医生'?'CONDITIONAL':thirst>60?'SUPPORT':role==='商贩'?'OPPOSE':'CONDITIONAL',reason=role==='医生'?'主张保障饮水和医疗最低配额':thirst>60?'个人口渴需求较高，支持尽快采取节水措施':role==='商贩'?'担心限水对交易与生计造成额外影响':'要求公布可执行的配额和复核期限';return {role,name:resident.name,residentId:resident.id,view,reason,knownThirst:thirst,source:'居民当前状态与职业立场'};});
    return {rules:{...rules[0],metrics:summarize(rules,canonical??undefined)},llm:{...summarize(llmRuns,canonical??undefined),characterConsistencyMethod:'重复态度与当前角色规则立场一致率'},selected:jevRuns.length?{...jevRuns[0],metrics:summarize(jevRuns,canonical??undefined),runs:jevRuns}:null,committee:{status:'ADVISORY',question:'是否支持限水方案？',records:committeeRecords},limitation:'规则态度稳定性来自固定输入重复样本；LLM和Jev各最多调用3次并统计供应商报告的费用/延迟；角色一致度是与角色规则立场的可解释基准，不代表主观质量评分。Jev费用优先使用供应商报告成本，否则由报告Token和已配置单价计算；无用量时显示未知，不等于免费。委员会意见不自动执行。'};
  });
  const draft=z.object({title:z.string().min(1).max(100),objective:z.string().max(2000),kind:z.enum(['CONSTRUCTION','RATIONING','TAX','MIGRATION','OPEN_DISCUSSION']),structureType:z.enum(['WATER_TOWER','HOUSING','FARM','ROAD']).optional(),budgetCap:z.number().nonnegative().max(1000000),rationLevel:z.number().int().min(1).max(3).default(2),taxRate:z.number().min(0).max(.3).default(.05),site:site.nullable(),rotation:z.union([z.literal(0),z.literal(90),z.literal(180),z.literal(270)]).default(0)});
  app.post('/api/proposals/parse',async req=>parseProposal(z.object({text:z.string().min(1).max(2000)}).parse(req.body).text));
  app.post<{Params:{id:string}}>('/api/worlds/:id/proposals',async req=>{const b=z.object({...commandBase,draft}).parse(req.body);return publicWorld(await mutate(req.params.id,b.key,b.expectedVersion,w=>{submitProposal(w,b.draft,b.key);}));});
  app.post<{Params:{id:string,pid:string}}>('/api/worlds/:id/proposals/:pid/action',async req=>{const b=z.object({...commandBase,action:z.enum(['deliberate','revise','withdraw','start']),changes:draft.partial().optional()}).parse(req.body);return publicWorld(await mutate(req.params.id,b.key,b.expectedVersion,w=>{const p=w.proposals.find(p=>p.id===req.params.pid);if(!p)throw new Error('提案不存在');if(b.action==='deliberate')deliberate(w,p);else if(b.action==='revise')revise(w,p,b.changes??{});else if(b.action==='withdraw')transition(w,p,'CANCELLED','镇长撤回','MAYOR');else startProject(w,p);}));});
  app.post<{Params:{id:string}}>('/api/worlds/:id/blueprints/validate',async req=>{const b=z.object({type:z.enum(['WATER_TOWER','HOUSING','FARM','ROAD']),site,rotation:z.number().int().default(0)}).parse(req.body);return validateSite(await getWorld(req.params.id),b.type,b.site,b.rotation);});
  app.post<{Params:{id:string,pid:string}}>('/api/worlds/:id/projects/:pid/control',async req=>{const b=z.object({...commandBase,action:z.enum(['pause','resume','cancel'])}).parse(req.body);return publicWorld(await mutate(req.params.id,b.key,b.expectedVersion,w=>{const p=w.projects.find(p=>p.id===req.params.pid);if(!p)throw new Error('项目不存在');projectControl(w,p,b.action);}));});
  app.post<{Params:{id:string}}>('/api/worlds/:id/zoning',async req=>{const b=z.object({...commandBase,from:site,to:site,zone:z.enum(['HOUSING','AGRICULTURE','COMMERCIAL','PUBLIC','PROTECTED'])}).parse(req.body);return publicWorld(await mutate(req.params.id,b.key,b.expectedVersion,w=>{if(Math.min(b.from.x,b.to.x)<0||Math.min(b.from.y,b.to.y)<0||Math.max(b.from.x,b.to.x)>=w.map.width||Math.max(b.from.y,b.to.y)>=w.map.height)throw new Error('分区越界');for(let y=Math.min(b.from.y,b.to.y);y<=Math.max(b.from.y,b.to.y);y++)for(let x=Math.min(b.from.x,b.to.x);x<=Math.max(b.from.x,b.to.x);x++){w.map.zoning=w.map.zoning.filter(z=>z.x!==x||z.y!==y);w.map.zoning.push({x,y,zone:b.zone});}event(w,'map.chunk_changed',{layer:'zoning',...b},'MAYOR','PUBLIC',b.key);}));});
  app.get<{Params:{id:string}}>('/api/worlds/:id/treasury',async req=>{const w=await getWorld(req.params.id);return {accounts:w.accounts,ledger:w.ledger,audit:audit(w)};});
  app.post<{Params:{id:string}}>('/api/worlds/:id/trade',async req=>{const b=z.object({resource:z.enum(['water','food','wood','stone','tools']),amount:z.number().int().positive(),price:z.number().nonnegative(),key:z.string().min(8),expectedVersion:z.number().int()}).parse(req.body);return publicWorld(await mutate(req.params.id,b.key,b.expectedVersion,w=>trade(w,b.key,b.resource,b.amount,b.price)));});
  app.post('/api/model-providers',req=>saveProvider(req.body));
  app.post<{Params:{id:string}}>('/api/model-providers/:id/test',async req=>{const p=(await providers(true)).find(p=>p.id===req.params.id);if(!p||!p.enabled)throw new Error('供应商不存在或停用');if(p.protocol!=='OPENAI')throw new Error('Jev测试于M7实现');const result=await callOpenAI(p,{purpose:'connection-test'});return {ok:true,usage:result.usage};});
  app.post<{Params:{id:string}}>('/api/worlds/:id/model-policies',async req=>{const policy=z.object({providers:z.array(z.string()).max(5),dailyBudget:z.number().nonnegative().max(1000),maxCalls:z.number().int().min(0).max(10000)});const b=z.object({default:policy,residents:z.record(policy),purposes:z.record(policy),key:z.string().min(8),expectedVersion:z.number().int()}).parse(req.body);return publicWorld(await mutate(req.params.id,b.key,b.expectedVersion,w=>{w.modelPolicies={default:b.default,residents:b.residents,purposes:b.purposes};event(w,'ai.policy_changed',{},'MAYOR','PUBLIC',b.key);}));});
  app.post<{Params:{id:string}}>('/api/worlds/:id/settings',async req=>{const b=z.object({aiEnabled:z.boolean(),key:z.string().min(8),expectedVersion:z.number().int()}).parse(req.body);return publicWorld(await mutate(req.params.id,b.key,b.expectedVersion,w=>{w.settings.aiEnabled=b.aiEnabled;event(w,'world.settings_changed',{aiEnabled:b.aiEnabled},'MAYOR','PUBLIC',b.key);}));});
  app.get<{Params:{id:string}}>('/ws/:id',{websocket:true},(socket,req)=>{
    wsConnections.set(req.params.id,(wsConnections.get(req.params.id)??0)+1);
    let version=-1,busy=false;
    const send=async()=>{if(busy)return;busy=true;try{const w=await getWorld(req.params.id);if(w.version!==version){socket.send(JSON.stringify({type:'world.snapshot',world_id:w.id,event_seq:w.eventSeq,game_time:w.gameTime,state:publicWorld(w)}));version=w.version;}}catch{socket.close();}finally{busy=false;}};
    void send();const timer=setInterval(send,500);socket.on('close',()=>{clearInterval(timer);wsConnections.set(req.params.id,Math.max(0,(wsConnections.get(req.params.id)??1)-1));});
  });
  await migrate();await modelMigrate();await ensureStarter();return app;
}
