import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../data');
const dbPath = join(dataDir, 'nyx.db');

async function migrate() {
    const sqliteDb = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log('Migrating database to remove unique nickname constraint...');

    await sqliteDb.exec(`
      PRAGMA foreign_keys=off;
      BEGIN TRANSACTION;

      CREATE TABLE IF NOT EXISTS new_users (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        public_key TEXT NOT NULL,
        avatar TEXT,
        allow_search_by_nickname INTEGER DEFAULT 0,
        auto_delete_messages INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO new_users SELECT * FROM users;
      DROP TABLE users;
      ALTER TABLE new_users RENAME TO users;

      CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);

      COMMIT;
      PRAGMA foreign_keys=on;
    `);

    console.log('Migration complete!');
    await sqliteDb.close();
}

migrate().catch(console.error);
