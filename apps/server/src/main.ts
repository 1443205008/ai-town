import { buildApp } from './app';
import { pool } from '../../../packages/db/src/store';
const app=await buildApp();await app.listen({host:'0.0.0.0',port:Number(process.env.PORT??3100)});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await app.close();await pool.end();process.exit(0);});
