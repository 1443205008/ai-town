import { migrate,pool } from './store';
await migrate();console.log('数据库迁移完成');await pool.end();
