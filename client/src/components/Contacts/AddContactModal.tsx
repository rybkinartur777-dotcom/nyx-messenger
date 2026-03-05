import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useStore } from '../../store/useStore';
import { Chat } from '../../types';
import { API_BASE_URL } from '../../config';
import { socketService } from '../../socket/socketService';

interface AddContactModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AddContactModal: React.FC<AddContactModalProps> = ({ isOpen, onClose }) => {
    const [contactId, setContactId] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);

    const { user, chats, setChats, setActiveChat, addContact } = useStore();

    const handleAdd = async (targetId?: string) => {
        setError('');
        const id = (targetId || contactId).trim();

        if (!id) { setError('Введите ID контакта'); return; }
        if (!id.startsWith('NYX-')) { setError('ID должен начинаться с NYX-  (например: NYX-7sj8nf6R)'); return; }
        if (id.toLowerCase() === user?.id?.toLowerCase()) { setError('Это ваш собственный ID 😄'); return; }

        const existingChat = chats.find(c =>
            c.type === 'private' && c.participants.some(p => p.toLowerCase() === id.toLowerCase())
        );
        if (existingChat) { setActiveChat(existingChat); onClose(); return; }

        setIsLoading(true);
        try {
            const serverUrl = API_BASE_URL.replace(/\/$/, '');
            const response = await fetch(`${serverUrl}/api/users/${encodeURIComponent(id)}`);

            if (!response.ok) {
                if (response.status === 404) {
                    setError(`Пользователь "${id}" не найден. Убедитесь что ID введён точно.`);
                } else {
                    setError('Ошибка сервера. Попробуйте позже.');
                }
                return;
            }

            const result = await response.json();
            if (!result.success) { setError('Пользователь не найден'); return; }

            const foundUser = result.data;

            addContact({ userId: foundUser.id, nickname: foundUser.nickname, publicKey: foundUser.publicKey, avatar: foundUser.avatar, addedAt: new Date() });

            const chatRes = await fetch(`${serverUrl}/api/chats/private`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user!.id, contactId: foundUser.id })
            });

            const chatResult = await chatRes.json();
            if (!chatResult.success) throw new Error('Не удалось создать чат');

            const serverChatId = chatResult.data.chatId;
            const newChat: Chat = {
                id: serverChatId, type: 'private',
                participants: [user!.id, foundUser.id],
                name: foundUser.nickname, avatar: foundUser.avatar,
                unreadCount: 0, createdAt: new Date()
            };

            const existingInStore = chats.find(c => c.id === serverChatId);
            if (existingInStore) { setActiveChat(existingInStore); }
            else { setChats([...chats, newChat]); setActiveChat(newChat); }

            socketService.joinChat(serverChatId);
            onClose();
            setContactId('');
            setSearchResults([]);
        } catch (err: any) {
            console.error('Add contact error:', err);
            setError('Ошибка сети. Проверьте подключение.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = async () => {
        const q = contactId.trim();
        if (q.length < 3) { setError('Введите минимум 3 символа для поиска'); return; }
        setError(''); setIsLoading(true);
        try {
            const serverUrl = API_BASE_URL.replace(/\/$/, '');
            const res = await fetch(`${serverUrl}/api/users/search/${encodeURIComponent(q)}`);
            const result = await res.json();
            if (result.success && result.data.length > 0) {
                setSearchResults(result.data);
            } else {
                setSearchResults([]);
                setError('По никнейму никого не найдено');
            }
        } catch { setError('Ошибка поиска'); }
        finally { setIsLoading(false); }
    };

    if (!isOpen) return null;

    const modal = (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--glass-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', width: '460px', maxWidth: '95vw', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(108,92,231,0.15)', animation: 'slideUp 0.25s ease' }}>

                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>➕ Добавить контакт</h2>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                </div>

                <div style={{ padding: '20px 24px' }}>
                    {/* Your ID */}
                    <div style={{ background: 'rgba(108,92,231,0.08)', border: '1px solid rgba(108,92,231,0.2)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Ваш ID — поделитесь с другом</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 700, color: '#a29bfe', letterSpacing: '1px' }}>{user?.id}</div>
                        <button onClick={() => { navigator.clipboard.writeText(user?.id || ''); }} style={{ marginTop: '8px', padding: '4px 12px', background: 'rgba(108,92,231,0.2)', border: '1px solid rgba(108,92,231,0.3)', borderRadius: '6px', color: '#a29bfe', cursor: 'pointer', fontSize: '12px' }}>
                            📋 Копировать
                        </button>
                    </div>

                    {/* Input */}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            ID контакта или никнейм
                        </label>
                        <input
                            type="text"
                            placeholder="NYX-XXXXXXXX или @nickname"
                            value={contactId}
                            onChange={e => { setContactId(e.target.value); setError(''); setSearchResults([]); }}
                            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                            autoFocus
                            style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${error ? 'rgba(255,71,87,0.5)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
                        />
                        {error && <div style={{ color: '#ff4757', fontSize: '13px', marginTop: '8px' }}>⚠️ {error}</div>}
                    </div>

                    {/* Search results */}
                    {searchResults.length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Найдено:</div>
                            {searchResults.map(u => (
                                <button key={u.id} onClick={() => handleAdd(u.id)} style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                                        {(u.nickname[0] || '?').toUpperCase()}
                                    </div>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{u.nickname}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{u.id}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px' }}>
                            Отмена
                        </button>
                        {!contactId.startsWith('NYX-') && contactId.trim().length >= 3 && (
                            <button onClick={handleSearch} disabled={isLoading} style={{ padding: '12px 16px', background: 'rgba(108,92,231,0.2)', border: '1px solid rgba(108,92,231,0.4)', borderRadius: '10px', color: '#a29bfe', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                                🔍
                            </button>
                        )}
                        <button
                            onClick={() => handleAdd()}
                            disabled={isLoading || !contactId.trim()}
                            style={{ flex: 1, padding: '12px', background: (isLoading || !contactId.trim()) ? 'rgba(108,92,231,0.3)' : 'linear-gradient(135deg, #6c5ce7, #a29bfe)', border: 'none', borderRadius: '10px', color: '#fff', cursor: (isLoading || !contactId.trim()) ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 700, boxShadow: '0 4px 15px rgba(108,92,231,0.4)' }}
                        >
                            {isLoading ? '⏳ Поиск...' : '✓ Добавить'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modal, document.body);
};
