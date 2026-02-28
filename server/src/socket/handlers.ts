import { Server, Socket } from 'socket.io';
import { getDb } from '../models/database.js';

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
            const db = getDb() as any;
            try {
                const chats = await db.all(`
                    SELECT chat_id FROM chat_participants WHERE user_id = ?
                `, [userId]) as { chat_id: string }[];

                chats.forEach(chat => {
                    socket.join(`chat:${chat.chat_id}`);
                });
            } catch (err) {
                console.log('No chats found for user or table missing');
            }

            // Broadcast online status
            socket.broadcast.emit('user:online', userId);
            console.log(`✓ User ${userId} authenticated`);
        });

        // New message
        socket.on('message:send', async (data: {
            id?: string;
            chatId: string;
            senderId: string;
            message_type?: string;
            encryptedContent: string;
            file_url?: string;
            nonce: string;
            replyTo?: string;
        }) => {
            const { chatId, senderId, message_type, encryptedContent, file_url, nonce, replyTo } = data;
            const db = getDb() as any;

            // Use provided ID or generate one
            const messageId = data.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            try {
                // Save to database
                await db.run(`
                    INSERT INTO messages (id, chat_id, sender_id, message_type, encrypted_content, file_url, nonce, reply_to)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [messageId, chatId, senderId, message_type || 'text', encryptedContent, file_url || null, nonce, replyTo || null]);

                // Also make sure they are in the participants table (if not already)
                await db.run('INSERT OR IGNORE INTO chat_participants (chat_id, user_id) VALUES (?, ?)', [chatId, senderId]);

                // Ensure the socket is in the room
                socket.join(`chat:${chatId}`);

                const messageData = {
                    id: messageId,
                    chatId,
                    senderId,
                    message_type: message_type || 'text',
                    encryptedContent,
                    file_url,
                    nonce,
                    replyTo,
                    timestamp: new Date().toISOString()
                };

                // Fetch all participants of this chat to guarantee delivery even if they haven't joined the chat room yet
                const participants = await db.all('SELECT user_id FROM chat_participants WHERE chat_id = ?', [chatId]) as { user_id: string }[];

                if (participants && participants.length > 0) {
                    participants.forEach(p => {
                        io.to(`user:${p.user_id}`).emit('message:new', messageData);
                    });
                } else {
                    // Fallback to chat room if participants query fails
                    io.to(`chat:${chatId}`).emit('message:new', messageData);
                }
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
            const db = getDb() as any;

            try {
                // Delete message where id matches and sender is the current user
                await db.run('DELETE FROM messages WHERE id = ? AND chat_id = ? AND sender_id = ?', [messageId, chatId, userId]);

                // Broadcast deletion to chat room
                io.to(`chat:${chatId}`).emit('message:deleted', {
                    chatId,
                    messageId
                });
            } catch (err) {
                console.error('Error deleting message:', err);
            }
        });

        // Mark messages as read
        socket.on('message:read', async (data: { chatId: string, userId: string }) => {
            const db = getDb() as any;
            try {
                // Update messages in database
                await db.run('UPDATE messages SET status = ? WHERE chat_id = ? AND sender_id != ? AND status != ?', ['read', data.chatId, data.userId, 'read']);

                // Broadcast to the chat room that messages were read by this user
                socket.to(`chat:${data.chatId}`).emit('message:read', {
                    chatId: data.chatId,
                    userId: data.userId
                });
            } catch (err) {
                console.error('Error marking messages read:', err);
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

                // Remove from userSockets
                if (userSockets[userId]) {
                    userSockets[userId] = userSockets[userId].filter(id => id !== socket.id);

                    // If no more sockets, user is offline
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
