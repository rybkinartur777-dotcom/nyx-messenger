import sqlite3 from 'sqlite3';
import { open, Database as SqliteDatabase } from 'sqlite';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../../data');
const dbPath = join(dataDir, 'nyx.db');

// Database type detection
const DATABASE_TYPE = process.env.DATABASE_URL ? 'postgres' : 'sqlite';

// Database instances
let sqliteDb: SqliteDatabase;
let pgPool: pg.Pool;

export async function initDatabase(): Promise<void> {
  if (DATABASE_TYPE === 'postgres') {
    console.log('🐘 Initializing PostgreSQL database...');

    pgPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : undefined
    });

    // Create tables for PostgreSQL
    await pgPool.query(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        public_key TEXT NOT NULL,
        avatar TEXT,
        allow_search_by_nickname INTEGER DEFAULT 0,
        auto_delete_messages INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Chats table
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        type TEXT CHECK(type IN ('private', 'group')) NOT NULL,
        name TEXT,
        avatar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Chat participants
      CREATE TABLE IF NOT EXISTS chat_participants (
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (chat_id, user_id),
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      );

      -- Messages
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(255) PRIMARY KEY,
        chat_id VARCHAR(255) NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        sender_id VARCHAR(255) NOT NULL,
        message_type VARCHAR(50) DEFAULT 'text',
        encrypted_content TEXT NOT NULL,
        nonce VARCHAR(255) NOT NULL,
        file_url TEXT,
        reply_to VARCHAR(255),
        expires_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'sent',
        self_destruct INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Contacts
      CREATE TABLE IF NOT EXISTS contacts (
        owner_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        nickname TEXT,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (owner_id, contact_id)
      );

      -- Sessions
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Message reactions
      CREATE TABLE IF NOT EXISTS message_reactions (
        message_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (message_id, user_id, emoji)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_participants_user ON chat_participants(user_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id);
      CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);
      CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);
    `);

    // Run migrations for existing DB
    try {
      await pgPool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS self_destruct INTEGER DEFAULT 0');
    } catch (err) { /* Ignore error if column already exists or unsupported */ }
    try {
      await pgPool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to VARCHAR(255)');
    } catch (err) { /* Ignore error */ }

    console.log('✓ PostgreSQL database initialized');
  } else {
    console.log('📦 Initializing SQLite database...');

    // Ensure directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    sqliteDb = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Enable WAL mode
    await sqliteDb.exec('PRAGMA journal_mode = WAL');

    // Create tables for SQLite
    await sqliteDb.exec(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        public_key TEXT NOT NULL,
        avatar TEXT,
        allow_search_by_nickname INTEGER DEFAULT 0,
        auto_delete_messages INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Chats table
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        type TEXT CHECK(type IN ('private', 'group')) NOT NULL,
        name TEXT,
        avatar TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Chat participants
      CREATE TABLE IF NOT EXISTS chat_participants (
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (chat_id, user_id),
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      );

      -- Messages
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        encrypted_content TEXT NOT NULL,
        nonce TEXT NOT NULL,
        file_url TEXT,
        reply_to TEXT,
        expires_at TEXT,
        status TEXT DEFAULT 'sent',
        self_destruct INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      );

      -- Contacts
      CREATE TABLE IF NOT EXISTS contacts (
        owner_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        nickname TEXT,
        added_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (owner_id, contact_id)
      );

      -- Sessions
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Message reactions
      CREATE TABLE IF NOT EXISTS message_reactions (
        message_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (message_id, user_id, emoji)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_participants_user ON chat_participants(user_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id);
      CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);
      CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);
    `);

    // Run migrations for existing DB
    try {
      await sqliteDb.exec('ALTER TABLE messages ADD COLUMN self_destruct INTEGER DEFAULT 0');
    } catch (err) { /* Ignore error if column already exists */ }
    try {
      await sqliteDb.exec('ALTER TABLE messages ADD COLUMN reply_to TEXT');
    } catch (err) { /* Ignore error */ }

    console.log('✓ SQLite database initialized');
  }
}

// Universal query function
export async function query(sql: string, params: any[] = []): Promise<any> {
  if (DATABASE_TYPE === 'postgres') {
    // Convert SQLite placeholders (?) to PostgreSQL ($1, $2, etc.)
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    const result = await pgPool.query(pgSql, params);
    return result.rows;
  } else {
    return await sqliteDb.all(sql, params);
  }
}

// Get a single row
export async function get(sql: string, params: any[] = []): Promise<any> {
  if (DATABASE_TYPE === 'postgres') {
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    const result = await pgPool.query(pgSql, params);
    return result.rows[0] || null;
  } else {
    return await sqliteDb.get(sql, params);
  }
}

// Run a query (INSERT, UPDATE, DELETE)
export async function run(sql: string, params: any[] = []): Promise<any> {
  if (DATABASE_TYPE === 'postgres') {
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    const result = await pgPool.query(pgSql, params);
    return {
      lastID: result.rows[0]?.id,
      changes: result.rowCount
    };
  } else {
    return await sqliteDb.run(sql, params);
  }
}

// Export database getter for backward compatibility
export function getDb(): SqliteDatabase | pg.Pool {
  return DATABASE_TYPE === 'postgres' ? pgPool : sqliteDb;
}

export { DATABASE_TYPE };
