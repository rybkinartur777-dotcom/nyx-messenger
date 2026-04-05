import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Chat, Message, Contact, ToastData } from '../types';

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
    lastSeen: Record<string, Date>; // userId -> last seen time

    // UI
    isLoading: boolean;
    sidebarOpen: boolean;
    theme: 'dark' | 'light' | 'cyberpunk';
    lang: 'ru' | 'en' | 'uk';
    stealthMode: boolean; // Hide online status and read receipts
    deletedMessageIds: Set<string>;
    pinnedMessages: Record<string, Message[]>; // chatId -> pinned messages
    toasts: ToastData[]; // In-app notifications
    pinCode: string | null; // App access PIN
    fakePinCode: string | null; // Plausible deniability PIN
    isLocked: boolean; // App lock status
    isFakeMode: boolean; // True if logged in via fake PIN
    ghostMode: boolean; // Hide online presence from others
    lockedChatIds: Record<string, string>; // chatId -> specific chat password
    screenSecurity: boolean; // Blur app on focus loss and detect screenshots
    autoDeleteTimers: Record<string, number>; // chatId -> seconds of inactivity before deletion (0 means off)

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
    getLastSeen: (userId: string) => Date | null;
    addReaction: (chatId: string, messageId: string, emoji: string, userId: string) => void;
    removeReaction: (chatId: string, messageId: string, emoji: string, userId: string) => void;
    pinMessage: (chatId: string, message: Message) => void;
    unpinMessage: (chatId: string, messageId: string) => void;
    deleteMessageLocal: (messageId: string) => void;
    editMessage: (chatId: string, messageId: string, newContent: string) => void;
    setLanguage: (lang: 'ru' | 'en' | 'uk') => void;
    toggleStealthMode: () => void;
    addToast: (toast: Omit<ToastData, 'id'>) => void;
    removeToast: (id: string) => void;
    toggleChatPin: (chatId: string) => void;
    toggleChatMute: (chatId: string) => void;
    setPinCode: (pin: string | null) => void;
    setFakePinCode: (pin: string | null) => void;
    setLocked: (locked: boolean) => void;
    setFakeMode: (isFake: boolean) => void;
    panicWipe: () => void;
    toggleGhostMode: () => void;
    setChatLock: (chatId: string, password: string | null) => void;
    toggleScreenSecurity: () => void;
    setChatAutoDelete: (chatId: string, seconds: number) => void;
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
            lastSeen: {},
            isLoading: false,
            sidebarOpen: true,
            theme: 'dark',
            lang: 'ru',
            stealthMode: false,
            deletedMessageIds: new Set(),
            pinnedMessages: {},
            toasts: [],
            pinCode: null,
            fakePinCode: null,
            isLocked: false,
            isFakeMode: false,
            ghostMode: false,
            lockedChatIds: {},
            screenSecurity: true, // Enabled by default for premium feel
            autoDeleteTimers: {},

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
                const newLastSeen = { ...state.lastSeen, [userId]: new Date() };
                return { onlineUsers: newOnline, lastSeen: newLastSeen };
            }),

            isUserOnline: (userId) => {
                return get().onlineUsers.has(userId);
            },

            getLastSeen: (userId) => {
                return get().lastSeen[userId] || null;
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
            addToast: (toast) => {
                const id = `toast_${Date.now()}_${Math.random()}`;
                set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
                // Auto remove after 5s
                setTimeout(() => {
                    get().removeToast(id);
                }, 5000);
            },
            removeToast: (id) => {
                set((state) => ({
                    toasts: state.toasts.map(t => t.id === id ? { ...t, isExiting: true } : t)
                }));
                setTimeout(() => {
                    set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
                }, 300);
            },
            toggleChatPin: (chatId) => set((state) => ({
                chats: state.chats.map(c => c.id === chatId ? { ...c, isPinned: !c.isPinned } : c)
            })),
            toggleChatMute: (chatId) => set((state) => ({
                chats: state.chats.map(c => c.id === chatId ? { ...c, isMuted: !c.isMuted } : c)
            })),
            setPinCode: (pinCode) => set({ pinCode }),
            setFakePinCode: (fakePinCode) => set({ fakePinCode }),
            setLocked: (isLocked) => set({ isLocked }),
            setFakeMode: (isFakeMode) => set({ isFakeMode }),
            panicWipe: () => {
                // Nuclear option: wipe everything
                set({
                    user: null,
                    isAuthenticated: false,
                    chats: [],
                    activeChat: null,
                    messages: {},
                    contacts: [],
                    onlineUsers: new Set<string>(),
                    lastSeen: {},
                    pinnedMessages: {},
                    deletedMessageIds: new Set(),
                    toasts: [],
                    pinCode: null,
                    fakePinCode: null,
                    isLocked: false,
                    isFakeMode: false,
                    stealthMode: false,
                    ghostMode: false,
                });
                // Nuke persisted storage
                localStorage.removeItem('nyx-storage');
                // Disconnect socket
                import('../socket/socketService').then(m => {
                    m.socketService.disconnect();
                }).catch(() => {});
            },
            toggleGhostMode: () => {
                const current = get().ghostMode;
                set({ ghostMode: !current });
                // Notify server
                import('../socket/socketService').then(m => {
                    const socket = m.socketService.getSocket();
                    const userId = get().user?.id;
                    if (socket && userId) {
                        socket.emit('user:ghost', { userId, enabled: !current });
                    }
                }).catch(() => {});
            },
            setChatLock: (chatId, password) => set(state => {
                const newLocks = { ...state.lockedChatIds };
                if (password) {
                    newLocks[chatId] = password;
                } else {
                    delete newLocks[chatId];
                }
                return { lockedChatIds: newLocks };
            }),
            toggleScreenSecurity: () => set(state => ({ screenSecurity: !state.screenSecurity })),
            setChatAutoDelete: (chatId, seconds) => set(state => {
                const newTimers = { ...state.autoDeleteTimers };
                if (seconds > 0) {
                    newTimers[chatId] = seconds;
                } else {
                    delete newTimers[chatId];
                }
                return { autoDeleteTimers: newTimers };
            }),
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
                pinCode: state.pinCode,
                fakePinCode: state.fakePinCode,
                ghostMode: state.ghostMode,
                lockedChatIds: state.lockedChatIds,
                screenSecurity: state.screenSecurity,
                autoDeleteTimers: state.autoDeleteTimers,
                isFakeMode: false // Never persist fake mode being active
            }),
            onRehydrateStorage: () => (state) => {
                if (state && Array.isArray(state.deletedMessageIds)) {
                    state.deletedMessageIds = new Set(state.deletedMessageIds);
                }
            }
        }
    )
);
