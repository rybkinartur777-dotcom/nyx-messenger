import React, { useState } from 'react';
import { useStore } from '../../store/useStore';

export const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { user, lang, setLanguage, stealthMode, toggleStealthMode } = useStore();
    const [idCopied, setIdCopied] = useState(false);

    if (!isOpen || !user) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                <div className="modal-header">
                    <h2 className="modal-title">Профиль и Настройки</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
                    <div className="avatar" style={{ width: '80px', height: '80px', fontSize: '2rem', marginBottom: '12px', padding: user.avatar ? 0 : undefined, overflow: 'hidden' }}>
                        {user.avatar ? (
                            <img src={user.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            user.nickname ? user.nickname[0].toUpperCase() : '?'
                        )}
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{user.nickname}</div>

                    <div className="user-id-display" style={{ marginTop: '12px', width: '100%' }}>
                        <div className="user-id-label">Ваш Nyx ID</div>
                        <div className="user-id-value" style={{ fontSize: '14px' }}>{user.id}</div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
                            <button className="btn btn-secondary" onClick={() => {
                                navigator.clipboard.writeText(user.id);
                                setIdCopied(true);
                                setTimeout(() => setIdCopied(false), 2000);
                            }} style={{ padding: '8px 16px', fontSize: '12px' }}>
                                📋 {idCopied ? 'Скопировано!' : 'Копировать ID'}
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '12px' }}>
                                🔗 Поделиться (QRC)
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontWeight: 600 }}>🥷 Stealth Mode</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Скрывает статус онлайн и отчеты о прочтении</div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={stealthMode}
                                onChange={toggleStealthMode}
                                style={{ transform: 'scale(1.2)' }}
                            />
                        </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontWeight: 600 }}>🌐 Язык интерфейса</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>English / Русский</div>
                        </div>
                        <select
                            value={lang}
                            onChange={(e) => setLanguage(e.target.value as 'ru' | 'en')}
                            style={{ padding: '6px', background: 'var(--bg-secondary)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                        >
                            <option value="ru">Русский</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};
