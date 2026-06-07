import { Router, Request, Response } from 'express';
import { get, run, query } from '../models/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Create private chat
router.post('/private', async (req: Request, res: Response) => {
    try {
        const { userId, contactId } = req.body;

        // Check if chat already exists
        let existingChat;
        if (userId === contactId) {
            existingChat = await get(`
        SELECT c.id FROM chats c
        JOIN chat_participants cp ON c.id = cp.chat_id
        WHERE c.type = 'private'
        GROUP BY c.id
        HAVING COUNT(cp.user_id) = 1 AND MAX(cp.user_id) = ?
      `, [userId]) as any;
        } else {
            existingChat = await get(`
        SELECT c.id FROM chats c
        JOIN chat_participants cp1 ON c.id = cp1.chat_id AND cp1.user_id = ?
        JOIN chat_participants cp2 ON c.id = cp2.chat_id AND cp2.user_id = ?
        WHERE c.type = 'private'
      `, [userId, contactId]) as any;
        }

        if (existingChat) {
            return res.json({
                success: true,
                data: { chatId: existingChat.id, existing: true }
            });
        }

        // Create new chat
        const chatId = uuidv4();

        await run(`
      INSERT INTO chats (id, type) VALUES (?, 'private')
    `, [chatId]);

        if (userId === contactId) {
            // Saved Messages / Secure notes
            await run(`
        INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?)
      `, [chatId, userId]);
        } else {
            await run(`
        INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?), (?, ?)
      `, [chatId, userId, chatId, contactId]);
        }

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

        const chatId = uuidv4();

        await run(`
      INSERT INTO chats (id, type, name) VALUES (?, 'group', ?)
    `, [chatId, name]);

        // Add all participants including creator
        const allParticipants = [creatorId, ...participants];
        for (const participantId of allParticipants) {
            await run(`
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

        const chats = await query(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM messages m 
         WHERE m.chat_id = c.id 
         AND m.sender_id != ? AND m.status != 'read') as unread_count
      FROM chats c
      JOIN chat_participants cp ON c.id = cp.chat_id
      WHERE cp.user_id = ?
      ORDER BY c.created_at DESC
    `, [userId, userId]) as any[];

        if (chats.length === 0) {
            return res.json({
                success: true,
                data: []
            });
        }

        const chatIds = chats.map(c => c.id);
        const placeholders = chatIds.map(() => '?').join(',');

        // 1. Get all participants for all chats in a single query
        const participantsRows = await query(`
            SELECT cp.chat_id, u.id, u.nickname, u.avatar
            FROM users u
            JOIN chat_participants cp ON u.id = cp.user_id
            WHERE cp.chat_id IN (${placeholders})
        `, chatIds) as any[];

        // Group participants by chat_id
        const participantsMap: Record<string, any[]> = {};
        participantsRows.forEach(row => {
            if (!participantsMap[row.chat_id]) {
                participantsMap[row.chat_id] = [];
            }
            participantsMap[row.chat_id].push({
                id: row.id,
                nickname: row.nickname,
                avatar: row.avatar
            });
        });

        // 2. Get the last message for all chats in a single query using a window function
        const lastMessagesRows = await query(`
            SELECT m.id, m.chat_id, m.sender_id, m.message_type, m.encrypted_content, m.file_url, m.created_at, m.status, u.nickname as sender_name
            FROM (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY chat_id ORDER BY created_at DESC) as rn
                FROM messages
                WHERE chat_id IN (${placeholders})
            ) m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.rn = 1
        `, chatIds) as any[];

        // Group last messages by chat_id
        const lastMessageMap: Record<string, any> = {};
        lastMessagesRows.forEach(row => {
            lastMessageMap[row.chat_id] = {
                id: row.id,
                senderId: row.sender_id,
                senderName: row.sender_name,
                message_type: row.message_type,
                encryptedContent: row.encrypted_content,
                file_url: row.file_url,
                timestamp: row.created_at,
                status: row.status
            };
        });

        const result = chats.map((chat) => {
            const chatParticipants = participantsMap[chat.id] || [];

            return {
                id: chat.id,
                type: chat.type,
                name: chat.name || (chat.type === 'private'
                    ? chatParticipants.find((p: any) => p.id !== userId)?.nickname
                    : undefined),
                avatar: chat.avatar || (chat.type === 'private'
                    ? chatParticipants.find((p: any) => p.id !== userId)?.avatar
                    : undefined),
                participants: chatParticipants.map((p: any) => p.id),
                participantDetails: chatParticipants,
                unreadCount: chat.unread_count || 0,
                lastMessage: lastMessageMap[chat.id] || null,
                createdAt: chat.created_at
            };
        });

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

        let sqlQuery = `
      SELECT m.*, u.nickname as sender_name FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = ?
    `;
        const params: any[] = [chatId];

        if (before) {
            sqlQuery += ` AND m.created_at < ?`;
            params.push(before);
        }

        sqlQuery += ` ORDER BY m.created_at DESC LIMIT ?`;
        params.push(Number(limit));

        const messages = await query(sqlQuery, params) as any[];

        res.json({
            success: true,
            data: messages.reverse().map(m => ({
                id: m.id,
                chatId: m.chat_id,
                senderId: m.sender_id,
                senderName: m.sender_name,
                message_type: m.message_type,
                encryptedContent: m.encrypted_content,
                file_url: m.file_url,
                nonce: m.nonce,
                replyTo: m.reply_to,
                timestamp: m.created_at,
                status: m.status
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
