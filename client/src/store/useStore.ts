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

    // UI
    isLoading: boolean;
    sidebarOpen: boolean;
    theme: 'dark' | 'light' | 'cyberpunk';

    // Actions
    setUser: (user: User | null) => void;
    logout: () => void;
    setChats: (chats: Chat[]) => void;
    setActiveChat: (chat: Chat | null) => void;
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
}

export const useStore = create<AppState>()(
    persist(
        (set) => ({
            // Initial state
            user: null,
            isAuthenticated: false,
            chats: [],
            activeChat: null,
            messages: {},
            contacts: [],
            isLoading: false,
            sidebarOpen: true,
            theme: 'dark',

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
                contacts: []
            }),

            setChats: (chats) => set({ chats }),

            setActiveChat: (chat) => set((state) => ({
                activeChat: chat,
                chats: state.chats.map(c =>
                    c.id === chat?.id ? { ...c, unreadCount: 0 } : c
                )
            })),

            addMessage: (chatId, message) => set((state) => {
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
                    [chatId]: messages
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
                        // If the message was sent to this user (we are the sender), 
                        // and they read it, mark as read
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
        }),
        {
            name: 'nyx-storage',
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
                contacts: state.contacts,
                chats: state.chats,
                theme: state.theme,
            }),
        }
    )
);
