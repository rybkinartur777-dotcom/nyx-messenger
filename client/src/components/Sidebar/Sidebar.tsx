import React from 'react';
import { useStore } from '../../store/useStore';
import { Chat } from '../../types';

interface SidebarProps {
    onAddContact: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onAddContact }) => {
    const { user, chats, activeChat, setActiveChat, sidebarOpen, toggleSidebar } = useStore();

    const formatTime = (date: Date) => {
        const now = new Date();
        const messageDate = new Date(date);

        if (messageDate.toDateString() === now.toDateString()) {
            return messageDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        }
        return messageDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    };

    const getAvatarLetter = (chat: Chat) => {
        if (chat.name) return chat.name[0].toUpperCase();
        return '?';
    };

    return (
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
                <button className="btn btn-ghost mobile-only" onClick={toggleSidebar}>
                    ✕
                </button>
                <div className="logo">
                    <div className="logo-icon">N</div>
                    <span className="logo-text">Nyx</span>
                </div>
                <button className="btn btn-ghost" onClick={onAddContact} title="Добавить контакт">
                    ➕
                </button>
            </div>

            <div className="search-container">
                <input
                    type="text"
                    className="search-input"
                    placeholder="🔍 Поиск чатов..."
                />
            </div>

            <div className="chat-list">
                {chats.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 20px' }}>
                        <div style={{ fontSize: '40px', marginBottom: '16px' }}>💬</div>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Нет чатов. Добавьте контакт по ID, чтобы начать общение.
                        </p>
                    </div>
                ) : (
                    chats.map((chat) => (
                        <div
                            key={chat.id}
                            className={`chat-item ${activeChat?.id === chat.id ? 'active' : ''}`}
                            onClick={() => {
                                setActiveChat(chat);
                                if (window.innerWidth <= 768) {
                                    toggleSidebar();
                                }
                            }}
                        >
                            <div className="avatar">
                                {getAvatarLetter(chat)}
                            </div>
                            <div className="chat-info">
                                <div className="chat-name">{chat.name || 'Неизвестный'}</div>
                                <div className="chat-preview">
                                    {chat.lastMessage?.content || 'Нет сообщений'}
                                </div>
                            </div>
                            <div className="chat-meta">
                                {chat.lastMessage && (
                                    <div className="chat-time">
                                        {formatTime(chat.lastMessage.timestamp)}
                                    </div>
                                )}
                                {chat.unreadCount > 0 && (
                                    <div className="unread-badge">{chat.unreadCount}</div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {user && (
                <div className="profile-section">
                    <div className="avatar" style={{ width: '40px', height: '40px', fontSize: '16px' }}>
                        {user.nickname[0].toUpperCase()}
                    </div>
                    <div className="profile-info">
                        <div className="profile-name">{user.nickname}</div>
                        <div className="profile-id">{user.id}</div>
                    </div>
                    <button
                        className="btn btn-ghost"
                        onClick={() => {
                            navigator.clipboard.writeText(user.id);
                        }}
                        title="Скопировать ID"
                    >
                        📋
                    </button>
                </div>
            )}
        </div>
    );
};
