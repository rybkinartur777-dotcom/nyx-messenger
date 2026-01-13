import { io, Socket } from 'socket.io-client';
import { useStore } from '../store/useStore';
import { Message } from '../types';

class SocketService {
    private socket: Socket | null = null;
    private serverUrl = (import.meta as any).env.VITE_SERVER_URL || 'https://nyx-messenger-e77j.onrender.com';

    connect(userId: string) {
        if (this.socket?.connected) return;

        this.socket = io(this.serverUrl, {
            transports: ['websocket'],
            reconnection: true
        });

        this.socket.on('connect', () => {
            console.log('✅ Connected to Nyx Server');
            this.socket?.emit('auth', userId);
        });

        this.socket.on('message:new', (data: any) => {
            const { addMessage, updateChatLastMessage } = useStore.getState();

            // Handle incoming message
            // In a real app, we would decrypt it here using the private key
            const message: Message = {
                id: data.id,
                chatId: data.chatId,
                senderId: data.senderId,
                content: data.encryptedContent, // For now, showing as is, will add decryption
                timestamp: new Date(data.timestamp),
                status: 'delivered'
            };

            addMessage(data.chatId, message);
            updateChatLastMessage(data.chatId, message);
        });

        this.socket.on('message:typing', () => {
            // Can be used to show typing indicator
        });
    }

    sendMessage(chatId: string, senderId: string, content: string) {
        if (!this.socket?.connected) return;

        const { addMessage, updateChatLastMessage } = useStore.getState();

        const messageData = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            chatId,
            senderId,
            encryptedContent: content,
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

    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
    }
}

export const socketService = new SocketService();
