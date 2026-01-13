import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { socketService } from '../../socket/socketService';

export const ChatWindow: React.FC = () => {
    const { user, activeChat, messages, toggleSidebar } = useStore();
    const [inputValue, setInputValue] = useState('');
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
                    // In a real E2E app, we would decrypt messages here
                    const formattedMessages = result.data.map((m: any) => ({
                        id: m.id,
                        chatId: m.chatId,
                        senderId: m.senderId,
                        content: m.encryptedContent,
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

        // Send message via socket
        socketService.sendMessage(activeChat.id, user.id, inputValue.trim());

        setInputValue('');
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
                    <div className="logo-text" style={{ fontSize: '1.2rem' }}>Nyx</div>
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
                            <div className="message-text">{msg.content}</div>
                            <div className="message-time">
                                {formatTime(msg.timestamp)}
                                {msg.senderId === user?.id && (
                                    <span style={{ marginLeft: '4px' }}>
                                        {msg.status === 'sent' && '✓'}
                                        {msg.status === 'delivered' && '✓✓'}
                                        {msg.status === 'read' && '✓✓'}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="message-input-container">
                <button className="btn btn-ghost" title="Прикрепить файл">
                    📎
                </button>
                <textarea
                    className="message-input"
                    placeholder="Введите сообщение..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    rows={1}
                />
                <button className="btn btn-ghost" title="Голосовое сообщение">
                    🎤
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
