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
        socket.on('auth', (userId: string) => {
            onlineUsers[socket.id] = { userId: userId, socketId: socket.id };

            if (!userSockets[userId]) {
                userSockets[userId] = [];
            }
            userSockets[userId].push(socket.id);

            // Join personal room
            socket.join(`user:${userId}`);

            // Join user's chat rooms from DB
            const db = getDb();
            try {
                const chats = db.prepare(`
                    SELECT chat_id FROM chat_participants WHERE user_id = ?
                `).all(userId) as { chat_id: string }[];

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
        socket.on('message:send', (data: {
            chatId: string;
            senderId: string;
            encryptedContent: string;
            nonce: string;
            replyTo?: string;
        }) => {
            const { chatId, senderId, encryptedContent, nonce, replyTo } = data;
            const db = getDb();

            // Generate message ID
            const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Save to database
            db.prepare(`
        INSERT INTO messages (id, chat_id, sender_id, encrypted_content, nonce, reply_to)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(messageId, chatId, senderId, encryptedContent, nonce, replyTo || null);

            // Broadcast to chat room
            io.to(`chat:${chatId}`).emit('message:new', {
                id: messageId,
                chatId,
                senderId,
                encryptedContent,
                nonce,
                replyTo,
                timestamp: new Date().toISOString()
            });
        });

        // Typing indicator
        socket.on('message:typing', (data: { chatId: string; userId: string }) => {
            socket.to(`chat:${data.chatId}`).emit('message:typing', data);
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
