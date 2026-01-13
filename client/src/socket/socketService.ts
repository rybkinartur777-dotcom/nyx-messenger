import { io, Socket } from 'socket.io-client';
import { useStore } from '../store/useStore';
import { Message } from '../types';

class SocketService {
    private socket: Socket | null = null;
    private serverUrl = (import.meta as any).env.VITE_SERVER_URL || 'http://localhost:4000';

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

        this.socket.emit('message:send', {
            chatId,
            senderId,
            encryptedContent: content, // In a real app, this would be encrypted
            nonce: 'dummy_nonce'
        });
    }

    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
    }
}

export const socketService = new SocketService();
