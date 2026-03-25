import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useStore } from '../../store/useStore';
import { socketService } from '../../socket/socketService';
import { API_BASE_URL } from '../../config';
import { T } from '../../locales';
import { Message } from '../../types';

import AudioPlayer from './AudioPlayer';
import { EncryptionInfoModal } from './EncryptionInfoModal';

const EMOJI_LIST = ['❤️', '👍', '😂', '😮', '😢', '🔥', '💯', '👀'];
const STICKERS = ['😂', '❤️', '🔥', '👍', '💀', '🤡', '😭', '🥺', '🗿', '☕', '🐱', '🐶', '😎', '🎉', '🧠', '🤬', '💩', '👽', '👾', '🤖', '👑', '🤌'];

export const ChatWindow: React.FC = () => {
    const {
        activeChat, user, messages, chats, setMessages, markMessagesAsRead, onlineUsers,
        pinMessage, unpinMessage, pinnedMessages, lang, deleteMessageLocal, toggleSidebar,
        stealthMode, setActiveChat
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
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileAnyRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const shouldSendRef = useRef<boolean>(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const chatMessages = activeChat ? messages[activeChat.id] || [] : [];

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
        const fetchMessages = async () => {
            if (!activeChat) return;
            try {
                const serverUrl = API_BASE_URL.replace(/\/$/, '');
                const response = await fetch(`${serverUrl}/api/chats/${activeChat.id}/messages`);
                const result = await response.json();

                if (result.success) {
                    const formattedMessages = result.data.map((m: any) => ({
                        id: m.id,
                        chatId: m.chatId,
                        senderId: m.senderId,
                        content: m.encryptedContent,
                        type: m.message_type || 'text',
                        fileUrl: m.fileUrl || m.file_url,
                        timestamp: new Date(m.timestamp),
                        status: m.status || (m.senderId !== user?.id ? 'read' : 'delivered'),
                        replyTo: m.replyTo,
                        reactions: m.reactions || [],
                        selfDestruct: m.self_destruct || m.selfDestruct
                    }));
                    setMessages(activeChat.id, formattedMessages);

                    if (formattedMessages.length > 0) {
                        const hasUnreadIncoming = formattedMessages.some((m: any) => m.senderId !== user?.id && m.status !== 'read');
                        if (hasUnreadIncoming && user && !stealthMode) {
                            socketService.getSocket()?.emit('message:read', { chatId: activeChat.id, userId: user.id });
                            markMessagesAsRead(activeChat.id, user.id);
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching messages:', err);
            }
        };

        fetchMessages();
    }, [activeChat?.id]);

    useEffect(() => {
        if (messagesEndRef.current && !searchMode) {
            const container = messagesEndRef.current.parentElement;
            if (container) {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            }
        }

        if (activeChat && user && chatMessages.length > 0) {
            const hasUnreadIncoming = chatMessages.some(m => m.senderId !== user.id && m.status !== 'read');
            if (hasUnreadIncoming && !stealthMode) {
                socketService.getSocket()?.emit('message:read', { chatId: activeChat.id, userId: user.id });
                markMessagesAsRead(activeChat.id, user.id);
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
        return () => document.removeEventListener('click', handleClick);
    }, []);

    // Focus search input
    useEffect(() => {
        if (searchMode) searchInputRef.current?.focus();
    }, [searchMode]);

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
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

    // Self-destruct timer logic
    useEffect(() => {
        if (!activeChat || !user) return;
        const delay = 10000; // 10 seconds
        
        chatMessages.forEach(msg => {
            if (msg.selfDestruct) {
                // If it's my own message OR I have read it, boom trigger
                if (msg.status === 'read' || msg.senderId === user.id) {
                    const elapsed = Date.now() - new Date(msg.timestamp).getTime();
                    if (elapsed < delay) {
                        setTimeout(() => {
                            useStore.getState().deleteMessageLocal(msg.id);
                            socketService.deleteMessage(activeChat.id, msg.id, user.id);
                        }, delay - elapsed);
                    } else {
                        useStore.getState().deleteMessageLocal(msg.id);
                        socketService.deleteMessage(activeChat.id, msg.id, user.id);
                    }
                }
            }
        });
    }, [chatMessages, activeChat, user]);

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
        const MENU_W = 190;
        const MENU_H = 170; // approx: 4 items × ~42px
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

    if (!activeChat) {
        return (
            <div className="main-chat">
                <div className="chat-header mobile-only">
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
                <div className="empty-state">
                    <div className="empty-state-card">
                        {/* Security lock icon — top of card */}
                        <div className="secure-lock-icon">
                            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <linearGradient id="lockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#7c6aff" />
                                        <stop offset="100%" stopColor="#00f3ff" />
                                    </linearGradient>
                                </defs>
                                {/* Shield body */}
                                <path d="M26 4L8 11v12c0 10.5 7.7 20.3 18 23 10.3-2.7 18-12.5 18-23V11L26 4z"
                                    fill="url(#lockGrad)" fillOpacity="0.15"
                                    stroke="url(#lockGrad)" strokeWidth="1.5" />
                                {/* Lock body */}
                                <rect x="18" y="24" width="16" height="12" rx="3"
                                    fill="url(#lockGrad)" fillOpacity="0.5"
                                    stroke="url(#lockGrad)" strokeWidth="1.2" />
                                {/* Lock shackle */}
                                <path d="M20 24v-4a6 6 0 0 1 12 0v4"
                                    stroke="url(#lockGrad)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                                {/* Keyhole */}
                                <circle cx="26" cy="30" r="2" fill="white" fillOpacity="0.8" />
                                <rect x="25" y="30" width="2" height="3" rx="1" fill="white" fillOpacity="0.8" />
                            </svg>
                        </div>

                        <div className="empty-state-title">{T[lang].chat.select_chat}</div>
                        <div className="empty-state-subtitle">{T[lang].chat.or_create_new}</div>

                        <div className="how-it-works-card">
                            <h3>{T[lang].chat.how_it_works}</h3>
                            <ol>
                                <li>{T[lang].chat.step_1}</li>
                                <li>{T[lang].chat.step_2}</li>
                                <li>{T[lang].chat.step_3}</li>
                            </ol>
                        </div>

                        <button className="start-chat-btn" onClick={() => (document.querySelector('.add-contact-btn') as HTMLButtonElement)?.click()}>
                            {T[lang].chat.start_chat}
                        </button>

                        <div className="e2e-badge">
                            🔐 {T[lang].chat.e2e_badge}
                        </div>
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
                    <div className="avatar" style={{ width: '44px', height: '44px', overflow: 'hidden', padding: activeChat.avatar ? 0 : undefined }}>
                        {activeChat.avatar ? (
                            <img src={activeChat.avatar} alt={activeChat.name || 'Chat'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            activeChat.name?.[0]?.toUpperCase() || '?'
                        )}
                    </div>
                    <div className="chat-header-info">
                        <div className="chat-header-name">{activeChat.name || T[lang].sidebar.unknown}</div>
                        <div className={`chat-header-status ${isContactOnline ? 'online' : ''}`}>
                            {isTyping ? (
                                <span className="typing-text">{T[lang].status.typing}<span className="typing-dots"><span>.</span><span>.</span><span>.</span></span></span>
                            ) : isContactOnline ? (
                                <span><span className="online-dot"></span> {T[lang].status.online}</span>
                            ) : (
                                T[lang].status.offline
                            )}
                        </div>
                    </div>
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
                        displayMessages.map((msg) => {
                            const isOwn = msg.senderId === user?.id;
                            const reactionGroups = getReactionGroups(msg.reactions);
                            const repliedMsg = msg.replyTo ? getReplyMessage(msg.replyTo) : null;

                            return (
                                <div
                                    key={msg.id}
                                    id={`msg-${msg.id}`}
                                    className={`msg-wrapper ${isOwn ? 'outgoing' : 'incoming'}`}
                                >
                                    <div
                                        className={`message ${isOwn ? 'outgoing' : 'incoming'} ${msg.type === 'sticker' ? 'sticker-only' : ''} ${searchMode && searchQuery && msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ? 'message-highlight' : ''}`}
                                        onContextMenu={(e) => handleContextMenu(e, msg)}
                                        onDoubleClick={() => {
                                            if (isOwn && msg.type === 'text') {
                                                setEditingMessage({ id: msg.id, content: msg.content });
                                            }
                                        }}
                                    >
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
                                            {(msg as any).edited && <span style={{ fontSize: '10px', opacity: 0.6, marginRight: '4px' }}>✏</span>}
                                            {formatTime(msg.timestamp)}
                                            {isOwn && (
                                                <span className={`read-status ${msg.status === 'read' ? 'read' : ''}`}>
                                                    {msg.status === 'read' ? '✓✓' : '✓'}
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
                        {!isRecording && (
                            <button className="input-action-btn" title="Голосовое" onClick={startRecording}
                                style={{ display: inputValue || imagePreview ? 'none' : 'flex' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                            </button>
                        )}
                        <button className="send-btn" onClick={handleSend}
                            disabled={!inputValue.trim() && !imagePreview} title="Отправить"
                            style={{ display: inputValue || imagePreview ? 'flex' : 'none' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>
                    </div>

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
                <div className="emoji-picker-float" style={{ top: emojiPickerPos!.y, left: emojiPickerPos!.x }} onClick={e => e.stopPropagation()}>
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
