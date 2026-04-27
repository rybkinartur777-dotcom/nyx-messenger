import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { socketService } from '../../socket/socketService';
import { Chat } from '../../types';
import { SettingsModal } from './SettingsModal';
import { PinModal } from '../Auth/PinModal';
import { API_BASE_URL } from '../../config';

interface SidebarProps {
    onAddContact: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onAddContact }) => {
    const { user, chats, activeChat, setActiveChat, sidebarOpen, toggleSidebar, logout, onlineUsers, isFakeMode, addToast, lockedChatIds, setChatLock } = useStore();
    const [chatSearch, setChatSearch] = useState('');
    const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'private'>('all');
    const [confirmLogout, setConfirmLogout] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [chatContextMenu, setChatContextMenu] = useState<{ x: number, y: number, chat: Chat } | null>(null);
    const [showChatUnlock, setShowChatUnlock] = useState<Chat | null>(null);
    const [chatBottomSheet, setChatBottomSheet] = useState<{ chat: Chat } | null>(null);
    const isMobile = () => window.innerWidth <= 768 || ('ontouchstart' in window);

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

    const getContactId = (chat: Chat) => {
        if (chat.type !== 'private') return null;
        return chat.participants.find(p => p !== user?.id) || null;
    };

    const sortedChats = isFakeMode ? [] : [...chats].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const timeA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
        const timeB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
        return timeB - timeA;
    });

    const handleAddContactClick = () => {
        if (isFakeMode) {
            addToast({
                title: 'Нет подключения',
                body: 'Не удалось подключиться к серверу в режиме защищенного сеанса.',
            });
            return;
        }
        onAddContact();
    };

    const filteredChats = sortedChats.filter(c => {
        if (chatSearch.trim() && !(c.name || '').toLowerCase().includes(chatSearch.toLowerCase())) return false;
        if (chatFilter === 'unread' && c.unreadCount === 0) return false;
        if (chatFilter === 'private' && c.type !== 'private') return false;
        return true;
    });

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

    const handleCreateNotes = async () => {
        if (!user || isFakeMode) return;
        const notesChat = chats.find(c => c.type === 'private' && c.participants.length === 1 && c.participants[0] === user.id);
        
        if (notesChat) {
            setActiveChat(notesChat);
            if (window.innerWidth <= 768) toggleSidebar();
            return;
        }

        try {
            const serverUrl = API_BASE_URL.replace(/\/$/, '');
            const response = await fetch(`${serverUrl}/api/chats/private`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, contactId: user.id })
            });
            const result = await response.json();
            if (result.success && result.data.chatId) {
                const serverChatId = result.data.chatId;
                const newChat: Chat = {
                    id: serverChatId, type: 'private',
                    participants: [user.id],
                    name: 'Избранное',
                    unreadCount: 0, createdAt: new Date()
                };
                
                const existingInStore = chats.find(c => c.id === serverChatId);
                if (existingInStore) { 
                    setActiveChat(existingInStore); 
                } else { 
                    useStore.getState().setChats([...chats, newChat]); 
                    setActiveChat(newChat); 
                }
                
                socketService.joinChat(serverChatId);
                if (window.innerWidth <= 768) toggleSidebar();
            }
        } catch (err) {
            console.error('Failed to create notes chat', err);
        }
    };

    return (
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
                <button className="btn btn-ghost mobile-only" onClick={toggleSidebar} style={{ padding: '8px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '34px', height: '34px', overflow: 'hidden', borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/logo.png" className="logo-icon" alt="Nyx Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.45)', clipPath: 'inset(14% round 12px)' }} />
                    </div>
                    <span className="logo-text" style={{ display: 'flex', alignItems: 'center', lineHeight: 1 }}>NYX</span>
                    
                    <button className="btn btn-ghost" onClick={handleCreateNotes} title="Избранное (Заметки)" style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '4px', borderRadius: '8px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </button>
                </div>
                <button className="new-chat-btn-top add-contact-btn" onClick={handleAddContactClick} title="Создать новый чат">
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

            <div className="sidebar-filters">
                <button 
                    className={`filter-tab ${chatFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setChatFilter('all')}
                >
                    Все
                </button>
                <button 
                    className={`filter-tab ${chatFilter === 'unread' ? 'active' : ''}`}
                    onClick={() => setChatFilter('unread')}
                >
                    Новые
                </button>
                <button 
                    className={`filter-tab ${chatFilter === 'private' ? 'active' : ''}`}
                    onClick={() => setChatFilter('private')}
                >
                    Личные
                </button>
            </div>

            <div className="chat-list">
                {filteredChats.length === 0 ? (
                    <div className="empty-chat-list">
                        <div className="speech-bubble-icon">💬</div>
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
                            {chatSearch ? 'Чаты не найдены' : 'Список чатов пуст.'}
                        </p>
                    </div>
                ) : (
                    filteredChats.map((chat, index) => {
                        const contactId = getContactId(chat);
                        const isOnline = contactId ? onlineUsers.has(contactId) : false;
                        const isSelfChat = chat.type === 'private' && chat.participants.length === 1 && chat.participants[0] === user?.id;

                        return (
                            <div
                                key={chat.id}
                                className={`chat-item ${activeChat?.id === chat.id ? 'active' : ''}`}
                                style={{ animationDelay: `${index * 0.04}s` }}
                                onClick={() => {
                                    if (lockedChatIds[chat.id]) {
                                        setShowChatUnlock(chat);
                                    } else {
                                        setActiveChat(chat);
                                        if (window.innerWidth <= 768) toggleSidebar();
                                    }
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (isMobile()) {
                                        setChatBottomSheet({ chat });
                                        return;
                                    }
                                    setChatContextMenu({ x: e.clientX, y: e.clientY, chat });
                                }}
                            >
                                <div className="avatar-wrapper">
                                    <div className="avatar" style={{
                                        ...(chat.avatar && !isSelfChat ? { padding: 0, overflow: 'hidden' } : {}),
                                        ...(isSelfChat ? { background: 'linear-gradient(135deg, #6c5ce7, #5c4ce7)' } : {})
                                    }}>
                                        {isSelfChat ? (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ color: '#fff' }}>
                                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                            </svg>
                                        ) : chat.avatar ? (
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
                                        {isSelfChat ? 'Избранное' : (chat.name || 'Неизвестный')}
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
                    <button className="context-menu-item" onClick={() => {
                        const isLocked = lockedChatIds[chatContextMenu.chat.id];
                        if (isLocked) {
                            setChatLock(chatContextMenu.chat.id, null);
                        } else {
                            const pwd = window.prompt('Введите ПИН-код для чата:');
                            if (pwd) setChatLock(chatContextMenu.chat.id, pwd);
                        }
                        setChatContextMenu(null);
                    }}>
                        {lockedChatIds[chatContextMenu.chat.id] ? '🔓 Убрать пароль' : '🔒 Пароль на чат'}
                    </button>
                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '4px 0' }} />
                    <button className="context-menu-item danger" onClick={() => {
                        setChatContextMenu(null);
                        if (window.confirm(`Удалить чат с ${chatContextMenu.chat.name}?`)) {
                            socketService.deleteChat(chatContextMenu.chat.id);
                        }
                    }}>
                        Удалить чат
                    </button>
                </div>
            )}

            {user && (
                <div className="sidebar-footer" style={{ padding: '12px 14px', borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                    {confirmLogout ? (
                        <div style={{ padding: '10px', background: 'rgba(255,71,87,0.1)', borderRadius: '12px' }}>
                            <div style={{ fontSize: '13px', textAlign: 'center', marginBottom: '8px' }}>Выйти?</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setConfirmLogout(false)} style={{ flex: 1, padding: '6px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>Нет</button>
                                <button onClick={() => { logout(); window.location.reload(); }} style={{ flex: 1, padding: '6px', borderRadius: '8px', background: 'rgba(255,71,87,0.2)', color: '#ff4757', border: '1px solid rgba(255,71,87,0.3)', cursor: 'pointer', fontWeight: 700 }}>Да</button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                                {user.avatar ? <img src={user.avatar} style={{ width: '100%', height: '100%', borderRadius: '12px', objectFit: 'cover' }} /> : user.nickname[0]?.toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.nickname}</div>
                                <div title="Копировать ID" style={{ fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => { navigator.clipboard.writeText(user.id); alert('ID скопирован'); }}>{user.id.slice(0, 8)}...</div>
                            </div>
                            <button onClick={() => setShowSettings(true)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: '34px', height: '34px', borderRadius: '10px', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚙️</button>
                            <button onClick={() => setConfirmLogout(true)} style={{ background: 'rgba(255,71,87,0.1)', border: 'none', width: '34px', height: '34px', borderRadius: '10px', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🚪</button>
                        </div>
                    )}
                </div>
            )}

            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

            {showChatUnlock && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000000 }}>
                    <PinModal 
                        mode="unlock" 
                        onSuccess={() => {
                            setActiveChat(showChatUnlock);
                            setShowChatUnlock(null);
                            if (window.innerWidth <= 768) toggleSidebar();
                        }} 
                        onCancel={() => setShowChatUnlock(null)}
                        onPinSet={(pin: string) => {
                            if (pin === lockedChatIds[showChatUnlock.id]) {
                                setActiveChat(showChatUnlock);
                                setShowChatUnlock(null);
                                if (window.innerWidth <= 768) toggleSidebar();
                            } else {
                                alert('Неверный пароль чата');
                            }
                        }}
                    />
                </div>
            )}

            {chatBottomSheet && (
                <>
                    <div onClick={() => setChatBottomSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998 }} />
                    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1a1a1a', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px 24px 0 0', zIndex: 9999, padding: '20px' }}>
                        <div style={{ height: '4px', width: '40px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', margin: '0 auto 20px' }} />
                        <button onClick={() => { socketService.deleteChat(chatBottomSheet.chat.id); setChatBottomSheet(null); }} style={{ width: '100%', padding: '15px', color: '#ff4757', background: 'rgba(255,71,87,0.1)', border: 'none', borderRadius: '12px', textAlign: 'center', fontSize: '16px', fontWeight: 600 }}>Удалить чат</button>
                        <button onClick={() => setChatBottomSheet(null)} style={{ width: '100%', padding: '15px', background: 'none', border: 'none', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '16px', marginTop: '10px' }}>Отмена</button>
                    </div>
                </>
            )}
        </div>
    );
};
