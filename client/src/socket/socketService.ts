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
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: Infinity
        });

        this.socket.on('connect', () => {
            console.log('✅ Connected to Nyx Server');
            this.socket?.emit('auth', userId);
        });

        this.socket.on('message:new', async (data: any) => {
            const { addMessage, updateChatLastMessage, chats, setChats, user, messages } = useStore.getState();

            // Find reply info if message is a reply
            let replyContent: string | undefined;
            let replySender: string | undefined;
            if (data.replyTo) {
                // Look up message in current state
                for (const chatMsgs of Object.values(messages)) {
                    const repliedMsg = (chatMsgs as Message[]).find(m => m.id === data.replyTo);
                    if (repliedMsg) {
                        replyContent = repliedMsg.content;
                        replySender = repliedMsg.senderId === user?.id ? 'Вы' : undefined;
                        break;
                    }
                }
            }

            const message: Message = {
                id: data.id,
                chatId: data.chatId,
                senderId: data.senderId,
                content: data.encryptedContent,
                type: data.message_type || data.type || 'text',
                fileUrl: data.file_url,
                timestamp: new Date(data.timestamp),
                status: 'delivered',
                replyTo: data.replyTo,
                replyContent,
                replySender,
                reactions: [],
                selfDestruct: data.selfDestruct
            };

            addMessage(data.chatId, message);
            updateChatLastMessage(data.chatId, message);

            // If the chat doesn't exist locally, fetch all chats
            const chatExists = chats.find(c => c.id === data.chatId);
            if (!chatExists && user?.id) {
                try {
                    const serverUrl = API_BASE_URL.replace(/\/$/, '');
                    const response = await fetch(`${serverUrl}/api/chats/user/${user.id}`);
                    const result = await response.json();
                    if (result.success) setChats(result.data);
                } catch (err) {
                    console.error('Failed to fetch chats after new message:', err);
                }
            }

            // Show browser push notification if tab not focused
            if (document.hidden && data.senderId !== user?.id) {
                this.showNotification(data.senderName || 'Nyx', data.encryptedContent);
            }
        });

        this.socket.on('message:typing', () => {
            // Handled in ChatWindow
        });

        this.socket.on('message:deleted', (data: { chatId: string, messageId: string }) => {
            const { removeMessage } = useStore.getState();
            if (data.chatId && data.messageId) {
                removeMessage(data.chatId, data.messageId);
            }
        });

        this.socket.on('user:online', (userId: string) => {
            useStore.getState().setUserOnline(userId);
        });

        // Receive full list of online users on first connect
        this.socket.on('user:online:list', (userIds: string[]) => {
            const { setUserOnline } = useStore.getState();
            userIds.forEach(id => setUserOnline(id));
        });

        this.socket.on('user:offline', (userId: string) => {
            useStore.getState().setUserOffline(userId);
        });

        // Emoji reactions
        this.socket.on('message:reaction', (data: { chatId: string; messageId: string; emoji: string; userId: string; action: 'add' | 'remove' }) => {
            const { addReaction, removeReaction } = useStore.getState();
            if (data.action === 'add') {
                addReaction(data.chatId, data.messageId, data.emoji, data.userId);
            } else {
                removeReaction(data.chatId, data.messageId, data.emoji, data.userId);
            }
        });

        // Chat deleted
        this.socket.on('chat:deleted', (data: { chatId: string }) => {
            const { removeChat } = useStore.getState();
            if (data.chatId) {
                removeChat(data.chatId);
            }
        });

        // Message edited
        this.socket.on('message:edited', (data: { chatId: string; messageId: string; newContent: string }) => {
            const { editMessage } = useStore.getState();
            editMessage(data.chatId, data.messageId, data.newContent);
        });
    }

    private async showNotification(title: string, body: string) {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            new Notification(`Nyx — ${title}`, {
                body: body.length > 60 ? body.slice(0, 60) + '...' : body,
                icon: '/logo.png',
                badge: '/logo.png',
                tag: 'nyx-message'
            });
        }
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    sendMessage(
        chatId: string,
        senderId: string,
        content: string,
        type: 'text' | 'image' | 'audio' | 'file' | 'sticker' | 'video' = 'text',
        fileUrl?: string,
        replyTo?: string,
        replyContent?: string,
        replySender?: string,
        selfDestruct?: boolean
    ) {
        if (!this.socket?.connected) return;

        const { addMessage, updateChatLastMessage } = useStore.getState();

        const messageData = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            chatId,
            senderId,
            type: type,
            encryptedContent: content,
            file_url: fileUrl,
            nonce: 'dummy_nonce',
            replyTo,
            timestamp: new Date().toISOString(),
            selfDestruct
        };

        this.socket.emit('message:send', messageData);

        // Optimistic update
        const localMessage: Message = {
            id: messageData.id,
            chatId: messageData.chatId,
            senderId: messageData.senderId,
            content: content,
            type: type,
            fileUrl: fileUrl,
            timestamp: new Date(),
            status: 'sent',
            replyTo,
            replyContent,
            replySender,
            reactions: [],
            selfDestruct
        };

        addMessage(chatId, localMessage);
        updateChatLastMessage(chatId, localMessage);
    }

    sendReaction(chatId: string, messageId: string, emoji: string, action: 'add' | 'remove') {
        if (!this.socket?.connected) return;
        const { addReaction, removeReaction, user } = useStore.getState();
        if (!user) return;

        this.socket.emit('message:reaction', { chatId, messageId, emoji, userId: user.id, action });

        // Optimistic update
        if (action === 'add') {
            addReaction(chatId, messageId, emoji, user.id);
        } else {
            removeReaction(chatId, messageId, emoji, user.id);
        }
    }

    joinChat(chatId: string) {
        if (!this.socket?.connected) return;
        this.socket.emit('chat:join', chatId);
    }

    deleteMessage(chatId: string, messageId: string, userId: string) {
        if (!this.socket?.connected) return;

        this.socket.emit('message:delete', { chatId, messageId, userId });

        const { removeMessage } = useStore.getState();
        removeMessage(chatId, messageId);
    }

    editMessage(chatId: string, messageId: string, newContent: string, userId: string) {
        if (!this.socket?.connected) return;

        this.socket.emit('message:edit', { chatId, messageId, newContent, userId });

        // Optimistic update
        const { editMessage } = useStore.getState();
        editMessage(chatId, messageId, newContent);
    }

    deleteChat(chatId: string) {
        if (!this.socket?.connected) return;
        this.socket.emit('chat:delete', { chatId });

        // Optimistically remove on client side
        const { removeChat } = useStore.getState();
        removeChat(chatId);
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
