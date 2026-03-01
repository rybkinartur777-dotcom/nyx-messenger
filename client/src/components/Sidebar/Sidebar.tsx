import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { socketService } from '../../socket/socketService';
import { Chat } from '../../types';

interface SidebarProps {
    onAddContact: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onAddContact }) => {
    const { user, chats, activeChat, setActiveChat, sidebarOpen, toggleSidebar, logout, theme, setTheme, onlineUsers } = useStore();
    const [chatSearch, setChatSearch] = useState('');
    const [confirmLogout, setConfirmLogout] = useState(false);
    const [idCopied, setIdCopied] = useState(false);
    const [chatContextMenu, setChatContextMenu] = useState<{ x: number, y: number, chat: Chat } | null>(null);

    // Close context menu on outside click
    React.useEffect(() => {
        const handleClick = () => setChatContextMenu(null);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

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

    // Get the other participant in a private chat
    const getContactId = (chat: Chat) => {
        if (chat.type !== 'private') return null;
        return chat.participants.find(p => p !== user?.id) || null;
    };

    // Filter chats by search
    const filteredChats = chatSearch.trim()
        ? chats.filter(c => (c.name || '').toLowerCase().includes(chatSearch.toLowerCase()))
        : chats;

    const getLastMessagePreview = (chat: Chat) => {
        const lm = chat.lastMessage;
        if (!lm) return 'Нет сообщений';
        if (lm.type === 'image') return '📷 Изображение';
        if (lm.type === 'video') return '🎬 Видео';
        if (lm.type === 'audio') return '🎵 Голосовое';
        if (lm.type === 'file') return '📎 Файл';
        if (lm.type === 'sticker') return '✨ Стикер';
        const content = lm.content || '';
        return content.length > 35 ? content.slice(0, 35) + '...' : content;
    };

    return (
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
                <button className="btn btn-ghost mobile-only" onClick={toggleSidebar}>✕</button>
                <div className="logo">
                    <img src="/logo.png" className="logo-icon" alt="Nyx Logo" style={{ width: '32px', height: '32px', borderRadius: '8px', marginRight: '8px', objectFit: 'cover' }} />
                    <span className="logo-text">Nyx</span>
                </div>
                <button className="btn btn-ghost new-chat-btn" onClick={onAddContact} title="Добавить контакт">
                    ✏️
                </button>
            </div>

            <div className="search-container">
                <input
                    type="text"
                    className="search-input"
                    placeholder="🔍 Поиск чатов..."
                    value={chatSearch}
                    onChange={e => setChatSearch(e.target.value)}
                />
            </div>

            <div className="chat-list">
                {filteredChats.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 20px' }}>
                        <div style={{ fontSize: '40px', marginBottom: '16px' }}>
                            {chatSearch ? '🔍' : '💬'}
                        </div>
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
                            {chatSearch ? 'Чаты не найдены' : 'Нет чатов. Добавьте контакт по ID, чтобы начать общение.'}
                        </p>
                    </div>
                ) : (
                    filteredChats.map((chat) => {
                        const contactId = getContactId(chat);
                        const isOnline = contactId ? onlineUsers.has(contactId) : false;

                        return (
                            <div
                                key={chat.id}
                                className={`chat-item ${activeChat?.id === chat.id ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveChat(chat);
                                    if (window.innerWidth <= 768) toggleSidebar();
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const cx = e.clientX;
                                    const cy = e.clientY;
                                    const MENU_W = 180; const MENU_H = 60;
                                    let x = cx; let y = cy;
                                    if (x + MENU_W > window.innerWidth) x = window.innerWidth - MENU_W - 8;
                                    if (y + MENU_H > window.innerHeight) y = window.innerHeight - MENU_H - 8;
                                    setChatContextMenu({ x, y, chat });
                                }}
                            >
                                <div className="avatar-wrapper">
                                    <div className="avatar" style={chat.avatar ? { padding: 0, overflow: 'hidden' } : {}}>
                                        {chat.avatar ? (
                                            <img src={chat.avatar} alt={chat.name || 'Chat'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            getAvatarLetter(chat)
                                        )}
                                    </div>
                                    {isOnline && <span className="online-badge"></span>}
                                </div>

                                <div className="chat-info">
                                    <div className="chat-name">{chat.name || 'Неизвестный'}</div>
                                    <div className="chat-preview">{getLastMessagePreview(chat)}</div>
                                </div>

                                <div className="chat-meta">
                                    {chat.lastMessage && (
                                        <div className="chat-time">{formatTime(chat.lastMessage.timestamp)}</div>
                                    )}
                                    {chat.unreadCount > 0 && (
                                        <div className="unread-badge">{chat.unreadCount}</div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {chatContextMenu && (
                <div
                    className="context-menu"
                    style={{ top: chatContextMenu.y, left: chatContextMenu.x, zIndex: 1000 }}
                    onClick={e => e.stopPropagation()}
                >
                    <button className="context-menu-item danger" onClick={() => {
                        if (window.confirm(`Вы уверены, что хотите удалить чат с ${chatContextMenu.chat.name || 'Неизвестный'}? Это действие нельзя отменить.`)) {
                            socketService.deleteChat(chatContextMenu.chat.id);
                        }
                        setChatContextMenu(null);
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        Удалить чат
                    </button>
                </div>
            )}

            {user && (
                <div className="profile-section">
                    <div className="profile-top">
                        <div className="avatar" style={{ width: '36px', height: '36px', fontSize: '14px', overflow: 'hidden', padding: user.avatar ? 0 : undefined, flexShrink: 0 }}>
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.nickname} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                user.nickname[0].toUpperCase()
                            )}
                        </div>
                        <div className="profile-info">
                            <div className="profile-name">{user.nickname}</div>
                            <div
                                className="profile-id-full"
                                title="Нажмите чтобы скопировать"
                                onClick={() => {
                                    navigator.clipboard.writeText(user.id);
                                    setIdCopied(true);
                                    setTimeout(() => setIdCopied(false), 2000);
                                }}
                            >
                                {idCopied ? '✅ Скопировано!' : user.id}
                            </div>
                        </div>
                    </div>

                    {confirmLogout ? (
                        <div className="logout-confirm">
                            <span>Выйти из аккаунта?</span>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                <button
                                    className="profile-action-btn logout-btn"
                                    style={{ flex: 1 }}
                                    onClick={() => {
                                        localStorage.removeItem('nyx_private_key');
                                        localStorage.removeItem('nyx-storage');
                                        logout();
                                        window.location.reload();
                                    }}
                                >
                                    ✅ Да, выйти
                                </button>
                                <button
                                    className="profile-action-btn"
                                    style={{ flex: 1 }}
                                    onClick={() => setConfirmLogout(false)}
                                >
                                    ❌ Отмена
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="profile-actions">
                            <button
                                className="profile-action-btn"
                                onClick={handleThemeToggle}
                                title="Сменить тему"
                            >
                                {getThemeIcon()} Тема
                            </button>
                            <button
                                className="profile-action-btn logout-btn"
                                onClick={() => setConfirmLogout(true)}
                            >
                                🚪 Выход
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


