import { openDatabase } from '../db.js';
import { config } from '../load-config.js';
import { join } from 'node:path';

class GlobalCacheDb {
  constructor() {
    this.db = null;
  }

  open() {
    if (!this.db) {
      const dbPath = join(config.get('serverFiles'), 'global-cache.sqlite');
      this.db = openDatabase(dbPath);
    }
    return this.db;
  }

  get(key) {
    const db = this.open();
    const row = db.first('SELECT value, updated_at FROM global_cache WHERE key = ?', [key]);
    return row ? { value: row.value, updated_at: row.updated_at } : null;
  }

  set(key, value) {
    const db = this.open();
    const updated_at = Date.now();
    db.mutate(
      'INSERT OR REPLACE INTO global_cache (key, value, updated_at) VALUES (?, ?, ?)',
      [key, value, updated_at]
    );
  }
}

export const globalCacheService = new GlobalCacheDb();

export function getGlobalCacheDb() {
  const dbPath = join(config.get('serverFiles'), 'global-cache.sqlite');
  return openDatabase(dbPath);
} 