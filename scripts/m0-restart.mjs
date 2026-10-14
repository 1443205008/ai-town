import {readFileSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
const base='http://127.0.0.1:3100';
const login=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:process.env.MAYOR_PASSWORD})});
if(!login.ok)throw new Error('登录失败');
const cookie=login.headers.get('set-cookie').split(';')[0];
async function api(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const value=await r.json();if(!r.ok)throw new Error(value.message);return value;}
const w=await api('/api/worlds/starter/state');
const digest=w=>({gameTime:w.gameTime,map:createHash('sha256').update(JSON.stringify(w.map)).digest('hex')});
if(process.argv[2]==='before'){
 const paused=await api('/api/worlds/starter/control',{action:'pause',key:randomUUID(),expectedVersion:w.version});
 writeFileSync('/tmp/frontier-m0-restart.json',JSON.stringify(digest(paused)));
 console.log('重启前世界已暂停并记录地图校验和。');
}else{
 if(JSON.stringify(digest(w))!==readFileSync('/tmp/frontier-m0-restart.json','utf8'))throw new Error('重启状态不一致');
 await api('/api/worlds/starter/control',{action:'resume',key:randomUUID(),expectedVersion:w.version});
 console.log('PASS：API/Worker 重启后时间和地图完全一致，已恢复模拟。');
}
