import {sql} from 'drizzle-orm';
import {db} from '../../db/src/store';
import {encrypt,ProviderSchema,validateURL,type Provider} from './provider';
export async function modelMigrate(){await db.execute(sql`CREATE TABLE IF NOT EXISTS ai_providers (id text PRIMARY KEY,config jsonb NOT NULL)`);}
export async function providers(includeSecret=false):Promise<Provider[]>{const result=await db.execute(sql`SELECT config FROM ai_providers ORDER BY id`);return result.rows.map((r:any)=>{const c=r.config;return includeSecret?c:({...c,secret:undefined,hasKey:!!c.secret});});}
export async function saveProvider(input:unknown){const parsed=ProviderSchema.parse(input);await validateURL(parsed.baseUrl);const {apiKey,...config}=parsed;const old=(await providers(true)).find(p=>p.id===config.id);const p={...config,secret:apiKey?encrypt(apiKey):old?.secret};await db.execute(sql`INSERT INTO ai_providers(id,config) VALUES(${p.id},${JSON.stringify(p)}::jsonb) ON CONFLICT(id) DO UPDATE SET config=excluded.config`);return {...p,secret:undefined,hasKey:!!p.secret};}
