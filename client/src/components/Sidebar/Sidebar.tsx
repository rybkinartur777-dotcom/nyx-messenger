import React from 'react';
import { useStore } from '../../store/useStore';
import { Chat } from '../../types';

interface SidebarProps {
    onAddContact: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onAddContact }) => {
    const { user, chats, activeChat, setActiveChat, sidebarOpen, toggleSidebar, logout, theme, setTheme } = useStore();

    const handleThemeToggle = () => {
        if (theme === 'dark') setTheme('light');
        else if (theme === 'light') setTheme('cyberpunk');
        else setTheme('dark');
    };

    const getThemeIcon = () => {
        if (theme === 'dark') return '🌙';
        if (theme === 'light') return '☀️';
        return '🌃';
    };

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
                    <img src="/logo.png" className="logo-icon" alt="Nyx Logo" style={{ width: '32px', height: '32px', borderRadius: '8px', marginRight: '8px', objectFit: 'cover' }} />
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
                            <div className="avatar" style={chat.avatar ? { padding: 0, overflow: 'hidden' } : {}}>
                                {chat.avatar ? (
                                    <img src={chat.avatar} alt={chat.name || 'Chat'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    getAvatarLetter(chat)
                                )}
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
                    <div className="avatar" style={{ width: '40px', height: '40px', fontSize: '16px', overflow: 'hidden', padding: user.avatar ? 0 : undefined }}>
                        {user.avatar ? (
                            <img src={user.avatar} alt={user.nickname} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            user.nickname[0].toUpperCase()
                        )}
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
                        style={{ padding: '8px 4px' }}
                    >
                        📋
                    </button>
                    <button
                        className="btn btn-ghost"
                        onClick={handleThemeToggle}
                        title="Сменить тему"
                        style={{ padding: '8px 4px' }}
                    >
                        {getThemeIcon()}
                    </button>
                    <button
                        className="btn btn-ghost"
                        onClick={() => {
                            if (window.confirm('Вы уверены, что хотите выйти?')) {
                                localStorage.removeItem('nyx_private_key');
                                localStorage.removeItem('nyx-storage');
                                logout();
                                window.location.reload();
                            }
                        }}
                        title="Выход"
                        style={{ color: 'var(--danger)', padding: '8px 4px' }}
                    >
                        🚪
                    </button>
                </div>
            )}
        </div>
    );
};
