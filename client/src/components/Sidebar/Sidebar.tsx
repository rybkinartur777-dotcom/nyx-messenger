import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { socketService } from '../../socket/socketService';
import { Chat } from '../../types';
import { SettingsModal } from './SettingsModal';

interface SidebarProps {
    onAddContact: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onAddContact }) => {
    const { user, chats, activeChat, setActiveChat, sidebarOpen, toggleSidebar, logout, onlineUsers } = useStore();
    const [chatSearch, setChatSearch] = useState('');
    const [confirmLogout, setConfirmLogout] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [idCopied, setIdCopied] = useState(false);
    const [chatContextMenu, setChatContextMenu] = useState<{ x: number, y: number, chat: Chat } | null>(null);

    // Close context menu on outside click
    React.useEffect(() => {
        const handleClick = () => setChatContextMenu(null);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);


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

    // Filter and sort chats by search and latest message
    const sortedChats = [...chats].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const timeA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
        const timeB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
        return timeB - timeA;
    });

    const filteredChats = chatSearch.trim()
        ? sortedChats.filter(c => (c.name || '').toLowerCase().includes(chatSearch.toLowerCase()))
        : sortedChats;

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
                <button className="btn btn-ghost mobile-only" onClick={toggleSidebar} style={{ padding: '8px', display: 'flex' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '34px', height: '34px', overflow: 'hidden', borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/logo.png" className="logo-icon" alt="Nyx Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.45)', clipPath: 'inset(14% round 12px)' }} />
                    </div>
                    <span className="logo-text" style={{ display: 'flex', alignItems: 'center', lineHeight: 1 }}>NYX</span>
                </div>
                <button className="new-chat-btn-top add-contact-btn" onClick={onAddContact} title="Создать новый чат" style={{ width: '34px', height: '34px', flexShrink: 0 }}>
                    +
                </button>
            </div>

            <div className="search-container">
                <input
                    type="text"
                    className="search-input"
                    placeholder="Поиск чатов..."
                    value={chatSearch}
                    onChange={e => setChatSearch(e.target.value)}
                />
            </div>

            <div className="chat-list">
                {filteredChats.length === 0 ? (
                    <div className="empty-chat-list">
                        <div className="speech-bubble-icon">💬</div>
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
                            {chatSearch ? 'Чаты не найдены' : 'Список чатов пуст. Самое время начать общение!'}
                        </p>
                        {!chatSearch && (
                            <button className="create-chat-btn-large add-contact-btn" onClick={onAddContact}>
                                ✨ Создать чат
                            </button>
                        )}
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
                                    <div className="chat-name">
                                        {chat.isMuted && <span style={{ marginRight: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>🔕</span>}
                                        {chat.name || 'Неизвестный'}
                                    </div>
                                    <div className="chat-preview">{getLastMessagePreview(chat)}</div>
                                </div>

                                <div className="chat-meta">
                                    {chat.lastMessage && (
                                        <div className="chat-time">{formatTime(chat.lastMessage.timestamp)}</div>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                        {chat.unreadCount > 0 && (
                                            <div className="unread-badge" style={{ background: chat.isMuted ? 'var(--text-secondary)' : undefined }}>
                                                {chat.unreadCount}
                                            </div>
                                        )}
                                        {chat.isPinned && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>📌</div>}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {chatContextMenu && (
                <div
                    className="context-menu"
                    style={{ top: chatContextMenu.y, left: chatContextMenu.x, zIndex: 1000, width: '200px' }}
                    onClick={e => e.stopPropagation()}
                >
                    <button className="context-menu-item" onClick={() => {
                        useStore.getState().toggleChatPin(chatContextMenu.chat.id);
                        setChatContextMenu(null);
                    }}>
                        📌 {chatContextMenu.chat.isPinned ? 'Открепить' : 'Закрепить'}
                    </button>
                    <button className="context-menu-item" onClick={() => {
                        useStore.getState().toggleChatMute(chatContextMenu.chat.id);
                        setChatContextMenu(null);
                    }}>
                        {chatContextMenu.chat.isMuted ? '🔔 Включить звук' : '🔕 Без звука'}
                    </button>
                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '4px 0' }} />
                    <button className="context-menu-item danger" onClick={() => {
                        setChatContextMenu(null);
                        // Trigger delete custom logic
                        if (window.confirm(`Вы уверены, что хотите удалить чат с ${chatContextMenu.chat.name || 'Неизвестный'}? Это полностью удалит переписку у обоих.`)) {
                            socketService.deleteChat(chatContextMenu.chat.id);
                            if (activeChat?.id === chatContextMenu.chat.id) {
                                setActiveChat(null);
                            }
                        }
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Удалить чат
                    </button>
                </div>
            )}

            {user && (
                <div style={{
                    padding: '12px 14px',
                    borderTop: '1px solid var(--border-color)',
                    background: 'linear-gradient(0deg, var(--bg-hover) 0%, transparent 100%)',
                }}>
                    {confirmLogout ? (
                        <div style={{ padding: '10px 12px', background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)', borderRadius: '14px' }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px', textAlign: 'center' }}>
                                🚪 Выйти из аккаунта?
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setConfirmLogout(false)} style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>
                                    Отмена
                                </button>
                                <button onClick={() => { localStorage.removeItem('nyx_private_key'); localStorage.removeItem('nyx-storage'); logout(); window.location.reload(); }} style={{ flex: 1, padding: '8px', background: 'rgba(255,71,87,0.2)', border: '1px solid rgba(255,71,87,0.4)', borderRadius: '10px', color: '#ff4757', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
                                    Выйти
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Avatar */}
                            <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', flexShrink: 0, overflow: 'hidden', boxShadow: '0 0 12px var(--accent-glow)', color: '#fff' }}>
                                {user.avatar
                                    ? <img src={user.avatar} alt={user.nickname} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : user.nickname[0]?.toUpperCase()
                                }
                            </div>

                            {/* Name + ID */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {user.nickname}
                                </div>
                                <div
                                    onClick={() => { navigator.clipboard.writeText(user.id); setIdCopied(true); setTimeout(() => setIdCopied(false), 2000); }}
                                    style={{ fontSize: '11px', color: idCopied ? 'var(--success)' : 'var(--text-secondary)', fontFamily: 'monospace', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'color 0.2s', letterSpacing: '0.5px' }}
                                    title="Нажмите чтобы скопировать ID"
                                >
                                    {idCopied ? '✅ Скопировано!' : user.id}
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                <button
                                    onClick={() => setShowSettings(true)}
                                    title="Настройки"
                                    style={{ width: 34, height: 34, borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', fontSize: '16px' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-active)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-secondary)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 10px var(--accent-glow)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                                >
                                    ⚙️
                                </button>
                                <button
                                    onClick={() => setConfirmLogout(true)}
                                    title="Выход"
                                    style={{ width: 34, height: 34, borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', fontSize: '16px' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,71,87,0.15)'; (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 10px rgba(255,71,87,0.3)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                                >
                                    🚪
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </div>
    );
};


