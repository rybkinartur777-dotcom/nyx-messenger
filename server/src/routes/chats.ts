import { Router, Request, Response } from 'express';
import { getDb } from '../models/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Create private chat
router.post('/private', async (req: Request, res: Response) => {
    try {
        const { userId, contactId } = req.body;
        const db = getDb();

        // Check if chat already exists
        const existingChat = await db.get(`
      SELECT c.id FROM chats c
      JOIN chat_participants cp1 ON c.id = cp1.chat_id AND cp1.user_id = ?
      JOIN chat_participants cp2 ON c.id = cp2.chat_id AND cp2.user_id = ?
      WHERE c.type = 'private'
    `, [userId, contactId]) as any;

        if (existingChat) {
            return res.json({
                success: true,
                data: { chatId: existingChat.id, existing: true }
            });
        }

        // Create new chat
        const chatId = uuidv4();

        await db.run(`
      INSERT INTO chats (id, type) VALUES (?, 'private')
    `, [chatId]);

        await db.run(`
      INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?), (?, ?)
    `, [chatId, userId, chatId, contactId]);

        res.json({
            success: true,
            data: { chatId, existing: false }
        });
    } catch (error) {
        console.error('Create private chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Create group chat
router.post('/group', async (req: Request, res: Response) => {
    try {
        const { name, creatorId, participants } = req.body;
        const db = getDb();

        const chatId = uuidv4();

        await db.run(`
      INSERT INTO chats (id, type, name) VALUES (?, 'group', ?)
    `, [chatId, name]);

        // Add all participants including creator
        const allParticipants = [creatorId, ...participants];
        for (const participantId of allParticipants) {
            await db.run(`
                INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?)
            `, [chatId, participantId]);
        }

        res.json({
            success: true,
            data: { chatId, name, participants: allParticipants }
        });
    } catch (error) {
        console.error('Create group chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get user's chats
router.get('/user/:userId', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const db = getDb();

        const chats = await db.all(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM messages m 
         WHERE m.chat_id = c.id 
         AND m.sender_id != ?) as unread_count
      FROM chats c
      JOIN chat_participants cp ON c.id = cp.chat_id
      WHERE cp.user_id = ?
      ORDER BY c.created_at DESC
    `, [userId, userId]) as any[];

        const result = await Promise.all(chats.map(async (chat) => {
            // Get participants
            const participants = await db.all(`
        SELECT u.id, u.nickname, u.avatar
        FROM users u
        JOIN chat_participants cp ON u.id = cp.user_id
        WHERE cp.chat_id = ?
      `, [chat.id]) as any[];

            // Get last message
            const lastMessage = await db.get(`
        SELECT * FROM messages 
        WHERE chat_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `, [chat.id]) as any;

            return {
                id: chat.id,
                type: chat.type,
                name: chat.name || (chat.type === 'private'
                    ? participants.find((p: any) => p.id !== userId)?.nickname
                    : undefined),
                participants: participants.map((p: any) => p.id),
                unreadCount: chat.unread_count || 0,
                lastMessage: lastMessage ? {
                    id: lastMessage.id,
                    senderId: lastMessage.sender_id,
                    encryptedContent: lastMessage.encrypted_content,
                    timestamp: lastMessage.created_at
                } : null,
                createdAt: chat.created_at
            };
        }));

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Get chats error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get chat messages
router.get('/:chatId/messages', async (req: Request, res: Response) => {
    try {
        const { chatId } = req.params;
        const { limit = 50, before } = req.query;
        const db = getDb();

        let query = `
      SELECT * FROM messages 
      WHERE chat_id = ?
    `;
        const params: any[] = [chatId];

        if (before) {
            query += ` AND created_at < ?`;
            params.push(before);
        }

        query += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(Number(limit));

        const messages = await db.all(query, params) as any[];

        res.json({
            success: true,
            data: messages.reverse().map(m => ({
                id: m.id,
                chatId: m.chat_id,
                senderId: m.sender_id,
                encryptedContent: m.encrypted_content,
                nonce: m.nonce,
                replyTo: m.reply_to,
                timestamp: m.created_at
            }))
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

export default router;
