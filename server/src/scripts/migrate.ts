import { pool } from '../db.js';
import { applyMigrations } from '../migrations.js';

const migrations = await applyMigrations(pool);
for (const migration of migrations) console.log(`Applied migration ${migration}`);
await pool.end();
