import { getGlobalCacheDb } from '../src/services/global-cache-service.js';

export const up = async function () {
  await getGlobalCacheDb().exec(`
    CREATE TABLE IF NOT EXISTS global_cache (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER
    );
  `);
};

export const down = async function () {
  await getGlobalCacheDb().exec(`
    DROP TABLE global_cache;
  `);
}; 