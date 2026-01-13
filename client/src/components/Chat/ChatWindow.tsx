import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Message } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export const ChatWindow: React.FC = () => {
    const { user, activeChat, messages, addMessage, updateChatLastMessage } = useStore();
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const chatMessages = activeChat ? messages[activeChat.id] || [] : [];

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleSend = () => {
        if (!inputValue.trim() || !activeChat || !user) return;

        const newMessage: Message = {
            id: uuidv4(),
            chatId: activeChat.id,
            senderId: user.id,
            content: inputValue.trim(),
            timestamp: new Date(),
            status: 'sent'
        };

        addMessage(activeChat.id, newMessage);
        updateChatLastMessage(activeChat.id, newMessage);
        setInputValue('');

        // Simulate reply (for demo purposes)
        setTimeout(() => {
            const reply: Message = {
                id: uuidv4(),
                chatId: activeChat.id,
                senderId: 'other-user',
                content: 'Сообщение получено! 🔐',
                timestamp: new Date(),
                status: 'delivered'
            };
            addMessage(activeChat.id, reply);
            updateChatLastMessage(activeChat.id, reply);
        }, 1500);
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
                <div className="avatar" style={{ width: '44px', height: '44px' }}>
                    {activeChat.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="chat-header-info">
                    <div className="chat-header-name">{activeChat.name || 'Контакт'}</div>
                    <div className={`chat-header-status ${isTyping ? '' : 'online'}`}>
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
