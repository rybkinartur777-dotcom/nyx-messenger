import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../data');
const dbPath = join(dataDir, 'nyx.db');

async function migrate() {
    console.log('Opening database...');
    const sqliteDb = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    try {
        console.log('Adding status column to messages table...');
        await sqliteDb.exec(`
            ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'sent';
        `);
        console.log('Added status column successfully.');
    } catch (e: any) {
        if (e.message.includes('duplicate column name')) {
            console.log('Column status already exists.');
        } else {
            console.error('Error adding status column:', e);
        }
    }

    try {
        console.log('Updating existing messages to read...');
        await sqliteDb.exec(`
            UPDATE messages SET status = 'read';
        `);
        console.log('Updated existing messages.');
    } catch (e: any) {
        console.error('Error updating existing messages:', e);
    }

    await sqliteDb.close();
    console.log('Migration complete!');
}

migrate();
