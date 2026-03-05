import React, { useState, useRef, useEffect, useCallback } from 'react';
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
        activeChat, user, messages, setMessages, markMessagesAsRead, onlineUsers,
        pinMessage, unpinMessage, pinnedMessages, lang, deleteMessageLocal, toggleSidebar,
        stealthMode
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
        const socket = socketService.getSocket();
        if (!socket) return;

        const handleSelfDestruct = (data: { messageId: string, delay: number }) => {
            setTimeout(() => {
                deleteMessageLocal(data.messageId);
            }, data.delay);
        };

        socket.on('message:burn', handleSelfDestruct);
        return () => {
            socket.off('message:burn', handleSelfDestruct);
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
            const mediaRecorder = new MediaRecorder(stream);
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
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
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

        // Clamp to viewport
        if (x + PICKER_W > vw) x = vw - PICKER_W - 8;
        if (x < 8) x = 8;
        if (y + PICKER_H > vh) y = vh - PICKER_H - 8;
        if (y < 8) y = 8;

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
                    <button className="btn btn-ghost" onClick={toggleSidebar}>☰</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src="/logo.png" className="logo-icon" alt="Nyx Logo" style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'cover' }} />
                        <div className="logo-text" style={{ fontSize: '1.2rem' }}>Nyx</div>
                    </div>
                </div>
                <div className="empty-state">
                    <div className="empty-state-card">
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

                        <button className="start-chat-btn" onClick={() => (document.querySelector('.create-chat-btn-large') as HTMLButtonElement)?.click()}>
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
            <div className="main-chat" onClick={() => { setContextMenu(null); setEmojiPickerFor(null); setEmojiPickerPos(null); setShowStickers(false); }}>
                {/* Header */}
                <div className="chat-header">
                    <button className="btn btn-ghost mobile-only" onClick={toggleSidebar}>☰</button>
                    <div className="avatar" style={{ width: '44px', height: '44px', overflow: 'hidden', padding: activeChat.avatar ? 0 : undefined }}>
                        {activeChat.avatar ? (
                            <img src={activeChat.avatar} alt={activeChat.name || 'Chat'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            activeChat.name?.[0]?.toUpperCase() || '?'
                        )}
                    </div>
                    <div className="chat-header-info">
                        <div className="chat-header-name">{activeChat.name || 'Контакт'}</div>
                        <div className={`chat-header-status ${isContactOnline ? 'online' : ''}`}>
                            {isTyping ? (
                                <span className="typing-text">печатает<span className="typing-dots"><span>.</span><span>.</span><span>.</span></span></span>
                            ) : isContactOnline ? (
                                <span><span className="online-dot"></span> в сети</span>
                            ) : (
                                'не в сети'
                            )}
                        </div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                        <button
                            className={`btn btn-ghost ${searchMode ? 'active' : ''}`}
                            title="Поиск по сообщениям"
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

                {/* Pinned Messages Area */}
                {activeChat && pinnedMessages[activeChat.id]?.length > 0 && (
                    <div className="pinned-messages-bar">
                        <div className="pinned-icon">📌</div>
                        <div className="pinned-carousel">
                            {pinnedMessages[activeChat.id].map((m) => (
                                <div key={m.id} className="pinned-item-mini" onClick={() => {
                                    const element = document.getElementById(`msg-${m.id}`);
                                    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}>
                                    <div className="pinned-content">{m.content.slice(0, 50)}{m.content.length > 50 ? '...' : ''}</div>
                                    <button className="unpin-btn" onClick={(e) => { e.stopPropagation(); unpinMessage(activeChat.id, m.id); }}>✕</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Search bar */}
                {searchMode && (
                    <div className="search-bar-inline">
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="search-input"
                            placeholder="🔍 Поиск по сообщениям..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onClick={e => e.stopPropagation()}
                        />
                        {searchQuery && (
                            <span className="search-count">
                                {displayMessages.length} результатов
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
                                {searchMode ? 'Ничего не найдено' : 'Начните защищённую переписку'}
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
                                    className={`msg-wrapper ${isOwn ? 'outgoing' : 'incoming'}`}
                                >
                                    <div
                                        className={`message ${isOwn ? 'outgoing' : 'incoming'} ${msg.type === 'sticker' ? 'sticker-only' : ''} ${searchMode && searchQuery && msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ? 'message-highlight' : ''}`}
                                        onContextMenu={(e) => handleContextMenu(e, msg)}
                                    >
                                        {/* Reply preview */}
                                        {msg.replyTo && (repliedMsg || msg.replyContent) && (
                                            <div className="reply-preview">
                                                <div className="reply-preview-sender">
                                                    {msg.replySender || (repliedMsg?.senderId === user?.id ? 'Вы' : activeChat.name)}
                                                </div>
                                                <div className="reply-preview-text">
                                                    {repliedMsg?.type === 'image' ? '📷 Изображение'
                                                        : repliedMsg?.type === 'audio' ? '🎵 Голосовое'
                                                            : repliedMsg?.type === 'video' ? '🎬 Видео'
                                                                : repliedMsg?.type === 'file' ? '📎 Файл'
                                                                    : repliedMsg?.type === 'sticker' ? '✨ Стикер'
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
                                                style={{ maxWidth: '100%', borderRadius: '10px', marginBottom: '4px', cursor: 'pointer' }}
                                                onClick={() => window.open(msg.fileUrl, '_blank')}
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
                                                {msg.content}
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
                                            </div>
                                        )}

                                        {/* Sticker */}
                                        {msg.type === 'sticker' && (
                                            <div className="message-sticker">{msg.content}</div>
                                        )}

                                        {/* Time + status */}
                                        <div className="message-time">
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
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 14 4 9 9 4"></polyline>
                                <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                            </svg>
                            Ответить
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
                <div className="message-input-container" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
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
                            <span className="recording-dot"></span>
                            <span style={{ fontWeight: 600, color: '#ff4444' }}>{formatRecordingTime(recordingTime)}</span>
                            <span style={{ flex: 1, color: 'var(--text-muted)', fontSize: '12px' }}>Идёт запись...</span>
                            <button className="rec-btn rec-btn-stop" onClick={() => stopRecording(false)} title="Отменить">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="3" /></svg>
                            </button>
                            <button className="rec-btn rec-btn-send" onClick={() => stopRecording(true)} title="Отправить">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" /></svg>
                            </button>
                        </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
                        <input type="file" ref={fileAnyRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                        <div className="attach-menu">
                            <button className="btn btn-ghost" title="Прикрепить файл" onClick={() => fileAnyRef.current?.click()}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                            </button>
                        </div>
                        <textarea className="message-input" placeholder={replyTo ? `Ответить ${replyTo.senderId === user?.id ? 'себе' : activeChat.name}...` : 'Введите сообщение...'} value={inputValue} onChange={handleInputChange} onKeyPress={handleKeyPress} rows={1} style={{ display: isRecording ? 'none' : undefined }} />

                        <button
                            className={`btn btn-ghost sd-toggle ${isSelfDestruct ? 'active' : ''}`}
                            title={T[lang].chat.self_destruct}
                            onClick={() => setIsSelfDestruct(!isSelfDestruct)}
                            style={{ display: isRecording ? 'none' : 'inline-flex', color: isSelfDestruct ? '#ff4b2b' : 'inherit' }}
                        >
                            🔥
                        </button>

                        <div style={{ position: 'relative' }}>
                            <button className={`btn btn-ghost ${showStickers ? 'active' : ''}`} title="Стикеры" style={{ display: isRecording ? 'none' : 'inline-flex' }} onClick={(e) => { e.stopPropagation(); setShowStickers(!showStickers); }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline><polyline points="7.5 19.79 7.5 14.6 3 12"></polyline><polyline points="21 12 16.5 14.6 16.5 19.79"></polyline><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                            </button>
                            {showStickers && (
                                <div className="sticker-picker" onClick={e => e.stopPropagation()}>
                                    {STICKERS.map(s => (
                                        <button key={s} className="sticker-btn" onClick={() => handleSendSticker(s)}>{s}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {!isRecording && (
                            <button className="btn btn-ghost" title="Голосовое" onClick={startRecording} style={{ display: inputValue || imagePreview ? 'none' : 'inline-flex' }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                            </button>
                        )}
                        <button className="btn btn-icon send-btn" onClick={handleSend} disabled={!inputValue.trim() && !imagePreview} title="Отправить" style={{ display: inputValue || imagePreview ? 'inline-flex' : 'none' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>
                    </div>
                </div>
                <EncryptionInfoModal isOpen={showEncryptionModal} onClose={() => setShowEncryptionModal(false)} />
            </div>

            {/* Fixed emoji picker */}
            {emojiPickerFor && emojiPickerPos && (
                <div className="emoji-picker-fixed" style={{ top: emojiPickerPos!.y, left: emojiPickerPos!.x }} onClick={e => e.stopPropagation()}>
                    {EMOJI_LIST.map(emoji => (
                        <button key={emoji} className="emoji-btn" onClick={() => handleReaction(emojiPickerFor!, emoji)}>{emoji}</button>
                    ))}
                </div>
            )}
        </>
    );
};
