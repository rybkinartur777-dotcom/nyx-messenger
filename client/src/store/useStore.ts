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

    // Actions
    setUser: (user: User | null) => void;
    logout: () => void;
    setChats: (chats: Chat[]) => void;
    setActiveChat: (chat: Chat | null) => void;
    addMessage: (chatId: string, message: Message) => void;
    setMessages: (chatId: string, messages: Message[]) => void;
    addContact: (contact: Contact) => void;
    removeContact: (userId: string) => void;
    setLoading: (loading: boolean) => void;
    toggleSidebar: () => void;
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

            setActiveChat: (chat) => set({ activeChat: chat }),

            addMessage: (chatId, message) => set((state) => ({
                messages: {
                    ...state.messages,
                    [chatId]: [...(state.messages[chatId] || []), message]
                }
            })),

            setMessages: (chatId, messages) => set((state) => ({
                messages: {
                    ...state.messages,
                    [chatId]: messages
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

            updateChatLastMessage: (chatId, message) => set((state) => ({
                chats: state.chats.map(chat =>
                    chat.id === chatId
                        ? { ...chat, lastMessage: message }
                        : chat
                )
            })),
        }),
        {
            name: 'nyx-storage',
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
                contacts: state.contacts,
            }),
        }
    )
);
