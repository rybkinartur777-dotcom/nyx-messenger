import React, { useState } from 'react';
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

        if (contactId.trim().toLowerCase() === user?.id?.toLowerCase()) {
            setError('Нельзя добавить себя (сообщения самому себе будут отображаться только справа)');
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
            const serverUrl = API_BASE_URL.replace(/\/$/, '');
            const targetUrl = `${serverUrl} /api/users / ${contactId} `;

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
                nickname: foundUser.nickname,
                publicKey: foundUser.publicKey,
                avatar: foundUser.avatar,
                addedAt: new Date()
            });

            // Create chat on server
            const chatRes = await fetch(`${serverUrl} /api/chats / private`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user!.id, contactId })
            });

            const chatResult = await chatRes.json();

            if (!chatResult.success) {
                throw new Error('Не удалось создать чат на сервере');
            }

            const serverChatId = chatResult.data.chatId;

            // Create chat locally or use existing
            const newChat: Chat = {
                id: serverChatId,
                type: 'private',
                participants: [user!.id, contactId],
                name: foundUser.nickname,
                avatar: foundUser.avatar,
                unreadCount: 0,
                createdAt: new Date()
            };

            const existingInStore = chats.find(c => c.id === serverChatId);
            if (existingInStore) {
                setActiveChat(existingInStore);
            } else {
                setChats([...chats, newChat]);
                setActiveChat(newChat);
            }

            // Tell server to join this chat room
            socketService.joinChat(serverChatId);

            onClose();
            setContactId('');
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
                        className={`form - input ${error ? 'error' : ''} `}
                        placeholder="NYX-XXXXXXXX"
                        value={contactId}
                        onChange={(e) => setContactId(e.target.value.trim())}
                    />
                    {error && <div className="form-error">{error}</div>}
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
