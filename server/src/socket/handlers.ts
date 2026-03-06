import { Server, Socket } from 'socket.io';
import { getDb } from '../models/database.js';
import { query, run, get } from '../models/database.js';

interface OnlineUsers {
    [socketId: string]: {
        userId: string;
        socketId: string;
    };
}

interface UserSockets {
    [userId: string]: string[];
}

const onlineUsers: OnlineUsers = {};
const userSockets: UserSockets = {};

export function setupSocketHandlers(io: Server) {
    io.on('connection', (socket: Socket) => {
        console.log(`🔌 User connected: ${socket.id}`);

        // User authentication
        socket.on('auth', async (userId: string) => {
            onlineUsers[socket.id] = { userId: userId, socketId: socket.id };

            if (!userSockets[userId]) {
                userSockets[userId] = [];
            }
            userSockets[userId].push(socket.id);

            // Join personal room
            socket.join(`user:${userId}`);

            // Join user's chat rooms from DB
            try {
                const chats = await query(`
                    SELECT chat_id FROM chat_participants WHERE user_id = ?
                `, [userId]) as { chat_id: string }[];

                chats.forEach(chat => {
                    socket.join(`chat:${chat.chat_id}`);
                });
            } catch (err) {
                console.log('No chats found for user or table missing');
            }

            // Broadcast online status to everyone else
            socket.broadcast.emit('user:online', userId);

            // Send list of ALL currently online users to the newly connected user
            const onlineUserIds = [...new Set(Object.values(onlineUsers).map(u => u.userId))];
            socket.emit('user:online:list', onlineUserIds);

            console.log(`✓ User ${userId} authenticated, online: ${onlineUserIds.length} users`);
        });

        // New message
        socket.on('message:send', async (data: any) => {
            console.log('📨 MESSAGE RECEIVED ON SERVER:', data);

            const { chatId, senderId, message_type, type, encryptedContent, file_url, nonce, replyTo, selfDestruct } = data;

            const messageId = data.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const finalType = message_type || type || 'text';

            try {
                // Save to database
                await run(`
                    INSERT INTO messages (id, chat_id, sender_id, message_type, encrypted_content, file_url, nonce, reply_to, self_destruct)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [messageId, chatId, senderId, finalType, encryptedContent, file_url || null, nonce || 'dummy_nonce', replyTo || null, selfDestruct ? 1 : 0]);

                // Ensure sender is in participants
                try {
                    await run('INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?)', [chatId, senderId]);
                } catch (e) {
                    // Ignore duplicate participant error
                }

                // Ensure socket is in the room
                socket.join(`chat:${chatId}`);

                // Get sender nickname for notification
                const sender = await get('SELECT nickname FROM users WHERE id = ?', [senderId]) as { nickname: string } | null;

                const messageData = {
                    id: messageId,
                    chatId,
                    senderId,
                    senderName: sender?.nickname || 'Unknown',
                    message_type: finalType,
                    type: finalType,
                    encryptedContent,
                    file_url,
                    nonce,
                    replyTo,
                    selfDestruct,
                    timestamp: new Date().toISOString()
                };

                // Deliver to all participants via user rooms
                const participants = await query('SELECT user_id FROM chat_participants WHERE chat_id = ?', [chatId]) as { user_id: string }[];

                if (participants && participants.length > 0) {
                    participants.forEach(p => {
                        io.to(`user:${p.user_id}`).emit('message:new', messageData);
                    });
                }

                // Also broadcast to the active chat room to catch anyone currently viewing it
                socket.to(`chat:${chatId}`).emit('message:new', messageData);
            } catch (err) {
                console.error('Error saving message:', err);
            }
        });

        // Typing indicator
        socket.on('message:typing', (data: { chatId: string; userId: string }) => {
            socket.to(`chat:${data.chatId}`).emit('message:typing', data);
        });

        // Delete message
        socket.on('message:delete', async (data: { chatId: string, messageId: string, userId: string }) => {
            const { chatId, messageId, userId } = data;

            try {
                await run('DELETE FROM messages WHERE id = ? AND chat_id = ?', [messageId, chatId]);

                // Also clean up reactions for deleted message
                try {
                    await run('DELETE FROM message_reactions WHERE message_id = ?', [messageId]);
                } catch (_) { /* reactions table may not exist yet */ }

                io.to(`chat:${chatId}`).emit('message:deleted', { chatId, messageId });
            } catch (err) {
                console.error('Error deleting message:', err);
            }
        });

        // Edit message
        socket.on('message:edit', async (data: { chatId: string; messageId: string; newContent: string; userId: string }) => {
            const { chatId, messageId, newContent, userId } = data;

            try {
                const msg = await get('SELECT sender_id FROM messages WHERE id = ?', [messageId]) as { sender_id: string } | null;
                if (!msg || msg.sender_id !== userId) return;

                await run(
                    'UPDATE messages SET encrypted_content = ? WHERE id = ? AND chat_id = ?',
                    [newContent, messageId, chatId]
                );

                io.to(`chat:${chatId}`).emit('message:edited', { chatId, messageId, newContent });
            } catch (err) {
                console.error('Error editing message:', err);
                io.to(`chat:${chatId}`).emit('message:edited', { chatId, messageId, newContent });
            }
        });

        // Message read - for self-destruct
        socket.on('message:read', async (data: { chatId: string, messageId: string, userId: string }) => {
            const { chatId, messageId, userId } = data;

            // Check if this message should self-destruct
            try {
                // In a real app we'd check the DB, but for now we broadcast the burn event
                // The client will handle local deletion
                io.to(`chat:${chatId}`).emit('message:burn', { messageId, delay: 5000 });

                // Also delete from DB after delay
                setTimeout(async () => {
                    await run('DELETE FROM messages WHERE id = ?', [messageId]);
                }, 6000);
            } catch (err) {
                console.error('Error in self-destruct read handler:', err);
            }
        });

        // Delete chat
        socket.on('chat:delete', async (data: { chatId: string }) => {
            const { chatId } = data;
            try {
                // Delete messages for this chat
                await run('DELETE FROM messages WHERE chat_id = ?', [chatId]);
                // Delete chat participants
                await run('DELETE FROM chat_participants WHERE chat_id = ?', [chatId]);
                // Delete chat itself
                await run('DELETE FROM chats WHERE id = ?', [chatId]);

                // Emit to all users in room that the chat was deleted
                io.to(`chat:${chatId}`).emit('chat:deleted', { chatId });

                // Then let everyone leave the room
                io.in(`chat:${chatId}`).socketsLeave(`chat:${chatId}`);
            } catch (err) {
                console.error('Error deleting chat:', err);
            }
        });

        // Mark messages as read
        socket.on('message:read', async (data: { chatId: string, userId: string }) => {
            try {
                await run('UPDATE messages SET status = ? WHERE chat_id = ? AND sender_id != ? AND status != ?', ['read', data.chatId, data.userId, 'read']);

                socket.to(`chat:${data.chatId}`).emit('message:read', {
                    chatId: data.chatId,
                    userId: data.userId
                });
            } catch (err) {
                console.error('Error marking messages read:', err);
            }
        });

        // Emoji reactions
        socket.on('message:reaction', async (data: {
            chatId: string;
            messageId: string;
            emoji: string;
            userId: string;
            action: 'add' | 'remove';
        }) => {
            const { chatId, messageId, emoji, userId, action } = data;

            try {
                if (action === 'add') {
                    try {
                        await run(
                            'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)',
                            [messageId, userId, emoji]
                        );
                    } catch (e) {
                        // Ignore duplicate reaction error
                    }
                } else {
                    await run(
                        'DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
                        [messageId, userId, emoji]
                    );
                }

                // Broadcast to all chat participants
                io.to(`chat:${chatId}`).emit('message:reaction', { chatId, messageId, emoji, userId, action });
            } catch (err) {
                console.error('Error handling reaction:', err);
                // Still broadcast even if DB fails
                io.to(`chat:${chatId}`).emit('message:reaction', { chatId, messageId, emoji, userId, action });
            }
        });

        // Join chat room
        socket.on('chat:join', (chatId: string) => {
            socket.join(`chat:${chatId}`);
        });

        // Leave chat room
        socket.on('chat:leave', (chatId: string) => {
            socket.leave(`chat:${chatId}`);
        });

        // Disconnect
        socket.on('disconnect', () => {
            const userData = onlineUsers[socket.id];
            if (userData) {
                const userId = userData.userId;

                if (userSockets[userId]) {
                    userSockets[userId] = userSockets[userId].filter(id => id !== socket.id);

                    if (userSockets[userId].length === 0) {
                        delete userSockets[userId];
                        socket.broadcast.emit('user:offline', userId);
                    }
                }

                delete onlineUsers[socket.id];
            }
            console.log(`🔌 User disconnected: ${socket.id}`);
        });
    });
}

export function isUserOnline(userId: string): boolean {
    return !!userSockets[userId] && userSockets[userId].length > 0;
}

export function getUserSockets(userId: string): string[] {
    return userSockets[userId] || [];
}
