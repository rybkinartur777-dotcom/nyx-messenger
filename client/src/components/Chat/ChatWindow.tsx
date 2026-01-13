import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { socketService } from '../../socket/socketService';

export const ChatWindow: React.FC = () => {
    const { user, activeChat, messages, toggleSidebar } = useStore();
    const [inputValue, setInputValue] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const chatMessages = activeChat ? messages[activeChat.id] || [] : [];
    const { setMessages } = useStore();

    useEffect(() => {
        const fetchMessages = async () => {
            if (!activeChat) return;

            try {
                const baseUrl = (import.meta as any).env.VITE_SERVER_URL || 'https://nyx-messenger-e77j.onrender.com';
                const serverUrl = baseUrl.replace(/\/$/, '');
                const response = await fetch(`${serverUrl}/api/chats/${activeChat.id}/messages`);
                const result = await response.json();

                if (result.success) {
                    const formattedMessages = result.data.map((m: any) => ({
                        id: m.id,
                        chatId: m.chatId,
                        senderId: m.senderId,
                        content: m.encryptedContent,
                        type: m.message_type || 'text',
                        fileUrl: m.file_url,
                        timestamp: new Date(m.timestamp),
                        status: 'delivered'
                    }));
                    setMessages(activeChat.id, formattedMessages);
                }
            } catch (err) {
                console.error('Error fetching messages:', err);
            }
        };

        fetchMessages();
    }, [activeChat?.id, setMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages.length]);

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleSend = () => {
        if (!inputValue.trim() || !activeChat || !user) return;
        socketService.sendMessage(activeChat.id, user.id, inputValue.trim(), 'text');
        setInputValue('');
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeChat || !user) return;

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            socketService.sendMessage(activeChat.id, user.id, '[Изображение]', 'image', base64);
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
                    socketService.sendMessage(activeChat.id, user.id!, '[Голосовое сообщение]', 'audio', base64);
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
                        <img src="/logo.png" alt="Nyx Logo" style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
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
                <div className="avatar" style={{ width: '44px', height: '44px' }}>
                    {activeChat.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="chat-header-info">
                    <div className="chat-header-name">{activeChat.name || 'Контакт'}</div>
                    <div className="chat-header-status online">
                        в сети
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
                            {msg.type === 'image' && msg.fileUrl && (
                                <img src={msg.fileUrl} alt="Sent" className="message-image" style={{ maxWidth: '100%', borderRadius: '12px', marginBottom: '8px' }} />
                            )}

                            {msg.type === 'audio' && msg.fileUrl && (
                                <audio src={msg.fileUrl} controls className="message-audio" style={{ marginBottom: '8px', maxWidth: '100%' }} />
                            )}

                            {msg.type === 'text' && <div className="message-text">{msg.content}</div>}

                            <div className="message-time">
                                {formatTime(msg.timestamp)}
                                {msg.senderId === user?.id && (
                                    <span style={{ marginLeft: '4px' }}>
                                        ✓✓
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="message-input-container">
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
                    onChange={(e) => setInputValue(e.target.value)}
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
                >
                    {isRecording ? '🔴' : '🎤'}
                </button>
                <button
                    className="btn btn-icon"
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                    title="Отправить"
                >
                    ➤
                </button>
            </div>
        </div>
    );
};
