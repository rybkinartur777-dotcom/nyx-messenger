import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Chat } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { socketService } from '../../socket/socketService';

interface AddContactModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AddContactModal: React.FC<AddContactModalProps> = ({ isOpen, onClose }) => {
    const [contactId, setContactId] = useState('');
    const [contactName, setContactName] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { user, chats, setChats, setActiveChat, addContact } = useStore();

    const handleAdd = async () => {
        setError('');

        if (!contactId.trim()) {
            setError('Введите ID контакта');
            return;
        }

        if (!contactId.startsWith('NYX-')) {
            setError('ID должен начинаться с NYX-');
            return;
        }

        if (contactId === user?.id) {
            setError('Нельзя добавить себя');
            return;
        }

        // Check if contact already exists
        const existingChat = chats.find(c =>
            c.type === 'private' && c.participants.includes(contactId)
        );

        if (existingChat) {
            setActiveChat(existingChat);
            onClose();
            return;
        }

        setIsLoading(true);

        try {
            const baseUrl = (import.meta as any).env.VITE_SERVER_URL || 'http://localhost:4000';
            const serverUrl = baseUrl.replace(/\/$/, '');
            const targetUrl = `${serverUrl}/api/users/${contactId}`;

            console.log('🔍 Searching for user:', targetUrl);

            const response = await fetch(targetUrl);

            if (!response.ok) {
                const text = await response.text();
                console.error('❌ Server error response:', text);
                try {
                    const errorJson = JSON.parse(text);
                    setError(errorJson.error || 'Пользователь не найден');
                } catch (e) {
                    setError('Ошибка сервера при поиске');
                }
                return;
            }

            const result = await response.json();

            if (!result.success) {
                setError('Пользователь не найден');
                return;
            }

            const foundUser = result.data;

            // Add contact
            addContact({
                userId: foundUser.id,
                nickname: contactName || foundUser.nickname,
                publicKey: foundUser.publicKey,
                addedAt: new Date()
            });

            // Create chat
            const newChat: Chat = {
                id: uuidv4(),
                type: 'private',
                participants: [user!.id, contactId],
                name: contactName || foundUser.nickname,
                unreadCount: 0,
                createdAt: new Date()
            };

            setChats([...chats, newChat]);
            setActiveChat(newChat);

            // Tell server to join this chat room
            socketService.joinChat(newChat.id);

            onClose();
            setContactId('');
            setContactName('');
        } catch (err: any) {
            console.error('🔍 Search error details:', err);
            setError('Ошибка сети или сервера');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Добавить контакт</h2>
                    <div className="modal-close" onClick={onClose}>✕</div>
                </div>

                <div className="form-group">
                    <label className="form-label">ID контакта *</label>
                    <input
                        type="text"
                        className={`form-input ${error ? 'error' : ''}`}
                        placeholder="NYX-XXXXXXXX"
                        value={contactId}
                        onChange={(e) => setContactId(e.target.value.toUpperCase())}
                    />
                    {error && <div className="form-error">{error}</div>}
                </div>

                <div className="form-group">
                    <label className="form-label">Имя контакта (необязательно)</label>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Как назвать контакт?"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                    />
                </div>

                <div style={{
                    background: 'var(--bg-tertiary)',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)'
                }}>
                    💡 Попросите собеседника поделиться своим ID из профиля
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
                        Отмена
                    </button>
                    <button
                        className="btn btn-primary"
                        style={{ flex: 1 }}
                        onClick={handleAdd}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Добавление...' : 'Добавить'}
                    </button>
                </div>
            </div>
        </div>
    );
};
