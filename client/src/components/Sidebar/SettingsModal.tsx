import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useStore } from '../../store/useStore';

export const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { user, lang, setLanguage, stealthMode, toggleStealthMode, theme, setTheme } = useStore();
    const [idCopied, setIdCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'privacy' | 'appearance'>('profile');

    if (!isOpen || !user) return null;

    const modal = (
        <div
            className="modal-overlay"
            onClick={onClose}
            style={{
                position: 'fixed',
                top: 0, left: 0,
                width: '100vw', height: '100vh',
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(8px)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'fadeIn 0.2s ease'
            }}
        >
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px',
                    width: '480px',
                    maxWidth: '95vw',
                    maxHeight: '85vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(108, 92, 231, 0.15)',
                    animation: 'slideUp 0.25s ease'
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px 24px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)'
                }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>⚙️ Настройки</h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: 'none',
                            color: '#fff',
                            width: 32, height: 32,
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '16px',
                            transition: 'background 0.2s'
                        }}
                    >✕</button>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    padding: '12px 24px 0',
                    gap: '4px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)'
                }}>
                    {([
                        { id: 'profile', label: '👤 Профиль' },
                        { id: 'privacy', label: '🛡️ Приватность' },
                        { id: 'appearance', label: '🎨 Вид' }
                    ] as const).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                background: activeTab === tab.id ? 'rgba(108, 92, 231, 0.2)' : 'transparent',
                                border: 'none',
                                color: activeTab === tab.id ? '#a29bfe' : 'var(--text-secondary)',
                                padding: '8px 14px',
                                borderRadius: '8px 8px 0 0',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: activeTab === tab.id ? 600 : 400,
                                borderBottom: activeTab === tab.id ? '2px solid #a29bfe' : '2px solid transparent',
                                transition: 'all 0.2s'
                            }}
                        >{tab.label}</button>
                    ))}
                </div>

                {/* Body */}
                <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>

                    {/* PROFILE TAB */}
                    {activeTab === 'profile' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Avatar + Name */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: 80, height: 80,
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    border: '3px solid rgba(108, 92, 231, 0.5)',
                                    boxShadow: '0 0 20px rgba(108, 92, 231, 0.3)'
                                }}>
                                    {user.avatar
                                        ? <img src={user.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <div style={{
                                            width: '100%', height: '100%',
                                            background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '2rem', fontWeight: 700
                                        }}>{user.nickname[0].toUpperCase()}</div>
                                    }
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{user.nickname}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        Анонимный пользователь
                                    </div>
                                </div>
                            </div>

                            {/* NYX ID */}
                            <div style={{
                                background: 'rgba(108, 92, 231, 0.08)',
                                border: '1px solid rgba(108, 92, 231, 0.2)',
                                borderRadius: '12px',
                                padding: '16px'
                            }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                                    Ваш Nyx ID
                                </div>
                                <div style={{
                                    fontFamily: 'monospace',
                                    fontSize: '18px',
                                    fontWeight: 700,
                                    color: '#a29bfe',
                                    letterSpacing: '2px',
                                    marginBottom: '12px'
                                }}>
                                    {user.id}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(user.id);
                                            setIdCopied(true);
                                            setTimeout(() => setIdCopied(false), 2000);
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '8px',
                                            background: idCopied ? 'rgba(0, 243, 160, 0.2)' : 'rgba(108, 92, 231, 0.2)',
                                            border: `1px solid ${idCopied ? 'rgba(0, 243, 160, 0.4)' : 'rgba(108, 92, 231, 0.3)'}`,
                                            borderRadius: '8px',
                                            color: idCopied ? '#00f3a0' : '#a29bfe',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {idCopied ? '✅ Скопировано!' : '📋 Копировать ID'}
                                    </button>
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    💡 Поделитесь этим ID с друзьями для начала чата
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PRIVACY TAB */}
                    {activeTab === 'privacy' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Stealth Mode */}
                            <SettingsRow
                                icon="🥷"
                                title="Stealth Mode"
                                description="Скрывает статус онлайн и отчёты о прочтении"
                            >
                                <Toggle checked={stealthMode} onChange={toggleStealthMode} />
                            </SettingsRow>

                            {/* E2E info */}
                            <div style={{
                                background: 'rgba(0, 243, 160, 0.05)',
                                border: '1px solid rgba(0, 243, 160, 0.15)',
                                borderRadius: '12px',
                                padding: '16px'
                            }}>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '20px' }}>🔐</span>
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#00f3a0', fontSize: '14px', marginBottom: '4px' }}>
                                            Сквозное шифрование активно
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            Все сообщения шифруются на вашем устройстве. Сервер не может прочитать ваши переписки.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* APPEARANCE TAB */}
                    {activeTab === 'appearance' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Theme */}
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                                    Тема оформления
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                    {([
                                        { id: 'dark', label: '🌑 Чёрная', colors: ['#0a0a0f', '#6c5ce7'] },
                                        { id: 'light', label: '☀️ Белая', colors: ['#f0f2f5', '#4a6ee0'] },
                                        { id: 'cyberpunk', label: '🌆 Киберпанк', colors: ['#050508', '#00f3ff', '#ff007f'] },
                                    ] as const).map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setTheme(t.id)}
                                            style={{
                                                padding: '12px',
                                                background: theme === t.id ? 'rgba(108, 92, 231, 0.15)' : 'rgba(255,255,255,0.04)',
                                                border: `2px solid ${theme === t.id ? '#6c5ce7' : 'rgba(255,255,255,0.08)'}`,
                                                borderRadius: '12px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                color: '#fff',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                {t.colors.map((c, i) => (
                                                    <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: '1px solid rgba(255,255,255,0.2)' }} />
                                                ))}
                                            </div>
                                            {t.label}
                                            {theme === t.id && <span style={{ marginLeft: 'auto', color: '#6c5ce7' }}>✓</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Language */}
                            <SettingsRow
                                icon="🌐"
                                title="Язык интерфейса"
                                description="Язык всех надписей в приложении"
                            >
                                <select
                                    value={lang}
                                    onChange={e => setLanguage(e.target.value as 'ru' | 'en')}
                                    style={{
                                        padding: '6px 10px',
                                        background: 'rgba(255,255,255,0.08)',
                                        color: 'white',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '13px'
                                    }}
                                >
                                    <option value="ru">🇷🇺 Русский</option>
                                    <option value="en">🇺🇸 English</option>
                                </select>
                            </SettingsRow>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    justifyContent: 'center'
                }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Nyx Messenger v2.0 • E2E Encrypted
                    </div>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modal, document.body);
};

// Helper components
const SettingsRow: React.FC<{
    icon: string;
    title: string;
    description: string;
    children: React.ReactNode;
}> = ({ icon, title, description, children }) => (
    <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 16px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.05)'
    }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '20px' }}>{icon}</span>
            <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{description}</div>
            </div>
        </div>
        {children}
    </div>
);

const Toggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
    <button
        onClick={onChange}
        style={{
            width: 44, height: 24,
            borderRadius: 12,
            border: 'none',
            background: checked ? '#6c5ce7' : 'rgba(255,255,255,0.15)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s',
            flexShrink: 0
        }}
    >
        <div style={{
            position: 'absolute',
            top: 2,
            left: checked ? 22 : 2,
            width: 20, height: 20,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
        }} />
    </button>
);
