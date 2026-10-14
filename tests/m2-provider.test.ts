import {it,expect,afterAll} from 'vitest';
import {createServer} from 'node:http';
import {callOpenAI,encrypt,validateURL} from '../packages/model-center/src/provider';
import {pool,migrate,saveNew,getWorld} from '../packages/db/src/store';
import {createWorld} from '../packages/world-core/src/world';
import {scheduleJobs,runJob} from '../packages/agent-runtime/src/jobs';
afterAll(()=>pool.end());
it('兼容服务切换、401/429/超时、预算限额与规则回退',async()=>{
 process.env.SESSION_SECRET='test-secret-with-at-least-32-characters';let mode='ok';
 const server=createServer((req,res)=>{if(mode==='timeout')return;if(mode==='401'||mode==='429'){res.writeHead(Number(mode));res.end('{}');return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({kind:'GOAL',content:'成立节水小组'})}}],usage:{prompt_tokens:12,completion_tokens:8}}));});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address() as any,base=`http://127.0.0.1:${address.port}`;process.env.LOCAL_MODEL_ALLOWLIST=base;
 const p={id:'mock',name:'mock',protocol:'OPENAI' as const,baseUrl:base,model:'fake',enabled:true,timeoutMs:100,inputPrice:1,outputPrice:1,secret:encrypt('fake')};
 try{expect((await callOpenAI(p,{})).output.content).toBe('成立节水小组');expect((await callOpenAI({...p,id:'backup',model:'backup'},{})).usage.input).toBe(12);for(const m of ['401','429','timeout']){mode=m;await expect(callOpenAI(p,{})).rejects.toThrow();}
 mode='401';await migrate();const w=createWorld();scheduleJobs(w);w.version++;w.modelPolicies.default={providers:['mock'],dailyBudget:1,maxCalls:10};await saveNew(w);let result=await runJob(w,w.aiJobs[0],[p]);expect(result.aiJobs[0].status).toBe('RETRY');expect(result.aiJobs[0].attempts).toBe(1);expect(result.aiJobs[0].nextAttemptAt).toBeGreaterThan(Date.now());result.aiJobs[0].nextAttemptAt=0;result=await runJob(result,result.aiJobs[0],[p]);expect(result.aiJobs[0].status).toBe('RETRY');expect(result.aiJobs[0].attempts).toBe(2);result.aiJobs[0].nextAttemptAt=0;result=await runJob(result,result.aiJobs[0],[p]);expect(result.aiJobs[0].status).toBe('DONE');expect(result.modelCircuit.mock.failures).toBe(3);expect(result.modelCircuit.mock.openUntil).toBeGreaterThan(Date.now());expect(result.aiUsage.length).toBe(3);expect(result.residents.length).toBe(20);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
