import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useStore } from '../../store/useStore';
import { socketService } from '../../socket/socketService';
import { API_BASE_URL } from '../../config';
import { T } from '../../locales';
import { Message } from '../../types';

import AudioPlayer from './AudioPlayer';
import { EncryptionInfoModal } from './EncryptionInfoModal';

const EMOJI_LIST = [
    '❤️', '👍', '😂', '😮', '😢', '🔥', '💯', '👀',
    '🎉', '😍', '🤣', '😅', '🤔', '😡', '🥺', '💪',
    '🙏', '✅', '💀', '🤯', '😎', '🫶',
];
const STICKERS = ['😂', '❤️', '🔥', '👍', '💀', '🤡', '😭', '🥺', '🗿', '☕', '🐱', '🐶', '😎', '🎉', '🧠', '🤬', '💩', '👽', '👾', '🤖', '👑', '🤌'];

export const ChatWindow: React.FC = () => {
    const {
        activeChat, user, messages, chats, setMessages, markMessagesAsRead, onlineUsers,
        pinMessage, unpinMessage, pinnedMessages, lang, toggleSidebar,
        stealthMode, setActiveChat, getLastSeen, autoDeleteTimers, setChatAutoDelete
    } = useStore();
    const [inputValue, setInputValue] = useState('');
    const [showStickers, setShowStickers] = useState(false);
    const [showEncryptionModal, setShowEncryptionModal] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [searchMode, setSearchMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);
    const [emojiPickerPos, setEmojiPickerPos] = useState<{ x: number; y: number } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: Message } | null>(null);
    const [isSelfDestruct, setIsSelfDestruct] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
    const [showAutoDeleteMenu, setShowAutoDeleteMenu] = useState(false);
    // Mobile: bottom sheet context menu
    const [bottomSheet, setBottomSheet] = useState<{ message: Message } | null>(null);
    // Self-destruct countdown: messageId -> seconds remaining
    const [selfDestructCountdowns, setSelfDestructCountdowns] = useState<Record<string, number>>({});
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileAnyRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const shouldSendRef = useRef<boolean>(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const touchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasScrolledRef = useRef(false);

    // Premium Features State
    const [burningIds, setBurningIds] = useState<Set<string>>(new Set());
    const [swipeState, setSwipeState] = useState<{ id: string, offset: number } | null>(null);
    const touchStartXRef = useRef<number | null>(null);
    const touchStartYRef = useRef<number | null>(null);
    
    // Bottom sheet for mobile
    const isMobile = () => window.innerWidth <= 768 || ('ontouchstart' in window);

    const chatMessages = activeChat ? messages[activeChat.id] || [] : [];

    // Initial load tracking for scroll logic

    // Get contact user id (the other participant)
    const contactUserId = activeChat?.participants.find(p => p !== user?.id);
    const isContactOnline = contactUserId ? onlineUsers.has(contactUserId) : false;

    // Filtered messages for search
    const displayMessages = searchMode && searchQuery.trim()
        ? chatMessages.filter(m =>
            (m.type === 'text' || m.type === 'sticker') && m.content.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : chatMessages;

    useEffect(() => {
        const socket = socketService.getSocket();
        if (!socket) return;

        const handleTyping = (data: { chatId: string, userId: string }) => {
            if (activeChat && data.chatId === activeChat.id && data.userId !== user?.id) {
                // If the user hasn't opted into stealth mode, we technically still show typing unless the SENDER is stealth.
                // But simplified: we just show it. 
                setIsTyping(true);
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
            }
        };

        const handleMessageRead = (data: { chatId: string, userId: string }) => {
            if (activeChat && data.chatId === activeChat.id) {
                useStore.getState().markMessagesAsRead(data.chatId, data.userId);
            }
        };

        socket.on('message:typing', handleTyping);
        socket.on('message:read', handleMessageRead);

        return () => {
            socket.off('message:typing', handleTyping);
            socket.off('message:read', handleMessageRead);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, [activeChat, user]);

    useEffect(() => {
        if (!activeChat) return;
        let cancelled = false;

        const fetchMessages = async () => {
            try {
                const serverUrl = API_BASE_URL.replace(/\/$/, '');
                const response = await fetch(`${serverUrl}/api/chats/${activeChat.id}/messages`);
                const result = await response.json();

                if (cancelled) return; // chat was switched while fetching

                if (result.success) {
                    const formattedMessages = result.data.map((m: any) => ({
                        id: m.id,
                        chatId: m.chatId || activeChat.id,
                        senderId: m.senderId,
                        content: m.encryptedContent,
                        type: m.message_type || 'text',
                        fileUrl: m.fileUrl || m.file_url,
                        timestamp: new Date(m.timestamp),
                        status: m.status || (m.senderId !== user?.id ? 'read' : 'delivered'),
                        replyTo: m.replyTo,
                        replyContent: m.replyContent,
                        replySender: m.replySender,
                        reactions: m.reactions || [],
                        selfDestruct: m.self_destruct || m.selfDestruct
                    }));

                    // MERGE: keep local-only messages (optimistic updates) that aren't yet on the server
                    const existingLocal = useStore.getState().messages[activeChat.id] || [];
                    const serverIds = new Set(formattedMessages.map((m: any) => m.id));
                    const localOnly = existingLocal.filter(m => !serverIds.has(m.id));

                    // Combine server + local-only, sort by time
                    const merged = [...formattedMessages, ...localOnly].sort(
                        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                    );

                    setMessages(activeChat.id, merged);

                    if (merged.length > 0) {
                        const hasUnreadIncoming = merged.some((m: any) => m.senderId !== user?.id && m.status !== 'read');
                        if (hasUnreadIncoming && user && !stealthMode) {
                            socketService.getSocket()?.emit('message:read', { chatId: activeChat.id, userId: user.id });
                            markMessagesAsRead(activeChat.id, user.id);
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching messages:', err);
                // Don't wipe local messages on fetch error — keep what we have
            }
        };

        fetchMessages();
        return () => { cancelled = true; };
    }, [activeChat?.id]);


    useEffect(() => {
        if (messagesEndRef.current && !searchMode) {
            const container = messagesEndRef.current.parentElement;
            if (container) {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            }
        }

        if (activeChat && user && chatMessages.length > 0) {
            const unreadIncoming = chatMessages.filter(m => m.senderId !== user.id && m.status !== 'read');
            
            if (unreadIncoming.length > 0 && !stealthMode) {
                // Regular read receipts for all
                socketService.getSocket()?.emit('message:read', { chatId: activeChat.id, userId: user.id });
                markMessagesAsRead(activeChat.id, user.id);

                // Specific "burn" triggers for self-destructing messages
                unreadIncoming.forEach(m => {
                    if (m.selfDestruct) {
                        socketService.getSocket()?.emit('message:read:specific', { 
                            chatId: activeChat.id, 
                            messageId: m.id, 
                            userId: user.id 
                        });
                    }
                });
            }
        }
    }, [chatMessages.length, activeChat, user, searchMode]);

    // Close context menu on outside click
    useEffect(() => {
        const handleClick = () => {
            setContextMenu(null);
            setEmojiPickerFor(null);
            setEmojiPickerPos(null);
        };
        document.addEventListener('click', handleClick);
        document.addEventListener('touchstart', handleClick);
        return () => {
            document.removeEventListener('click', handleClick);
            document.removeEventListener('touchstart', handleClick);
        };
    }, []);

    // Focus search input
    useEffect(() => {
        if (searchMode) searchInputRef.current?.focus();
    }, [searchMode]);

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDateSeparator = (date: Date): string => {
        const d = new Date(date);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);

        if (d.toDateString() === now.toDateString()) return 'Сегодня';
        if (d.toDateString() === yesterday.toDateString()) return 'Вчера';

        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    };

    const shouldShowDateSeparator = (messages: typeof displayMessages, index: number): boolean => {
        if (index === 0) return true;
        const prev = new Date(messages[index - 1].timestamp);
        const curr = new Date(messages[index].timestamp);
        return prev.toDateString() !== curr.toDateString();
    };

    // Message status icon helper
    const MessageStatusIcon: React.FC<{ status: string }> = ({ status }) => {
        if (status === 'sending') {
            return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ opacity: 0.45 }}><circle cx="12" cy="12" r="10" /></svg>;
        }
        if (status === 'sent') {
            return (
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ opacity: 0.55 }}>
                    <polyline points="1,5 4.5,8.5 13,1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        }
        if (status === 'delivered') {
            return (
                <svg width="18" height="10" viewBox="0 0 18 10" fill="none" style={{ opacity: 0.55 }}>
                    <polyline points="1,5 4.5,8.5 13,1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="5,5 8.5,8.5 17,1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        }
        if (status === 'read') {
            return (
                <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
                    <polyline points="1,5 4.5,8.5 13,1" stroke="#4fc3f7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="5,5 8.5,8.5 17,1" stroke="#4fc3f7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        }
        return null;
    };


    // Drag & Drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };
    const handleDragLeave = (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
    };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (!activeChat || !user) return;
        const files = Array.from(e.dataTransfer.files);
        files.forEach(file => {
            const reader = new FileReader();
            if (file.type.startsWith('image/')) {
                reader.onload = () => setImagePreview(reader.result as string);
                reader.readAsDataURL(file);
            } else if (file.type.startsWith('video/')) {
                reader.onload = () => socketService.sendMessage(activeChat.id, user.id, `[Видео: ${file.name}]`, 'video', reader.result as string);
                reader.readAsDataURL(file);
            } else {
                reader.onload = () => socketService.sendMessage(activeChat.id, user.id, `[Файл: ${file.name}]`, 'file', reader.result as string);
                reader.readAsDataURL(file);
            }
        });
    };

    // Edit message submit
    const handleEditSubmit = () => {
        if (!editingMessage || !activeChat || !user) return;
        const trimmed = editingMessage.content.trim();
        if (!trimmed) return;
        socketService.editMessage(activeChat.id, editingMessage.id, trimmed, user.id);
        setEditingMessage(null);
    };

    const handleSend = () => {
        if (!activeChat || !user) return;

        const currentSelfDestruct = isSelfDestruct;

        if (imagePreview) {
            socketService.sendMessage(
                activeChat.id, user.id, inputValue.trim() || '[Изображение]', 'image', imagePreview,
                replyTo?.id, replyTo?.content, replyTo?.senderId === user.id ? 'Вы' : activeChat.name,
                currentSelfDestruct
            );
            setImagePreview(null);
            setInputValue('');
            setReplyTo(null);
            setIsSelfDestruct(false);
            return;
        }

        if (!inputValue.trim()) return;
        socketService.sendMessage(
            activeChat.id, user.id, inputValue.trim(), 'text', undefined,
            replyTo?.id, replyTo?.content, replyTo?.senderId === user.id ? 'Вы' : activeChat.name,
            currentSelfDestruct
        );
        setInputValue('');
        setReplyTo(null);
        setIsSelfDestruct(false);
    };

    // Self-destruct timer logic + countdown display
    useEffect(() => {
        const handleSelfDestruct = (data: { messageId: string, delay: number }) => {
            // Start countdown display
            const totalSeconds = Math.round(data.delay / 1000);
            setSelfDestructCountdowns(prev => ({ ...prev, [data.messageId]: totalSeconds }));

            // Countdown tick
            let remaining = totalSeconds;
            const tick = setInterval(() => {
                remaining -= 1;
                if (remaining <= 0) {
                    clearInterval(tick);
                    setSelfDestructCountdowns(prev => {
                        const next = { ...prev };
                        delete next[data.messageId];
                        return next;
                    });
                } else {
                    setSelfDestructCountdowns(prev => ({ ...prev, [data.messageId]: remaining }));
                }
            }, 1000);

            // Actually delete from local state after delay
            setTimeout(() => {
                setBurningIds(prev => { const n = new Set(prev); n.add(data.messageId); return n; });
                setTimeout(() => {
                    useStore.getState().deleteMessageLocal(data.messageId);
                    setBurningIds(prev => { const n = new Set(prev); n.delete(data.messageId); return n; });
                }, 1500); // Wait for burn animation
            }, data.delay);
        };

        const socket = socketService.getSocket();
        if (socket) socket.on('message:burn', handleSelfDestruct);
        
        return () => {
            if (socket) socket.off('message:burn', handleSelfDestruct);
        };
    }, []);

    // Link preview helpers
    const getYoutubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const isImageUrl = (url: string) => {
        return url.match(/\.(jpeg|jpg|gif|png|webp)$/) != null || url.includes('images.unsplash.com');
    };

    const handleSendSticker = (sticker: string) => {
        if (!activeChat || !user) return;
        socketService.sendMessage(
            activeChat.id, user.id, sticker, 'sticker', undefined,
            replyTo?.id, replyTo?.content, replyTo?.senderId === user.id ? 'Вы' : activeChat.name
        );
        setShowStickers(false);
        setReplyTo(null);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setImagePreview(reader.result as string);
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsDataURL(file);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeChat || !user) return;

        // If the selected file is an image, redirect it to the image preview handler
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => {
                setImagePreview(reader.result as string);
                if (fileAnyRef.current) fileAnyRef.current.value = '';
            };
            reader.readAsDataURL(file);
            return;
        }

        // If the selected file is a video, send it immediately as a video
        if (file.type.startsWith('video/')) {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result as string;
                socketService.sendMessage(activeChat.id, user.id, `[Видео: ${file.name}]`, 'video', base64);
                if (fileAnyRef.current) fileAnyRef.current.value = '';
            };
            reader.readAsDataURL(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            socketService.sendMessage(activeChat.id, user.id, `[Файл: ${file.name}]`, 'file', base64);
        };
        reader.readAsDataURL(file);
        if (fileAnyRef.current) fileAnyRef.current.value = '';
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Fix for iOS Safari using strictly supported formats
            let mimeType = '';
            if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
            else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
            else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';

            const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            setRecordingTime(0);

            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(t => t + 1);
            }, 1000);

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                if (shouldSendRef.current) {
                    const finalMime = mediaRecorder.mimeType || 'audio/mp4'; // Default to mp4 layout for iOS
                    const audioBlob = new Blob(audioChunksRef.current, { type: finalMime });
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64 = reader.result as string;
                        if (activeChat && user) {
                            socketService.sendMessage(activeChat.id, user.id, '[Голосовое сообщение]', 'audio', base64);
                        }
                    };
                    reader.readAsDataURL(audioBlob);
                }
                stream.getTracks().forEach(track => track.stop());
                if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error recording:', err);
        }
    };

    const stopRecording = (send: boolean) => {
        shouldSendRef.current = send;
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        if (activeChat && user && !stealthMode) {
            socketService.getSocket()?.emit('message:typing', { chatId: activeChat.id, userId: user.id });
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleContextMenu = (e: React.MouseEvent, message: Message) => {
        e.preventDefault();
        e.stopPropagation();
        // On mobile — use bottom sheet instead
        if (isMobile()) {
            setBottomSheet({ message });
            return;
        }
        const MENU_W = 190;
        const MENU_H = 170;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const x = e.clientX + MENU_W > vw ? e.clientX - MENU_W : e.clientX;
        const y = e.clientY + MENU_H > vh ? e.clientY - MENU_H : e.clientY;
        setContextMenu({ x: Math.max(8, x), y: Math.max(8, y), message });
    };


    const openEmojiPicker = (e: React.MouseEvent, msgId: string, fromX?: number, fromY?: number) => {
        e.stopPropagation();
        if (emojiPickerFor === msgId) {
            setEmojiPickerFor(null);
            setEmojiPickerPos(null);
            return;
        }
        // Calculate position — either from provided coords (context menu) or button position
        const PICKER_W = 220;
        const PICKER_H = 56;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let x: number;
        let y: number;

        if (fromX !== undefined && fromY !== undefined) {
            x = fromX;
            y = fromY;
        } else {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            x = rect.left;
            y = rect.top > PICKER_H + 16 ? rect.top - PICKER_H - 8 : rect.bottom + 8;
        }

        // Center the picker horizontally relative to the target element
        if (fromX === undefined) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            // Try to align center of picker with center of the action button
            x = rect.left + (rect.width / 2) - (PICKER_W / 2);
        }

        // Clamp to viewport
        if (x + PICKER_W > vw - 16) x = vw - PICKER_W - 16;
        if (x < 16) x = 16;
        if (y + PICKER_H > vh - 16) y = vh - PICKER_H - 16;
        if (y < 16) y = 16;

        setEmojiPickerPos({ x, y });
        setEmojiPickerFor(msgId);
    };

    const handleReaction = useCallback((messageId: string, emoji: string) => {
        if (!activeChat || !user) return;
        const msg = chatMessages.find(m => m.id === messageId);
        const hasReacted = msg?.reactions?.some(r => r.emoji === emoji && r.userId === user.id);
        socketService.sendReaction(activeChat.id, messageId, emoji, hasReacted ? 'remove' : 'add');
        setEmojiPickerFor(null);
        setEmojiPickerPos(null);
    }, [activeChat, user, chatMessages]);

    const getReactionGroups = (reactions: Message['reactions']) => {
        const groups: Record<string, number> = {};
        (reactions || []).forEach(r => {
            groups[r.emoji] = (groups[r.emoji] || 0) + 1;
        });
        return Object.entries(groups);
    };

    const formatRecordingTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // Reply helper
    const getReplyMessage = (replyId: string) => chatMessages.find(m => m.id === replyId);

    // Auto-delete inactive chats logic
    useEffect(() => {
        const checkInterval = setInterval(() => {
            const timers = useStore.getState().autoDeleteTimers;
            const chatsList = useStore.getState().chats;
            const now = Date.now();

            chatsList.forEach(chat => {
                const timerSeconds = timers[chat.id];
                if (timerSeconds && timerSeconds > 0) {
                    const lastMsgTime = chat.lastMessage?.timestamp 
                        ? new Date(chat.lastMessage.timestamp).getTime() 
                        : (chat.createdAt ? new Date(chat.createdAt).getTime() : now);
                    
                    const inactivityMs = now - lastMsgTime;
                    if (inactivityMs > timerSeconds * 1000) {
                        console.log(`Auto-deleting chat ${chat.id} due to inactivity`);
                        socketService.deleteChat(chat.id);
                        if (useStore.getState().activeChat?.id === chat.id) {
                            useStore.getState().setActiveChat(null);
                        }
                    }
                }
            });
        }, 30000); // Check every 30 seconds

        return () => clearInterval(checkInterval);
    }, []);

    if (!activeChat) {
        return (
            <div className="main-chat" style={{ alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <div className="chat-header mobile-only" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
                    <button className="btn btn-ghost" onClick={toggleSidebar} style={{ padding: '8px', display: 'flex' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', overflow: 'hidden', borderRadius: '4px', flexShrink: 0 }}>
                            <img src="/logo.png" className="logo-icon" alt="Nyx Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.4)', clipPath: 'inset(15% round 10px)' }} />
                        </div>
                        <div className="logo-text" style={{ fontSize: '1.2rem' }}>Nyx</div>
                    </div>
                </div>
                
                <div className="empty-state-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', background: 'transparent', boxShadow: 'none', border: 'none' }}>
                    <div className="secure-lock-icon" style={{ width: '120px', height: '120px', marginBottom: 0 }}>
                        <img src="/logo.png" alt="Nyx" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '32px', filter: 'drop-shadow(0 0 24px rgba(124, 92, 252, 0.4))' }} />
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.6) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Nyx Messenger
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', maxWidth: '300px', margin: '0 auto', lineHeight: 1.6 }}>
                            Выбирайте чат слева или создайте новый, чтобы начать общение.
                        </p>
                    </div>

                    <button 
                        onClick={() => (document.querySelector('.add-contact-btn') as HTMLButtonElement)?.click()}
                        style={{ 
                            background: 'var(--bg-active)', border: '1px solid var(--border-active)', 
                            color: 'var(--primary-light)', padding: '12px 24px', borderRadius: 'var(--radius-full)',
                            fontSize: '15px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease',
                            display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-active-deep)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-active)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                        Написать сообщение
                    </button>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '20px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        End-to-End Encryption
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div
                className="main-chat"
                onClick={() => { setContextMenu(null); setEmojiPickerFor(null); setEmojiPickerPos(null); setShowStickers(false); }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Drag & Drop overlay */}
                {isDragOver && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(108, 92, 231, 0.15)',
                        border: '2px dashed #6c5ce7',
                        borderRadius: '12px',
                        zIndex: 100,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(4px)',
                        pointerEvents: 'none'
                    }}>
                        <div style={{ textAlign: 'center', color: '#a29bfe' }}>
                            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📎</div>
                            <div style={{ fontSize: '18px', fontWeight: 700 }}>{T[lang].chat.drop_file}</div>
                        </div>
                    </div>
                )}
                {/* Header */}
                <div className="chat-header">
                    {/* ← Back button — always visible, returns to chat list */}
                    <button
                        className="btn btn-ghost back-btn"
                        title="Назад"
                        onClick={() => setActiveChat(null)}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '36px', height: '36px', borderRadius: '50%',
                            flexShrink: 0
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>
                    <button className="btn btn-ghost mobile-only" onClick={toggleSidebar} style={{ padding: '8px' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </button>
                    {(() => {
                        const isSelfChat = activeChat.type === 'private' && activeChat.participants.length === 1 && activeChat.participants[0] === user?.id;
                        return (
                            <>
                                <div className="avatar" style={{ 
                                    width: '44px', height: '44px', overflow: 'hidden', 
                                    padding: activeChat.avatar && !isSelfChat ? 0 : undefined, 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                    ...(isSelfChat ? { background: 'linear-gradient(135deg, #6c5ce7, #5c4ce7)' } : {})
                                }}>
                                    {isSelfChat ? (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ color: '#fff' }}>
                                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                        </svg>
                                    ) : activeChat.avatar ? (
                                        <img src={activeChat.avatar} alt={activeChat.name || 'Chat'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        activeChat.name?.[0]?.toUpperCase() || '?'
                                    )}
                                </div>
                                <div className="chat-header-info">
                                    <div className="chat-header-name">{isSelfChat ? 'Избранное' : (activeChat.name || T[lang].sidebar.unknown)}</div>
                                    <div className={`chat-header-status ${isContactOnline ? 'online' : ''}`}>
                                        {isSelfChat ? (
                                            <span style={{ color: 'var(--text-secondary)' }}>Заметки</span>
                                        ) : isTyping ? (
                                            <span className="typing-text">{T[lang].status.typing}<span className="typing-dots"><span>.</span><span>.</span><span>.</span></span></span>
                                        ) : isContactOnline ? (
                                            <span><span className="online-dot"></span> {T[lang].status.online}</span>
                                        ) : (() => {
                                            const lastSeenDate = contactUserId ? getLastSeen(contactUserId) : null;
                                            if (!lastSeenDate) return T[lang].status.offline;
                                            const diffMs = Date.now() - lastSeenDate.getTime();
                                            const diffMin = Math.floor(diffMs / 60000);
                                            const diffHour = Math.floor(diffMin / 60);
                                            const diffDay = Math.floor(diffHour / 24);
                                            if (diffMin < 1) return <span style={{ color: 'var(--text-secondary)' }}>был(а) только что</span>;
                                            if (diffMin < 60) return <span style={{ color: 'var(--text-secondary)' }}>был(а) {diffMin} мин. назад</span>;
                                            if (diffHour < 24) return <span style={{ color: 'var(--text-secondary)' }}>был(а) {diffHour} ч. назад</span>;
                                            return <span style={{ color: 'var(--text-secondary)' }}>был(а) {diffDay} дн. назад</span>;
                                        })()}
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                        <button
                            className={`btn btn-ghost ${searchMode ? 'active' : ''}`}
                            title="Поиск"
                            onClick={(e) => { e.stopPropagation(); setSearchMode(s => !s); setSearchQuery(''); }}
                            style={{ fontSize: '16px' }}
                        >
                            🔍
                        </button>
                        <div
                            className="encryption-badge"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setShowEncryptionModal(true)}
                        >
                            🔐 E2E
                        </div>
                        <div style={{ position: 'relative' }}>
                            <button
                                className={`btn btn-ghost ${autoDeleteTimers[activeChat.id] ? 'active' : ''}`}
                                title="Таймер авто-удаления"
                                onClick={(e) => { e.stopPropagation(); setShowAutoDeleteMenu(!showAutoDeleteMenu); }}
                                style={{ fontSize: '16px', position: 'relative' }}
                            >
                                ⏱️
                                {autoDeleteTimers[activeChat.id] && (
                                    <span style={{ position: 'absolute', top: '2px', right: '2px', width: '6px', height: '6px', background: 'var(--accent-primary)', borderRadius: '50%' }} />
                                )}
                            </button>
                            {showAutoDeleteMenu && (
                                <div style={{
                                    position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                                    background: 'var(--glass-bg)', backdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
                                    padding: '8px', zIndex: 1000, width: '180px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                                }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '4px 8px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '4px' }}>
                                        Авто-удаление чата через:
                                    </div>
                                    {[
                                        { label: '🔥 Выключено', val: 0 },
                                        { label: '⏳ 1 час', val: 3600 },
                                        { label: '⏳ 24 часа', val: 86400 },
                                        { label: '⏳ 7 дней', val: 604800 },
                                    ].map(opt => (
                                        <button
                                            key={opt.val}
                                            onClick={() => { setChatAutoDelete(activeChat.id, opt.val); setShowAutoDeleteMenu(false); }}
                                            style={{
                                                width: '100%', padding: '10px 12px', background: autoDeleteTimers[activeChat.id] === opt.val ? 'rgba(255,255,255,0.05)' : 'none',
                                                border: 'none', borderRadius: '8px', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer', fontSize: '13px',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                            }}
                                        >
                                            {opt.label}
                                            {autoDeleteTimers[activeChat.id] === opt.val && <span style={{ color: 'var(--accent-primary)' }}>✓</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Pinned Messages — Telegram style */}
                {activeChat && pinnedMessages[activeChat.id]?.length > 0 && (
                    <div className="pinned-messages-bar">
                        {/* Left accent line */}
                        <div className="pinned-accent-line" />

                        <div className="pinned-icon-wrap">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--primary)' }}>
                                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                            </svg>
                        </div>

                        <div className="pinned-carousel">
                            {pinnedMessages[activeChat.id].map((m, idx) => {
                                const senderName = m.senderId === user?.id ? T[lang].chat.you : (activeChat.name || T[lang].sidebar.unknown);
                                const preview = m.type === 'image' ? T[lang].chat.msg_image
                                    : m.type === 'audio' ? T[lang].chat.msg_audio
                                        : m.type === 'video' ? T[lang].chat.msg_video
                                            : m.type === 'file' ? T[lang].chat.msg_file
                                                : m.type === 'sticker' ? T[lang].chat.msg_sticker
                                                    : m.content.slice(0, 60) + (m.content.length > 60 ? '…' : '');
                                return (
                                    <div key={m.id} className="pinned-item-mini" onClick={() => {
                                        const el = document.getElementById(`msg-${m.id}`);
                                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }}>
                                        <div className="pinned-label">{T[lang].chat.pinned} {idx > 0 ? `#${idx + 1}` : ''}</div>
                                        <div className="pinned-sender">{senderName}</div>
                                        <div className="pinned-content">{preview}</div>
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            className="unpin-btn"
                            title="Открепить"
                            onClick={(e) => {
                                e.stopPropagation();
                                const msgs = pinnedMessages[activeChat.id];
                                if (msgs?.length) unpinMessage(activeChat.id, msgs[msgs.length - 1].id);
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Search bar */}
                {searchMode && (
                    <div className="search-bar-inline">
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="search-input"
                            placeholder={T[lang].chat.search_inline}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onClick={e => e.stopPropagation()}
                        />
                        {searchQuery && (
                            <span className="search-count">
                                {displayMessages.length} {T[lang].chat.search_results}
                            </span>
                        )}
                        <button className="btn btn-ghost" onClick={() => { setSearchMode(false); setSearchQuery(''); }}>✕</button>
                    </div>
                )}

                {/* Messages */}
                <div className="messages-container">
                    {displayMessages.length === 0 ? (
                        <div className="empty-state">
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                                {searchMode ? '🔍' : '👋'}
                            </div>
                            <div style={{ color: 'var(--text-secondary)' }}>
                                {searchMode ? T[lang].chat.search_not_found : T[lang].chat.start_secure}
                            </div>
                        </div>
                    ) : (
                        displayMessages.map((msg, msgIndex) => {
                            const isOwn = msg.senderId === user?.id;
                            const reactionGroups = getReactionGroups(msg.reactions);
                            const repliedMsg = msg.replyTo ? getReplyMessage(msg.replyTo) : null;
                            const showSeparator = shouldShowDateSeparator(displayMessages, msgIndex);

                            return (
                                <React.Fragment key={msg.id}>
                                {/* Date separator */}
                                {showSeparator && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        margin: '12px 16px',
                                        userSelect: 'none'
                                    }}>
                                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                                        <div style={{
                                            fontSize: '11px', fontWeight: 600,
                                            color: 'var(--text-muted)',
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.07)',
                                            padding: '3px 12px',
                                            borderRadius: '12px',
                                            letterSpacing: '0.3px',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {formatDateSeparator(msg.timestamp)}
                                        </div>
                                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                                    </div>
                                )}
                                <div
                                    id={`msg-${msg.id}`}
                                    className={`msg-wrapper ${isOwn ? 'outgoing' : 'incoming'} ${swipeState?.id === msg.id ? 'swiping' : ''}`}
                                >
                                    <div className="swipe-reply-icon" style={{ opacity: swipeState?.id === msg.id ? Math.min(1, Math.abs(swipeState.offset) / 50) : 0, transform: swipeState?.id === msg.id && swipeState.offset < -50 ? 'translateY(-50%) scale(1.2)' : 'translateY(-50%) scale(1)' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg>
                                    </div>
                                    <div
                                        className={`message ${isOwn ? 'outgoing' : 'incoming'} ${msg.type === 'sticker' ? 'sticker-only' : ''} ${searchMode && searchQuery && msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ? 'message-highlight' : ''} ${msg.selfDestruct ? 'self-destruct-msg' : ''} ${burningIds.has(msg.id) ? 'burning' : ''}`}
                                        style={swipeState?.id === msg.id ? { transform: `translateX(${swipeState.offset}px)` } : undefined}
                                        onContextMenu={(e) => handleContextMenu(e, msg)}
                                        onTouchStart={(e) => {
                                            hasScrolledRef.current = false;
                                            const touch = e.touches[0];
                                            touchStartXRef.current = touch.clientX;
                                            touchStartYRef.current = touch.clientY;
                                            touchTimeoutRef.current = setTimeout(() => {
                                                if (hasScrolledRef.current) return;
                                                const MENU_W = 190;
                                                const MENU_H = 170;
                                                const cw = window.innerWidth;
                                                const ch = window.innerHeight;
                                                let x = touch.clientX;
                                                let y = touch.clientY;
                                                if (x + MENU_W > cw) x = cw - MENU_W;
                                                if (y + MENU_H > ch) y = ch - MENU_H;
                                                setContextMenu({ x: Math.max(8, x), y: Math.max(8, y), message: msg });
                                                if (navigator.vibrate) navigator.vibrate(50);
                                            }, 400); // 400ms long press trigger
                                        }}
                                        onTouchMove={(e) => {
                                            hasScrolledRef.current = true;
                                            if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);
                                            
                                            // Swipe to reply logic
                                            if (touchStartXRef.current !== null && touchStartYRef.current !== null) {
                                                const touch = e.touches[0];
                                                const diffX = touch.clientX - touchStartXRef.current;
                                                const diffY = touch.clientY - touchStartYRef.current;
                                                
                                                // Only trigger if horizontal swipe is dominant
                                                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
                                                    // Left swipe for reply
                                                    if (diffX < 0 && Math.abs(diffX) < 100) {
                                                        setSwipeState({ id: msg.id, offset: diffX });
                                                    }
                                                }
                                            }
                                        }}
                                        onTouchEnd={() => {
                                            if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);
                                            if (swipeState?.id === msg.id && swipeState.offset < -50) {
                                                setReplyTo(msg);
                                                if (navigator.vibrate) navigator.vibrate(50);
                                            }
                                            setSwipeState(null);
                                            touchStartXRef.current = null;
                                            touchStartYRef.current = null;
                                        }}
                                        onTouchCancel={() => {
                                            if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);
                                            setSwipeState(null);
                                            touchStartXRef.current = null;
                                            touchStartYRef.current = null;
                                        }}
                                        onDoubleClick={() => {
                                            if (isOwn && msg.type === 'text') {
                                                setEditingMessage({ id: msg.id, content: msg.content });
                                            }
                                        }}
                                    >
                                        {/* Self-destruct countdown badge */}
                                        {selfDestructCountdowns[msg.id] !== undefined && (
                                            <div style={{
                                                position: 'absolute', top: -10, right: isOwn ? 0 : 'auto', left: isOwn ? 'auto' : 0,
                                                background: 'linear-gradient(135deg, #ff4b2b, #ff7043)',
                                                color: '#fff', fontSize: '10px', fontWeight: 700,
                                                padding: '2px 7px', borderRadius: '10px',
                                                boxShadow: '0 0 8px rgba(255,75,43,0.7)',
                                                zIndex: 2, letterSpacing: '0.3px',
                                                animation: selfDestructCountdowns[msg.id] <= 2 ? 'pulse 0.5s ease infinite' : undefined
                                            }}>
                                                🔥 {selfDestructCountdowns[msg.id]}s
                                            </div>
                                        )}
                                        {msg.replyTo && (repliedMsg || msg.replyContent) && (
                                            <div className="reply-preview">
                                                <div className="reply-preview-sender">
                                                    {msg.replySender || (repliedMsg?.senderId === user?.id ? T[lang].chat.you : activeChat.name)}
                                                </div>
                                                <div className="reply-preview-text">
                                                    {repliedMsg?.type === 'image' ? T[lang].chat.msg_image
                                                        : repliedMsg?.type === 'audio' ? T[lang].chat.msg_audio
                                                            : repliedMsg?.type === 'video' ? T[lang].chat.msg_video
                                                                : repliedMsg?.type === 'file' ? T[lang].chat.msg_file
                                                                    : repliedMsg?.type === 'sticker' ? T[lang].chat.msg_sticker
                                                                        : repliedMsg?.content || msg.replyContent || ''}
                                                </div>
                                            </div>
                                        )}

                                        {/* Message author (incoming) */}
                                        {!isOwn && (
                                            <div className="message-author">{activeChat.name}</div>
                                        )}

                                        {/* Image */}
                                        {msg.type === 'image' && msg.fileUrl && (
                                            <img
                                                src={msg.fileUrl}
                                                alt="Sent"
                                                className="message-image"
                                                style={{ maxWidth: '100%', borderRadius: '10px', marginBottom: '4px', cursor: 'zoom-in' }}
                                                onClick={(e) => { e.stopPropagation(); setLightboxImage(msg.fileUrl!); }}
                                            />
                                        )}

                                        {/* Video */}
                                        {msg.type === 'video' && msg.fileUrl && (
                                            <video
                                                src={msg.fileUrl}
                                                controls
                                                className="message-video"
                                                style={{ maxWidth: '100%', borderRadius: '10px', marginBottom: '4px' }}
                                            />
                                        )}

                                        {/* Audio */}
                                        {msg.type === 'audio' && msg.fileUrl && (
                                            <AudioPlayer src={msg.fileUrl} isOwn={isOwn} />
                                        )}

                                        {/* File */}
                                        {msg.type === 'file' && msg.fileUrl && (
                                            <div className="file-message">
                                                <span>📎</span>
                                                <a href={msg.fileUrl} download className="file-link">
                                                    {msg.content.replace('[Файл: ', '').replace(']', '')}
                                                </a>
                                            </div>
                                        )}

                                        {/* Text with Previews */}
                                        {msg.type === 'text' && (
                                            <div className="message-text">
                                                {/* Inline edit mode */}
                                                {editingMessage?.id === msg.id ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px' }}>
                                                        <textarea
                                                            value={editingMessage.content}
                                                            onChange={e => setEditingMessage({ ...editingMessage, content: e.target.value })}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSubmit(); }
                                                                if (e.key === 'Escape') setEditingMessage(null);
                                                            }}
                                                            autoFocus
                                                            style={{
                                                                background: 'rgba(255,255,255,0.1)',
                                                                border: '1px solid rgba(108,92,231,0.6)',
                                                                borderRadius: '8px',
                                                                color: '#fff',
                                                                padding: '6px 8px',
                                                                fontSize: '14px',
                                                                resize: 'none',
                                                                outline: 'none',
                                                                width: '100%',
                                                                minHeight: '40px'
                                                            }}
                                                            rows={1}
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                            <button onClick={() => setEditingMessage(null)} style={{ padding: '3px 10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: '#aaa', cursor: 'pointer', fontSize: '12px' }}>Отмена</button>
                                                            <button onClick={handleEditSubmit} style={{ padding: '3px 10px', background: '#6c5ce7', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Сохранить</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>{msg.content}
                                                        {/* YouTube Preview */}
                                                        {getYoutubeId(msg.content) && (
                                                            <div className="link-preview youtube">
                                                                <iframe
                                                                    width="100%" height="180"
                                                                    src={`https://www.youtube.com/embed/${getYoutubeId(msg.content)}`}
                                                                    frameBorder="0" allowFullScreen style={{ borderRadius: '8px', marginTop: '8px' }}
                                                                ></iframe>
                                                            </div>
                                                        )}
                                                        {/* Link Image Preview */}
                                                        {!getYoutubeId(msg.content) && msg.content.match(/https?:\/\/\S+/g)?.map(url => isImageUrl(url) && (
                                                            <img key={url} src={url} alt="Link Preview" style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '8px' }} />
                                                        ))}
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Sticker */}
                                        {msg.type === 'sticker' && (
                                            <div className="message-sticker">{msg.content}</div>
                                        )}

                                        {/* Time + status */}
                                        <div className="message-time">
                                            {msg.edited && (
                                                <span style={{
                                                    fontSize: '10px',
                                                    opacity: 0.55,
                                                    marginRight: '5px',
                                                    fontStyle: 'italic',
                                                    letterSpacing: '0.2px'
                                                }}>изм.</span>
                                            )}
                                            {formatTime(msg.timestamp)}
                                            {isOwn && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '4px', verticalAlign: 'middle' }}>
                                                    <MessageStatusIcon status={msg.status} />
                                                </span>
                                            )}
                                        </div>

                                        {/* Hover actions */}
                                        <div className="message-actions">
                                            <button className="msg-action-btn" onClick={(e) => { e.stopPropagation(); openEmojiPicker(e, msg.id); }} title="Реакция">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                                                </svg>
                                            </button>
                                            <button className="msg-action-btn" title="Ответить" onClick={(e) => { e.stopPropagation(); setReplyTo(msg); setContextMenu(null); }}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="9 14 4 9 9 4"></polyline>
                                                    <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                                                </svg>
                                            </button>
                                            <button className="msg-action-btn danger" title="Удалить" onClick={(e) => { e.stopPropagation(); socketService.deleteMessage(activeChat.id, msg.id, user!.id); }}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>{/* end .message */}

                                    {/* Reactions OUTSIDE bubble — Telegram style */}
                                    {reactionGroups.length > 0 && (
                                        <div className="message-reactions">
                                            {reactionGroups.map(([emoji, count]) => {
                                                const isMine = msg.reactions?.some(r => r.emoji === emoji && r.userId === user?.id);
                                                return (
                                                    <button
                                                        key={emoji}
                                                        className={`reaction-chip ${isMine ? 'mine' : ''}`}
                                                        onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, emoji); }}
                                                        title={isMine ? '\u0423\u0431\u0440\u0430\u0442\u044c \u0440\u0435\u0430\u043a\u0446\u0438\u044e' : '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0440\u0435\u0430\u043a\u0446\u0438\u044e'}
                                                    >
                                                        {emoji}{count > 1 && <span className="reaction-count">{count}</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                </React.Fragment>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Context menu */}
                {contextMenu && (
                    <div
                        className="context-menu"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button className="context-menu-item" onClick={() => { setReplyTo(contextMenu.message); setContextMenu(null); }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>
                            Ответить
                        </button>
                        {contextMenu.message.senderId === user?.id && contextMenu.message.type === 'text' && (
                            <button className="context-menu-item" onClick={() => {
                                setEditingMessage({ id: contextMenu.message.id, content: contextMenu.message.content });
                                setContextMenu(null);
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                Редактировать
                            </button>
                        )}
                        <button className="context-menu-item" onClick={() => { setForwardMessage(contextMenu.message); setContextMenu(null); }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 14 20 9 15 4"></polyline><path d="M4 20v-7a4 4 0 0 1 4-4h12"></path></svg>
                            Переслать
                        </button>
                        <button className="context-menu-item" onClick={() => {
                            const cx = contextMenu.x;
                            const cy = contextMenu.y;
                            const msgId = contextMenu.message.id;
                            setContextMenu(null);
                            const PICKER_W = 220; const PICKER_H = 56;
                            const vw = window.innerWidth; const vh = window.innerHeight;
                            let x = cx; let y = cy - PICKER_H - 8;
                            if (x + PICKER_W > vw) x = vw - PICKER_W - 8;
                            if (x < 8) x = 8;
                            if (y < 8) y = cy + 8;
                            if (y + PICKER_H > vh) y = vh - PICKER_H - 8;
                            setEmojiPickerPos({ x, y });
                            setEmojiPickerFor(msgId);
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                <line x1="15" y1="9" x2="15.01" y2="9"></line>
                            </svg>
                            Реакция
                        </button>
                        <button className="context-menu-item" onClick={() => { navigator.clipboard.writeText(contextMenu.message.content); setContextMenu(null); }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            Копировать
                        </button>
                        <button className="context-menu-item" onClick={() => { pinMessage(activeChat.id, contextMenu.message); setContextMenu(null); }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                            </svg>
                            {T[lang].chat.pin}
                        </button>
                        <button className="context-menu-item danger" onClick={() => { socketService.deleteMessage(activeChat.id, contextMenu.message.id, user!.id); setContextMenu(null); }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                            Удалить
                        </button>
                    </div>
                )}

                {/* Mobile Bottom Sheet context menu */}
                {bottomSheet && (
                    <>
                        {/* Backdrop */}
                        <div
                            onClick={() => setBottomSheet(null)}
                            style={{
                                position: 'fixed', inset: 0,
                                background: 'rgba(0,0,0,0.5)',
                                backdropFilter: 'blur(4px)',
                                zIndex: 9998,
                                animation: 'fadeIn 0.15s ease'
                            }}
                        />
                        {/* Sheet */}
                        <div
                            onClick={e => e.stopPropagation()}
                            style={{
                                position: 'fixed', bottom: 0, left: 0, right: 0,
                                background: 'var(--glass-bg)',
                                backdropFilter: 'blur(24px)',
                                borderTop: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '24px 24px 0 0',
                                zIndex: 9999,
                                padding: '12px 0 calc(env(safe-area-inset-bottom) + 8px)',
                                boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
                                animation: 'slideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1)'
                            }}
                        >
                            {/* Handle */}
                            <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, margin: '0 auto 16px' }} />

                            {/* Message preview */}
                            <div style={{ padding: '0 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '4px' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Сообщение</div>
                                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {bottomSheet.message.type === 'image' ? '📷 Фото'
                                        : bottomSheet.message.type === 'audio' ? '🎵 Голосовое'
                                        : bottomSheet.message.type === 'video' ? '🎬 Видео'
                                        : bottomSheet.message.type === 'file' ? '📎 Файл'
                                        : bottomSheet.message.content.slice(0, 60)}
                                </div>
                            </div>

                            {/* Actions */}
                            {[
                                { icon: '↩️', label: 'Ответить', action: () => { setReplyTo(bottomSheet.message); setBottomSheet(null); } },
                                ...(bottomSheet.message.senderId === user?.id && bottomSheet.message.type === 'text'
                                    ? [{ icon: '✏️', label: 'Редактировать', action: () => { setEditingMessage({ id: bottomSheet.message.id, content: bottomSheet.message.content }); setBottomSheet(null); } }]
                                    : []),
                                { icon: '➡️', label: 'Переслать', action: () => { setForwardMessage(bottomSheet.message); setBottomSheet(null); } },
                                { icon: '😊', label: 'Реакция', action: () => { const m = bottomSheet.message; setBottomSheet(null); setTimeout(() => { const el = document.getElementById(`msg-${m.id}`); if (el) { const rect = el.getBoundingClientRect(); setEmojiPickerPos({ x: Math.min(rect.left, window.innerWidth - 240), y: Math.max(8, rect.top - 64) }); setEmojiPickerFor(m.id); } }, 50); } },
                                { icon: '📋', label: 'Копировать', action: () => { navigator.clipboard.writeText(bottomSheet.message.content); setBottomSheet(null); } },
                                { icon: '📌', label: T[lang].chat.pin, action: () => { pinMessage(activeChat!.id, bottomSheet.message); setBottomSheet(null); } },
                                { icon: '🗑️', label: 'Удалить', danger: true, action: () => { socketService.deleteMessage(activeChat!.id, bottomSheet.message.id, user!.id); setBottomSheet(null); } },
                            ].map((item: any, idx) => (
                                <button
                                    key={idx}
                                    onClick={item.action}
                                    style={{
                                        width: '100%', padding: '14px 20px',
                                        background: 'none', border: 'none',
                                        color: item.danger ? '#ff4757' : 'var(--text-primary)',
                                        cursor: 'pointer', display: 'flex',
                                        alignItems: 'center', gap: '14px',
                                        fontSize: '15px', fontWeight: 500,
                                        transition: 'background 0.15s',
                                        textAlign: 'left'
                                    }}
                                    onTouchStart={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                                    onTouchEnd={e => (e.currentTarget.style.background = 'none')}
                                >
                                    <span style={{ fontSize: '20px', width: 28, textAlign: 'center' }}>{item.icon}</span>
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {/* Input area */}
                <div className="message-input-container" style={{ flexDirection: 'column', alignItems: 'stretch', position: 'relative' }}>

                    {/* Self-destruct mode indicator */}
                    {isSelfDestruct && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '6px 16px',
                            background: 'linear-gradient(90deg, rgba(255,75,43,0.12), rgba(255,165,0,0.08))',
                            borderTop: '1px solid rgba(255,75,43,0.25)',
                            fontSize: '12px', color: '#ff6b4a', fontWeight: 600,
                            letterSpacing: '0.3px'
                        }}>
                            <span style={{ fontSize: '14px' }}>🔥</span>
                            Одноразовое сообщение — исчезнет после прочтения
                            <button
                                onClick={() => setIsSelfDestruct(false)}
                                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ff6b4a', cursor: 'pointer', fontSize: '14px', opacity: 0.7 }}
                            >✕</button>
                        </div>
                    )}
                    {replyTo && (
                        <div className="reply-bar">
                            <div className="reply-bar-content">
                                <div className="reply-bar-title">↩️ Ответ для {replyTo.senderId === user?.id ? 'себя' : activeChat.name}</div>
                                <div className="reply-bar-text">
                                    {replyTo.type === 'image' ? '📷 Изображение' : replyTo.type === 'video' ? '🎬 Видео' : replyTo.type === 'audio' ? '🎵 Голосовое' : replyTo.type === 'file' ? '📎 Файл' : replyTo.type === 'sticker' ? '✨ Стикер' : replyTo.content}
                                </div>
                            </div>
                            <button className="btn btn-ghost" onClick={() => setReplyTo(null)} style={{ fontSize: '16px' }}>✕</button>
                        </div>
                    )}
                    {imagePreview && (
                        <div className="image-preview" style={{ position: 'relative', marginBottom: '8px', alignSelf: 'flex-start' }}>
                            <img src={imagePreview} alt="Preview" style={{ height: '80px', borderRadius: '10px', objectFit: 'cover' }} />
                            <button className="btn btn-icon" style={{ position: 'absolute', top: '-8px', right: '-8px', width: '24px', height: '24px', fontSize: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} onClick={() => setImagePreview(null)}>✕</button>
                        </div>
                    )}
                    {isRecording && (
                        <div className="recording-bar">
                            {/* Pulsing dot */}
                            <span className="recording-dot" />

                            {/* Animated live waveform */}
                            <div className="recording-wave">
                                {Array.from({ length: 28 }).map((_, i) => (
                                    <span key={i} style={{ height: `${6 + Math.round(Math.random() * 20)}px` }} />
                                ))}
                            </div>

                            {/* Timer */}
                            <span className="recording-timer">{formatRecordingTime(recordingTime)}</span>

                            {/* Cancel (stop) */}
                            <button className="rec-btn rec-btn-stop" onClick={() => stopRecording(false)} title="Отменить запись">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="4" y="4" width="16" height="16" rx="3" />
                                </svg>
                            </button>

                            {/* Send */}
                            <button className="rec-btn rec-btn-send" onClick={() => stopRecording(true)} title="Отправить">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13" />
                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                            </button>
                        </div>
                    )}

                    <div className="input-row">
                        <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
                        <input type="file" ref={fileAnyRef} style={{ display: 'none' }} onChange={handleFileUpload} />

                        {/* Attach */}
                        <button className="input-action-btn" title="Прикрепить файл" onClick={() => fileAnyRef.current?.click()}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                        </button>

                        {/* Message textarea */}
                        <textarea
                            className="message-input"
                            placeholder={isSelfDestruct ? `🔥 ${T[lang].chat.self_destruct}...` : replyTo ? `${T[lang].chat.reply} ${replyTo.senderId === user?.id ? T[lang].chat.you : activeChat.name}...` : T[lang].chat.type_message}
                            value={inputValue}
                            onChange={handleInputChange}
                            onKeyPress={handleKeyPress}
                            rows={1}
                            style={{ display: isRecording ? 'none' : undefined }}
                        />

                        {/* 🔥 Self-destruct toggle */}
                        <button
                            className={`input-action-btn sd-toggle ${isSelfDestruct ? 'active' : ''}`}
                            title="Одноразовое сообщение"
                            onClick={() => setIsSelfDestruct(!isSelfDestruct)}
                            style={{
                                display: isRecording ? 'none' : 'flex', fontSize: '18px',
                                color: isSelfDestruct ? '#ff4b2b' : 'var(--text-muted)',
                                filter: isSelfDestruct ? 'drop-shadow(0 0 6px rgba(255,75,43,0.7))' : 'none',
                                transform: isSelfDestruct ? 'scale(1.15)' : 'scale(1)',
                                transition: 'all 0.2s'
                            }}
                        >
                            🔥
                        </button>

                        {/* Stickers button — picker rendered outside input-row, above panel */}
                        <button
                            className={`input-action-btn ${showStickers ? 'active' : ''}`}
                            title="Стикеры"
                            style={{ display: isRecording ? 'none' : 'flex' }}
                            onClick={(e) => { e.stopPropagation(); setShowStickers(!showStickers); }}
                        >
                            🌟
                        </button>

                        {/* Mic / Send */}
                        <button
                            className="send-btn"
                            onClick={handleSend}
                            disabled={!inputValue.trim() && !imagePreview}
                            style={{ display: inputValue || imagePreview ? 'flex' : 'none' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>

                        <button
                            className="input-action-btn"
                            style={{ display: !inputValue.trim() && !imagePreview ? 'flex' : 'none' }}
                            onClick={startRecording}
                            title="Голосовое сообщение"
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                <line x1="8" y1="23" x2="16" y2="23"></line>
                            </svg>
                        </button>
                    </div>

                    {/* Premium Audio Recording Bar */}
                    {isRecording && (
                        <div className="recording-bar">
                            <div className="recording-dot"></div>
                            <div style={{ marginRight: '12px', fontWeight: 600, fontSize: '14px', minWidth: '40px' }}>
                                {formatRecordingTime(recordingTime)}
                            </div>

                            <div className="recording-wave">
                                <div className="wave-bar" style={{ animation: 'waveBar1 0.8s infinite' }}></div>
                                <div className="wave-bar" style={{ animation: 'waveBar2 0.8s infinite 0.2s' }}></div>
                                <div className="wave-bar" style={{ animation: 'waveBar3 0.8s infinite 0.4s' }}></div>
                                <div className="wave-bar" style={{ animation: 'waveBar1 0.8s infinite 0.1s' }}></div>
                                <div className="wave-bar" style={{ animation: 'waveBar2 0.8s infinite 0.3s' }}></div>
                                <div className="wave-bar" style={{ animation: 'waveBar4 0.8s infinite 0.5s' }}></div>
                                <div className="wave-bar" style={{ animation: 'waveBar3 0.8s infinite 0.2s' }}></div>
                                <div className="wave-bar" style={{ animation: 'waveBar1 0.8s infinite 0.6s' }}></div>
                            </div>

                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                                <button className="rec-btn rec-btn-stop" onClick={() => stopRecording(false)} title="Отмена">
                                    ✕
                                </button>
                                <button className="rec-btn rec-btn-send" onClick={() => stopRecording(true)} title="Отправить">
                                    🚀
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Sticker panel — inside container so position:absolute works */}
                    {showStickers && (
                        <div className="sticker-panel" onClick={e => e.stopPropagation()}>
                            <div className="sticker-panel-header">
                                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-secondary)' }}>Креативные стикеры</span>
                                <button className="input-action-btn" style={{ width: 28, height: 28 }} onClick={() => setShowStickers(false)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                </button>
                            </div>
                            <div className="sticker-grid">
                                {STICKERS.map(s => (
                                    <button key={s} className="sticker-btn" onClick={() => { handleSendSticker(s); setShowStickers(false); }}>{s}</button>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* Sticker panel placeholder — now inside container above */}

                <EncryptionInfoModal isOpen={showEncryptionModal} onClose={() => setShowEncryptionModal(false)} />
            </div>

            {/* Fixed emoji picker */}
            {emojiPickerFor && emojiPickerPos && (
                <div
                    className="emoji-picker-float"
                    style={{
                        top: emojiPickerPos!.y,
                        left: emojiPickerPos!.x,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(6, 1fr)',
                        gap: '2px',
                        padding: '8px',
                        borderRadius: '14px',
                        minWidth: '220px',
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {EMOJI_LIST.map(emoji => (
                        <button key={emoji} className="emoji-btn" onClick={() => handleReaction(emojiPickerFor!, emoji)}>{emoji}</button>
                    ))}
                </div>
            )}

            {/* Lightbox Portal */}
            {lightboxImage && ReactDOM.createPortal(
                <div
                    onClick={() => setLightboxImage(null)}
                    style={{
                        position: 'fixed', top: 0, left: 0,
                        width: '100vw', height: '100vh',
                        background: 'rgba(0,0,0,0.92)',
                        backdropFilter: 'blur(12px)',
                        zIndex: 999999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'fadeIn 0.2s ease',
                        cursor: 'zoom-out'
                    }}
                >
                    {/* Close button */}
                    <button
                        onClick={() => setLightboxImage(null)}
                        style={{
                            position: 'absolute', top: 20, right: 20,
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#fff', width: 44, height: 44,
                            borderRadius: '50%', cursor: 'pointer',
                            fontSize: '20px', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.2s',
                            zIndex: 1
                        }}
                        title="Закрыть"
                    >✕</button>

                    {/* Download button */}
                    <a
                        href={lightboxImage}
                        download
                        onClick={e => e.stopPropagation()}
                        style={{
                            position: 'absolute', top: 20, right: 72,
                            background: 'rgba(108,92,231,0.3)',
                            border: '1px solid rgba(108,92,231,0.5)',
                            color: '#fff', width: 44, height: 44,
                            borderRadius: '50%', cursor: 'pointer',
                            fontSize: '18px', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            textDecoration: 'none',
                            transition: 'background 0.2s'
                        }}
                        title="Скачать"
                    >⬇</a>

                    <img
                        src={lightboxImage}
                        alt="Fullscreen"
                        onClick={e => e.stopPropagation()}
                        style={{
                            maxWidth: '90vw',
                            maxHeight: '88vh',
                            borderRadius: '12px',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                            animation: 'slideUp 0.25s ease',
                            objectFit: 'contain',
                            cursor: 'default'
                        }}
                    />
                </div>,
                document.body
            )}

            {/* Forward Modal Portal */}
            {forwardMessage && ReactDOM.createPortal(
                <div onClick={() => setForwardMessage(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 999998, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: 'var(--glass-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', width: '380px', maxWidth: '95vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', animation: 'slideUp 0.25s ease', overflow: 'hidden' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>➡️ Переслать в</h3>
                            <button onClick={() => setForwardMessage(null)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                        </div>
                        <div style={{ overflowY: 'auto', padding: '12px' }}>
                            {chats.filter(c => c.id !== activeChat?.id).map(chat => (
                                <button key={chat.id} onClick={() => {
                                    if (!user) return;
                                    const fwdContent = forwardMessage.type === 'image' ? '➡️ Фото' : forwardMessage.type === 'audio' ? '➡️ 🎤 Голосовое' : forwardMessage.type === 'video' ? '➡️ 🎬 Видео' : forwardMessage.type === 'file' ? '➡️ 📎 Файл' : `➡️ ${forwardMessage.content}`;
                                    socketService.sendMessage(chat.id, user.id, fwdContent, 'text', forwardMessage.type === 'image' ? forwardMessage.fileUrl : undefined);
                                    setForwardMessage(null);
                                }} style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px', transition: 'background 0.2s', textAlign: 'left' }}>
                                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
                                        {chat.avatar ? <img src={chat.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : (chat.name ?? '?')[0]?.toUpperCase()}
                                    </div>
                                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{chat.name}</div>
                                </button>
                            ))}
                            {chats.filter(c => c.id !== activeChat?.id).length === 0 && (
                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '14px' }}>💬 Нет других чатов</div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
