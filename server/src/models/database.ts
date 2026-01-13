import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../../data');
const dbPath = join(dataDir, 'nyx.db');

// Ensure directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db: Database;

export async function initDatabase(): Promise<void> {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable WAL mode
  await db.exec('PRAGMA journal_mode = WAL');

  // Create tables
  await db.exec(`
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          nickname TEXT UNIQUE NOT NULL,
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
          encrypted_content TEXT NOT NULL,
          nonce TEXT NOT NULL,
          reply_to TEXT,
          expires_at TEXT,
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

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
        CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
        CREATE INDEX IF NOT EXISTS idx_participants_user ON chat_participants(user_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id);
    `);

  console.log('✓ Database initialized (sqlite3)');
}

export function getDb(): Database {
  return db;
}
