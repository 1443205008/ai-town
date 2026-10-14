import { pgTable, text, integer, jsonb, timestamp, primaryKey, bigint } from 'drizzle-orm/pg-core';
import type { World, WorldEvent } from '../../shared/src/types';
export const worlds=pgTable('worlds',{id:text().primaryKey(),version:integer().notNull(),state:jsonb().$type<World>().notNull(),updatedAt:timestamp('updated_at',{withTimezone:true}).defaultNow()});
export const worldEvents=pgTable('world_events',{worldId:text('world_id').notNull().references(()=>worlds.id),seq:bigint({mode:'number'}).notNull(),data:jsonb().$type<WorldEvent>().notNull()},t=>[primaryKey({columns:[t.worldId,t.seq]})]);
export const commands=pgTable('simulation_commands',{worldId:text('world_id').notNull().references(()=>worlds.id),key:text().notNull(),result:jsonb().notNull()},t=>[primaryKey({columns:[t.worldId,t.key]})]);
export const snapshots=pgTable('world_snapshots',{id:text().primaryKey(),worldId:text('world_id').notNull().references(()=>worlds.id),version:integer().notNull(),state:jsonb().$type<World>().notNull(),checksum:text().notNull()});
