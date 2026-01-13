// User types
export interface User {
    id: string;
    nickname: string;
    publicKey: string;
    avatar?: string;
    createdAt: Date;
    settings: UserSettings;
}

export interface UserSettings {
    allowSearchByNickname: boolean;
    autoDeleteMessages: number | null; // seconds or null
}

// Message types
export interface Message {
    id: string;
    chatId: string;
    senderId: string;
    content: string;
    timestamp: Date;
    status: 'sending' | 'sent' | 'delivered' | 'read';
    replyTo?: string;
    expiresAt?: Date;
}

export interface EncryptedMessage {
    id: string;
    chatId: string;
    senderId: string;
    encryptedContent: string;
    nonce: string;
    timestamp: Date;
    expiresAt?: Date;
}

// Chat types
export interface Chat {
    id: string;
    type: 'private' | 'group';
    participants: string[];
    name?: string;
    avatar?: string;
    lastMessage?: Message;
    unreadCount: number;
    createdAt: Date;
}

// Contact types
export interface Contact {
    userId: string;
    nickname: string;
    publicKey: string;
    avatar?: string;
    addedAt: Date;
}

// Auth types
export interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

// API Response types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// Socket events
export interface SocketEvents {
    'message:new': (message: EncryptedMessage) => void;
    'message:typing': (data: { chatId: string; userId: string }) => void;
    'user:online': (userId: string) => void;
    'user:offline': (userId: string) => void;
}
