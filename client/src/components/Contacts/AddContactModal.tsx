import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useStore } from '../../store/useStore';
import { Chat } from '../../types';
import { API_BASE_URL } from '../../config';
import { socketService } from '../../socket/socketService';
import { T } from '../../locales';

interface AddContactModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AddContactModal: React.FC<AddContactModalProps> = ({ isOpen, onClose }) => {
    // Tabs state
    const [activeTab, setActiveTab] = useState<'contact' | 'group'>('contact');

    // Add Contact states
    const [contactId, setContactId] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);

    // Create Group states
    const [groupName, setGroupName] = useState('');
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [manualParticipantId, setManualParticipantId] = useState('');
    const [manualParticipants, setManualParticipants] = useState<string[]>([]);

    const { user, chats, setChats, setActiveChat, addContact, lang, contacts } = useStore();

    const handleAdd = async (targetId?: string) => {
        setError('');
        const id = (targetId || contactId).trim();

        if (!id) { setError(T[lang].add_contact.error_empty); return; }
        if (!id.startsWith('NYX-')) { setError(T[lang].add_contact.error_format); return; }
        if (id.toLowerCase() === user?.id?.toLowerCase()) { setError(T[lang].add_contact.error_self); return; }

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
                    setError(T[lang].add_contact.error_not_found.replace('{id}', id));
                } else {
                    setError(T[lang].auth.error_network);
                }
                return;
            }

            const result = await response.json();
            if (!result.success) { setError(T[lang].add_contact.error_not_found_short); return; }

            const foundUser = result.data;

            addContact({ userId: foundUser.id, nickname: foundUser.nickname, publicKey: foundUser.publicKey, avatar: foundUser.avatar, addedAt: new Date() });

            const chatRes = await fetch(`${serverUrl}/api/chats/private`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user!.id, contactId: foundUser.id })
            });

            const chatResult = await chatRes.json();
            if (!chatResult.success) throw new Error(T[lang].add_contact.error_create_chat);

            const serverChatId = chatResult.data.chatId;
            const newChat: Chat = {
                id: serverChatId, type: 'private',
                participants: [user!.id, foundUser.id],
                participantDetails: [
                    { id: user!.id, nickname: user!.nickname, avatar: user!.avatar },
                    { id: foundUser.id, nickname: foundUser.nickname, avatar: foundUser.avatar }
                ],
                name: foundUser.nickname, avatar: foundUser.avatar,
                unreadCount: 0, createdAt: new Date()
            };

            const existingInStore = chats.find(c => c.id === serverChatId);
            if (existingInStore) { setActiveChat(existingInStore); }
            else { setChats([...chats, newChat]); setActiveChat(newChat); }

            socketService.joinChat(serverChatId);
            
            // Notify other user about new chat
            socketService.getSocket()?.emit('chat:create', { chat: newChat });

            onClose();
            setContactId('');
            setSearchResults([]);
        } catch (err: any) {
            console.error('Add contact error:', err);
            setError(T[lang].auth.error_network);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = async () => {
        const q = contactId.trim();
        if (q.length < 3) { setError(T[lang].add_contact.error_search_short); return; }
        setError(''); setIsLoading(true);
        try {
            const serverUrl = API_BASE_URL.replace(/\/$/, '');
            const res = await fetch(`${serverUrl}/api/users/search/${encodeURIComponent(q)}`);
            const result = await res.json();
            if (result.success && result.data.length > 0) {
                setSearchResults(result.data);
            } else {
                setSearchResults([]);
                setError(T[lang].add_contact.error_search_not_found);
            }
        } catch { setError(T[lang].add_contact.error_search); }
        finally { setIsLoading(false); }
    };

    const handleCreateGroup = async () => {
        setError('');
        const name = groupName.trim();
        const participants = [...new Set([...selectedContacts, ...manualParticipants])];

        if (!name) { setError('Введите название группы'); return; }
        if (participants.length === 0) { setError('Выберите хотя бы одного участника'); return; }

        setIsLoading(true);
        try {
            const serverUrl = API_BASE_URL.replace(/\/$/, '');
            const response = await fetch(`${serverUrl}/api/chats/group`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    creatorId: user!.id,
                    participants
                })
            });

            if (!response.ok) {
                setError('Не удалось создать группу на сервере');
                return;
            }

            const result = await response.json();
            if (!result.success || !result.data.chatId) {
                setError('Ошибка при создании группы');
                return;
            }

            const serverChatId = result.data.chatId;

            // Gather detailed participants info
            const details = result.data.participants.map((pId: string) => {
                if (pId === user!.id) {
                    return { id: user!.id, nickname: user!.nickname, avatar: user!.avatar };
                }
                const contact = contacts.find(c => c.userId === pId);
                return {
                    id: pId,
                    nickname: contact?.nickname || pId.slice(0, 12),
                    avatar: contact?.avatar
                };
            });

            const newChat: Chat = {
                id: serverChatId,
                type: 'group',
                name: name,
                participants: result.data.participants,
                participantDetails: details,
                unreadCount: 0,
                createdAt: new Date()
            };

            setChats([...chats, newChat]);
            setActiveChat(newChat);
            socketService.joinChat(serverChatId);

            // Notify all other participants about the new group
            socketService.getSocket()?.emit('chat:create', { chat: newChat });

            // Reset states and close
            setGroupName('');
            setSelectedContacts([]);
            setManualParticipants([]);
            setManualParticipantId('');
            onClose();
        } catch (err) {
            console.error('Create group error:', err);
            setError('Ошибка сети при создании группы');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const modal = (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--glass-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', width: '460px', maxWidth: '95vw', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(108,92,231,0.15)', animation: 'slideUp 0.25s ease' }}>

                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>➕ Создать диалог</h2>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
                    <button
                        onClick={() => { setActiveTab('contact'); setError(''); }}
                        style={{
                            flex: 1, padding: '14px', background: 'none', border: 'none',
                            color: activeTab === 'contact' ? 'var(--secondary)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            borderBottom: activeTab === 'contact' ? '3px solid var(--secondary)' : '3px solid transparent',
                            cursor: 'pointer', fontSize: '14px', transition: 'all 0.3s ease'
                        }}
                    >
                        👤 Контакт
                    </button>
                    <button
                        onClick={() => { setActiveTab('group'); setError(''); }}
                        style={{
                            flex: 1, padding: '14px', background: 'none', border: 'none',
                            color: activeTab === 'group' ? 'var(--secondary)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            borderBottom: activeTab === 'group' ? '3px solid var(--secondary)' : '3px solid transparent',
                            cursor: 'pointer', fontSize: '14px', transition: 'all 0.3s ease'
                        }}
                    >
                        👥 Группа
                    </button>
                </div>

                <div style={{ padding: '20px 24px' }}>
                    {error && <div style={{ color: '#ff4757', fontSize: '13px', marginBottom: '14px', padding: '8px 12px', background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.2)', borderRadius: '8px' }}>⚠️ {error}</div>}

                    {activeTab === 'contact' ? (
                        /* Contact Tab */
                        <>
                            {/* Your ID */}
                            <div style={{ background: 'rgba(108,92,231,0.08)', border: '1px solid rgba(108,92,231,0.2)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>{T[lang].add_contact.your_id_tip}</div>
                                <div style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 700, color: '#a29bfe', letterSpacing: '1px' }}>{user?.id}</div>
                                <button onClick={() => { navigator.clipboard.writeText(user?.id || ''); }} style={{ marginTop: '8px', padding: '4px 12px', background: 'rgba(108,92,231,0.2)', border: '1px solid rgba(108,92,231,0.3)', borderRadius: '6px', color: '#a29bfe', cursor: 'pointer', fontSize: '12px' }}>
                                    📋 {T[lang].settings.copy_id}
                                </button>
                            </div>

                            {/* Input */}
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    {T[lang].add_contact.input_label}
                                </label>
                                <input
                                    type="text"
                                    placeholder={T[lang].add_contact.input_placeholder}
                                    value={contactId}
                                    onChange={e => { setContactId(e.target.value); setError(''); setSearchResults([]); }}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                                    autoFocus
                                    style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
                                />
                            </div>

                            {/* Search results */}
                            {searchResults.length > 0 && (
                                <div style={{ marginBottom: '12px' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>{T[lang].add_contact.found}:</div>
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
                            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                                <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px' }}>
                                    {T[lang].sidebar.cancel}
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
                                    {isLoading ? `⏳ ${T[lang].chat.searching}` : `✓ ${T[lang].add_contact.btn_add}`}
                                </button>
                            </div>
                        </>
                    ) : (
                        /* Group Tab */
                        <>
                            {/* Group Name input */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    Название группы
                                </label>
                                <input
                                    type="text"
                                    placeholder="Введите название группы..."
                                    value={groupName}
                                    onChange={e => { setGroupName(e.target.value); setError(''); }}
                                    style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>

                            {/* Contact list with checkboxes */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    Выберите участников из контактов
                                </label>
                                {contacts.length === 0 ? (
                                    <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                        Список контактов пуст. Вы можете добавить участников вручную по ID ниже.
                                    </div>
                                ) : (
                                    <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '8px' }}>
                                        {contacts.map(contact => (
                                            <label key={contact.userId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', cursor: 'pointer', borderRadius: '6px', transition: 'background 0.2s' }} className="checkbox-contact-label">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedContacts.includes(contact.userId)}
                                                    onChange={e => {
                                                        if (e.target.checked) {
                                                            setSelectedContacts([...selectedContacts, contact.userId]);
                                                        } else {
                                                            setSelectedContacts(selectedContacts.filter(id => id !== contact.userId));
                                                        }
                                                    }}
                                                    style={{ accentColor: 'var(--secondary)', width: '16px', height: '16px', cursor: 'pointer' }}
                                                />
                                                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff' }}>
                                                    {contact.nickname[0].toUpperCase()}
                                                </div>
                                                <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {contact.nickname}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Manual participant input */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    Добавить участника по ID (NYX-...)
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        placeholder="NYX-XXXXXXXX"
                                        value={manualParticipantId}
                                        onChange={e => setManualParticipantId(e.target.value)}
                                        style={{ flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
                                    />
                                    <button
                                        onClick={() => {
                                            const id = manualParticipantId.trim();
                                            if (!id) return;
                                            if (!id.startsWith('NYX-')) { alert('ID должен начинаться с NYX-'); return; }
                                            if (id === user?.id) { alert('Это ваш собственный ID!'); return; }
                                            if (manualParticipants.includes(id) || selectedContacts.includes(id)) { alert('Этот участник уже добавлен!'); return; }
                                            setManualParticipants([...manualParticipants, id]);
                                            setManualParticipantId('');
                                        }}
                                        style={{ padding: '10px 14px', background: 'rgba(108,92,231,0.2)', border: '1px solid rgba(108,92,231,0.3)', borderRadius: '8px', color: '#a29bfe', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                    >
                                        Добавить
                                    </button>
                                </div>
                                {manualParticipants.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', maxHeight: '60px', overflowY: 'auto' }}>
                                        {manualParticipants.map(id => (
                                            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(6,214,245,0.12)', border: '1px solid rgba(6,214,245,0.25)', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontFamily: 'monospace', color: 'var(--secondary)' }}>
                                                {id.slice(0, 12)}...
                                                <span onClick={() => setManualParticipants(manualParticipants.filter(x => x !== id))} style={{ cursor: 'pointer', color: '#ff475e', fontWeight: 700 }}>✕</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Buttons */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px' }}>
                                    Отмена
                                </button>
                                <button
                                    onClick={handleCreateGroup}
                                    disabled={isLoading || !groupName.trim() || (selectedContacts.length === 0 && manualParticipants.length === 0)}
                                    style={{ flex: 1, padding: '12px', background: (isLoading || !groupName.trim() || (selectedContacts.length === 0 && manualParticipants.length === 0)) ? 'rgba(124,92,252,0.3)' : 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', border: 'none', borderRadius: '10px', color: '#fff', cursor: (isLoading || !groupName.trim() || (selectedContacts.length === 0 && manualParticipants.length === 0)) ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 700, boxShadow: '0 4px 15px var(--primary-glow)' }}
                                >
                                    {isLoading ? '⏳ Создание...' : '✓ Создать группу'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modal, document.body);
};
