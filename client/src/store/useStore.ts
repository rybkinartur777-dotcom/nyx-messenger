import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Chat, Message, Contact } from '../types';

interface AppState {
    // Auth
    user: User | null;
    isAuthenticated: boolean;

    // Chats
    chats: Chat[];
    activeChat: Chat | null;
    messages: Record<string, Message[]>; // chatId -> messages

    // Contacts
    contacts: Contact[];

    // Online users
    onlineUsers: Set<string>;

    // UI
    isLoading: boolean;
    sidebarOpen: boolean;
    theme: 'dark' | 'light' | 'cyberpunk';
    lang: 'ru' | 'en';
    stealthMode: boolean; // Hide online status and read receipts
    deletedMessageIds: Set<string>;
    pinnedMessages: Record<string, Message[]>; // chatId -> pinned messages

    // Actions
    setUser: (user: User | null) => void;
    logout: () => void;
    setChats: (chats: Chat[]) => void;
    setActiveChat: (chat: Chat | null) => void;
    removeChat: (chatId: string) => void;
    addMessage: (chatId: string, message: Message) => void;
    removeMessage: (chatId: string, messageId: string) => void;
    markMessagesAsRead: (chatId: string, userId: string) => void;
    setMessages: (chatId: string, messages: Message[]) => void;
    addContact: (contact: Contact) => void;
    removeContact: (userId: string) => void;
    setLoading: (loading: boolean) => void;
    toggleSidebar: () => void;
    setTheme: (theme: 'dark' | 'light' | 'cyberpunk') => void;
    updateChatLastMessage: (chatId: string, message: Message) => void;
    setUserOnline: (userId: string) => void;
    setUserOffline: (userId: string) => void;
    isUserOnline: (userId: string) => boolean;
    addReaction: (chatId: string, messageId: string, emoji: string, userId: string) => void;
    removeReaction: (chatId: string, messageId: string, emoji: string, userId: string) => void;
    pinMessage: (chatId: string, message: Message) => void;
    unpinMessage: (chatId: string, messageId: string) => void;
    deleteMessageLocal: (messageId: string) => void;
    editMessage: (chatId: string, messageId: string, newContent: string) => void;
    setLanguage: (lang: 'ru' | 'en') => void;
    toggleStealthMode: () => void;
}

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            // Initial state
            user: null,
            isAuthenticated: false,
            chats: [],
            activeChat: null,
            messages: {},
            contacts: [],
            onlineUsers: new Set<string>(),
            isLoading: false,
            sidebarOpen: true,
            theme: 'dark',
            lang: 'ru',
            stealthMode: false,
            deletedMessageIds: new Set(),
            pinnedMessages: {},

            // Actions
            setUser: (user) => set({
                user,
                isAuthenticated: !!user
            }),

            logout: () => set({
                user: null,
                isAuthenticated: false,
                chats: [],
                activeChat: null,
                messages: {},
                contacts: [],
                onlineUsers: new Set<string>()
            }),

            setChats: (chats) => set({ chats }),

            setActiveChat: (chat) => set((state) => ({
                activeChat: chat,
                chats: state.chats.map(c =>
                    c.id === chat?.id ? { ...c, unreadCount: 0 } : c
                )
            })),

            removeChat: (chatId) => set((state) => {
                const newMessages = { ...state.messages };
                delete newMessages[chatId];
                return {
                    chats: state.chats.filter(c => c.id !== chatId),
                    activeChat: state.activeChat?.id === chatId ? null : state.activeChat,
                    messages: newMessages
                };
            }),

            addMessage: (chatId, message) => set((state) => {
                if (state.deletedMessageIds.has(message.id)) return state;
                const existingMessages = state.messages[chatId] || [];
                const messageExists = existingMessages.findIndex(m => m.id === message.id);

                if (messageExists >= 0) {
                    const newMessages = [...existingMessages];
                    newMessages[messageExists] = message;
                    return {
                        messages: {
                            ...state.messages,
                            [chatId]: newMessages
                        }
                    };
                }

                return {
                    messages: {
                        ...state.messages,
                        [chatId]: [...existingMessages, message]
                    }
                };
            }),

            setMessages: (chatId, messages) => set((state) => ({
                messages: {
                    ...state.messages,
                    [chatId]: messages.filter(m => !state.deletedMessageIds.has(m.id))
                }
            })),

            removeMessage: (chatId, messageId) => set((state) => ({
                messages: {
                    ...state.messages,
                    [chatId]: (state.messages[chatId] || []).filter(m => m.id !== messageId)
                }
            })),

            markMessagesAsRead: (chatId, userId) => set((state) => ({
                messages: {
                    ...state.messages,
                    [chatId]: (state.messages[chatId] || []).map(m => {
                        if (m.senderId !== userId) {
                            return { ...m, status: 'read' as const };
                        }
                        return m;
                    })
                }
            })),

            addContact: (contact) => set((state) => ({
                contacts: [...state.contacts, contact]
            })),

            removeContact: (userId) => set((state) => ({
                contacts: state.contacts.filter(c => c.userId !== userId)
            })),

            setLoading: (loading) => set({ isLoading: loading }),

            toggleSidebar: () => set((state) => ({
                sidebarOpen: !state.sidebarOpen
            })),

            setTheme: (theme) => set({ theme }),

            updateChatLastMessage: (chatId, message) => set((state) => ({
                chats: state.chats.map(chat => {
                    if (chat.id === chatId) {
                        const isReceiver = message.senderId !== state.user?.id;
                        const isNotActive = state.activeChat?.id !== chatId;
                        return {
                            ...chat,
                            lastMessage: message,
                            unreadCount: isReceiver && isNotActive ? (chat.unreadCount || 0) + 1 : chat.unreadCount
                        };
                    }
                    return chat;
                })
            })),

            setUserOnline: (userId) => set((state) => {
                const newOnline = new Set(state.onlineUsers);
                newOnline.add(userId);
                return { onlineUsers: newOnline };
            }),

            setUserOffline: (userId) => set((state) => {
                const newOnline = new Set(state.onlineUsers);
                newOnline.delete(userId);
                return { onlineUsers: newOnline };
            }),

            isUserOnline: (userId) => {
                return get().onlineUsers.has(userId);
            },

            addReaction: (chatId, messageId, emoji, userId) => set((state) => ({
                messages: {
                    ...state.messages,
                    [chatId]: (state.messages[chatId] || []).map(m => {
                        if (m.id === messageId) {
                            const reactions = m.reactions || [];
                            const exists = reactions.some(r => r.emoji === emoji && r.userId === userId);
                            if (exists) return m;
                            return { ...m, reactions: [...reactions, { emoji, userId }] };
                        }
                        return m;
                    })
                }
            })),

            removeReaction: (chatId, messageId, emoji, userId) => set((state) => ({
                messages: {
                    ...state.messages,
                    [chatId]: (state.messages[chatId] || []).map(m => {
                        if (m.id === messageId) {
                            return {
                                ...m,
                                reactions: (m.reactions || []).filter(
                                    r => !(r.emoji === emoji && r.userId === userId)
                                )
                            };
                        }
                        return m;
                    })
                }
            })),

            pinMessage: (chatId, message) => set((state) => {
                const currentPins = state.pinnedMessages[chatId] || [];
                if (currentPins.find(m => m.id === message.id)) return state;
                return {
                    pinnedMessages: {
                        ...state.pinnedMessages,
                        [chatId]: [...currentPins, message]
                    }
                };
            }),

            unpinMessage: (chatId, messageId) => set((state) => {
                const currentPins = state.pinnedMessages[chatId] || [];
                return {
                    pinnedMessages: {
                        ...state.pinnedMessages,
                        [chatId]: currentPins.filter(m => m.id !== messageId)
                    }
                };
            }),

            deleteMessageLocal: (messageId) => set((state) => {
                const newDeleted = new Set(state.deletedMessageIds);
                newDeleted.add(messageId);
                return { deletedMessageIds: newDeleted };
            }),

            editMessage: (chatId, messageId, newContent) => set((state) => ({
                messages: {
                    ...state.messages,
                    [chatId]: (state.messages[chatId] || []).map(m =>
                        m.id === messageId
                            ? { ...m, content: newContent, edited: true }
                            : m
                    )
                }
            })),

            setLanguage: (lang) => set({ lang }),
            toggleStealthMode: () => set((state) => ({ stealthMode: !state.stealthMode })),
        }),
        {
            name: 'nyx-storage',
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
                contacts: state.contacts,
                chats: state.chats,
                theme: state.theme,
                lang: state.lang,
                stealthMode: state.stealthMode,
                pinnedMessages: state.pinnedMessages,
                deletedMessageIds: Array.from(state.deletedMessageIds), // persists as array
            }),
            onRehydrateStorage: () => (state) => {
                if (state && Array.isArray(state.deletedMessageIds)) {
                    state.deletedMessageIds = new Set(state.deletedMessageIds);
                }
            }
        }
    )
);
