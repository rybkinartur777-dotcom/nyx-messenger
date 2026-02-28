import { io, Socket } from 'socket.io-client';
import { useStore } from '../store/useStore';
import { Message } from '../types';
import { API_BASE_URL } from '../config';

class SocketService {
    private socket: Socket | null = null;
    private serverUrl = API_BASE_URL;

    connect(userId: string) {
        if (this.socket) return;

        this.socket = io(this.serverUrl, {
            transports: ['websocket'],
            reconnection: true
        });

        this.socket.on('connect', () => {
            console.log('✅ Connected to Nyx Server');
            this.socket?.emit('auth', userId);
        });

        this.socket.on('message:new', async (data: any) => {
            const { addMessage, updateChatLastMessage, chats, setChats, user } = useStore.getState();

            // Handle incoming message
            // In a real app, we would decrypt it here using the private key
            const message: Message = {
                id: data.id,
                chatId: data.chatId,
                senderId: data.senderId,
                content: data.encryptedContent,
                type: data.message_type || 'text',
                fileUrl: data.file_url,
                timestamp: new Date(data.timestamp),
                status: 'delivered'
            };

            addMessage(data.chatId, message);
            updateChatLastMessage(data.chatId, message);

            // If the chat doesn't exist locally (e.g., newly created by someone else), fetch all chats
            const chatExists = chats.find(c => c.id === data.chatId);
            if (!chatExists && user?.id) {
                try {
                    const serverUrl = API_BASE_URL.replace(/\/$/, '');
                    const response = await fetch(`${serverUrl}/api/chats/user/${user.id}`);
                    const result = await response.json();

                    if (result.success) {
                        setChats(result.data);
                    }
                } catch (err) {
                    console.error('Failed to fetch chats after new message:', err);
                }
            }
        });

        this.socket.on('message:typing', () => {
            // Can be used to show typing indicator
        });

        this.socket.on('message:deleted', (data: { chatId: string, messageId: string }) => {
            const { removeMessage } = useStore.getState();
            if (data.chatId && data.messageId) {
                removeMessage(data.chatId, data.messageId);
            }
        });
    }

    sendMessage(chatId: string, senderId: string, content: string, type: 'text' | 'image' | 'audio' | 'file' = 'text', fileUrl?: string) {
        if (!this.socket?.connected) return;

        const { addMessage, updateChatLastMessage } = useStore.getState();

        const messageData = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            chatId,
            senderId,
            message_type: type,
            encryptedContent: content,
            file_url: fileUrl,
            nonce: 'dummy_nonce',
            timestamp: new Date().toISOString()
        };

        // Emit to server
        this.socket.emit('message:send', messageData);

        // Add to local state immediately for responsiveness
        const localMessage: Message = {
            id: messageData.id,
            chatId: messageData.chatId,
            senderId: messageData.senderId,
            content: content,
            type: type,
            fileUrl: fileUrl,
            timestamp: new Date(),
            status: 'sent'
        };

        addMessage(chatId, localMessage);
        updateChatLastMessage(chatId, localMessage);
    }

    joinChat(chatId: string) {
        if (!this.socket?.connected) return;
        this.socket.emit('chat:join', chatId);
    }

    deleteMessage(chatId: string, messageId: string, userId: string) {
        if (!this.socket?.connected) return;

        this.socket.emit('message:delete', { chatId, messageId, userId });

        // Optimistic UI update
        const { removeMessage } = useStore.getState();
        removeMessage(chatId, messageId);
    }

    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
    }

    getSocket() {
        return this.socket;
    }
}

export const socketService = new SocketService();
