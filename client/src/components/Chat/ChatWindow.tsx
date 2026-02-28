import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { socketService } from '../../socket/socketService';
import { API_BASE_URL } from '../../config';

export const ChatWindow: React.FC = () => {
    const { activeChat, user, messages, setMessages, markMessagesAsRead, toggleSidebar } = useStore();
    const [inputValue, setInputValue] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const chatMessages = activeChat ? messages[activeChat.id] || [] : [];

    useEffect(() => {
        const socket = socketService.getSocket();
        if (!socket) return;

        const handleTyping = (data: { chatId: string, userId: string }) => {
            if (activeChat && data.chatId === activeChat.id && data.userId !== user?.id) {
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
                        fileUrl: m.fileUrl,
                        timestamp: new Date(m.timestamp),
                        status: m.status || (m.senderId !== user?.id ? 'read' : 'delivered')
                    }));
                    setMessages(activeChat.id, formattedMessages);

                    // Mark as read when we open the chat
                    if (formattedMessages.length > 0) {
                        const hasUnreadIncoming = formattedMessages.some((m: any) => m.senderId !== user?.id && m.status !== 'read');
                        if (hasUnreadIncoming && user) {
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
    }, [activeChat?.id, setMessages]);

    useEffect(() => {
        if (messagesEndRef.current) {
            const container = messagesEndRef.current.parentElement;
            if (container) {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            }
        }

        // Mark incoming messages as read automatically if the chat is open
        if (activeChat && user && chatMessages.length > 0) {
            const hasUnreadIncoming = chatMessages.some(m => m.senderId !== user.id && m.status !== 'read');
            if (hasUnreadIncoming) {
                socketService.getSocket()?.emit('message:read', { chatId: activeChat.id, userId: user.id });
                markMessagesAsRead(activeChat.id, user.id);
            }
        }
    }, [chatMessages.length, activeChat, user]);

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleSend = () => {
        if (!activeChat || !user) return;

        if (imagePreview) {
            socketService.sendMessage(activeChat.id, user.id, inputValue.trim() || '[Изображение]', 'image', imagePreview);
            setImagePreview(null);
            setInputValue('');
            return;
        }

        if (!inputValue.trim()) return;
        socketService.sendMessage(activeChat.id, user.id, inputValue.trim(), 'text');
        setInputValue('');
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

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result as string;
                    if (activeChat && user) {
                        socketService.sendMessage(activeChat.id, user.id, '[Голосовое сообщение]', 'audio', base64);
                    }
                };
                reader.readAsDataURL(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error recording:', err);
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        if (activeChat && user) {
            socketService.getSocket()?.emit('message:typing', { chatId: activeChat.id, userId: user.id });
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!activeChat) {
        return (
            <div className="main-chat">
                <div className="chat-header mobile-only">
                    <button className="btn btn-ghost" onClick={toggleSidebar}>
                        ☰
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src="/logo.png" className="logo-icon" alt="Nyx Logo" style={{ width: '24px', height: '24px', borderRadius: '4px', marginRight: '8px', objectFit: 'cover' }} />
                        <div className="logo-text" style={{ fontSize: '1.2rem' }}>Nyx</div>
                    </div>
                </div>
                <div className="empty-state">
                    <div className="empty-state-icon">🔒</div>
                    <div className="empty-state-title">Nyx Messenger</div>
                    <div className="empty-state-text">
                        Выберите чат или добавьте контакт по ID, чтобы начать защищённое общение
                    </div>
                    <div className="encryption-badge" style={{ marginTop: '16px' }}>
                        🔐 Сквозное шифрование
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="main-chat">
            <div className="chat-header">
                <button className="btn btn-ghost mobile-only" onClick={toggleSidebar}>
                    ☰
                </button>
                <div className="avatar" style={{ width: '44px', height: '44px', overflow: 'hidden', padding: activeChat.avatar ? 0 : undefined }}>
                    {activeChat.avatar ? (
                        <img src={activeChat.avatar} alt={activeChat.name || 'Chat'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        activeChat.name?.[0]?.toUpperCase() || '?'
                    )}
                </div>
                <div className="chat-header-info">
                    <div className="chat-header-name">{activeChat.name || 'Контакт'}</div>
                    <div className="chat-header-status online">
                        {isTyping ? 'печатает...' : 'в сети'}
                    </div>
                </div>
                <div className="encryption-badge">
                    🔐 E2E
                </div>
            </div>

            <div className="messages-container">
                {chatMessages.length === 0 ? (
                    <div className="empty-state">
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>👋</div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                            Начните защищённую переписку
                        </div>
                    </div>
                ) : (
                    chatMessages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`message ${msg.senderId === user?.id ? 'outgoing' : 'incoming'}`}
                        >
                            {msg.senderId !== user?.id && activeChat && (
                                <div className="message-author" style={{ fontSize: '13px', fontWeight: 600, color: '#8774e1', marginBottom: '2px' }}>
                                    {activeChat.name}
                                </div>
                            )}

                            {msg.senderId === user?.id && (
                                <button
                                    className="message-delete-btn"
                                    onClick={() => socketService.deleteMessage(activeChat.id, msg.id, user.id)}
                                    title="Удалить сообщение"
                                    style={{
                                        position: 'absolute',
                                        left: '-32px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '50%',
                                        width: '24px',
                                        height: '24px',
                                        color: 'var(--danger)',
                                        cursor: 'pointer',
                                        opacity: 0,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '14px',
                                        transition: 'opacity 0.2s',
                                        display: 'flex'
                                    }}
                                >
                                    🗑
                                </button>
                            )}

                            {msg.type === 'image' && msg.fileUrl && (
                                <img src={msg.fileUrl} alt="Sent" className="message-image" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '4px' }} />
                            )}

                            {msg.type === 'audio' && msg.fileUrl && (
                                <audio src={msg.fileUrl} controls className="message-audio" style={{ marginBottom: '4px', maxWidth: '100%' }} />
                            )}

                            {msg.type === 'text' && <div className="message-text">{msg.content}</div>}

                            <div className="message-time">
                                {formatTime(msg.timestamp)}
                                {msg.senderId === user?.id && (
                                    <span style={{ marginLeft: '4px', fontSize: '10px' }}>
                                        {msg.status === 'read' ? '✓✓' : '✓'}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="message-input-container" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                {imagePreview && (
                    <div className="image-preview" style={{ position: 'relative', marginBottom: '8px', alignSelf: 'flex-start' }}>
                        <img src={imagePreview} alt="Preview" style={{ height: '80px', borderRadius: '8px', objectFit: 'cover' }} />
                        <button
                            className="btn btn-icon"
                            style={{ position: 'absolute', top: '-8px', right: '-8px', width: '24px', height: '24px', fontSize: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                            onClick={() => setImagePreview(null)}>
                            ✕
                        </button>
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleImageUpload}
                    />
                    <button className="btn btn-ghost" title="Прикрепить фото" onClick={() => fileInputRef.current?.click()}>
                        📸
                    </button>
                    <textarea
                        className="message-input"
                        placeholder="Введите сообщение..."
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyPress={handleKeyPress}
                        rows={1}
                    />
                    <button
                        className={`btn btn-ghost ${isRecording ? 'recording-active' : ''}`}
                        title="Голосовое сообщение"
                        onMouseDown={startRecording}
                        onMouseUp={stopRecording}
                        onTouchStart={startRecording}
                        onTouchEnd={stopRecording}
                        style={{ display: inputValue || imagePreview ? 'none' : 'inline-flex' }}
                    >
                        {isRecording ? '🔴' : '🎤'}
                    </button>
                    <button
                        className="btn btn-icon"
                        onClick={handleSend}
                        disabled={!inputValue.trim() && !imagePreview}
                        title="Отправить"
                        style={{ display: inputValue || imagePreview ? 'inline-flex' : 'none' }}
                    >
                        ➤
                    </button>
                </div>
            </div>
        </div>
    );
};
