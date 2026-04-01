import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useStore } from '../../store/useStore';
import { T } from '../../locales';
import { PinModal } from '../Auth/PinModal';

export const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { user, lang, setLanguage, stealthMode, toggleStealthMode, theme, setTheme, pinCode, setPinCode } = useStore();
    const [idCopied, setIdCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'privacy' | 'appearance'>('profile');
    const [showPinSetter, setShowPinSetter] = useState(false);

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
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>⚙️ {T[lang].settings.title}</h2>
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
                        { id: 'profile', label: `👤 ${T[lang].settings.profile}` },
                        { id: 'privacy', label: `🛡️ ${T[lang].settings.privacy}` },
                        { id: 'appearance', label: `🎨 ${T[lang].settings.appearance}` }
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
                                marginBottom: '-1px', // overlap the container border
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
                                        {T[lang].settings.anonymous_user}
                                    </div>
                                </div>
                            </div>

                            {/* NYX ID */}
                            <div style={{
                                background: 'rgba(108, 92, 231, 0.08)',
                                border: '1px solid rgba(108, 92, 231, 0.2)',
                                borderRadius: '12px',
                                padding: '16px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                                    {T[lang].settings.your_id}
                                </div>
                                <div style={{
                                    fontFamily: 'monospace',
                                    fontSize: '20px',
                                    fontWeight: 700,
                                    color: '#a29bfe',
                                    letterSpacing: '2px',
                                    marginBottom: '16px',
                                    background: 'rgba(0,0,0,0.2)',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(108, 92, 231, 0.2)'
                                }}>
                                    {user.id}
                                </div>
                                <div style={{ display: 'flex', width: '100%', gap: '8px' }}>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(user.id);
                                            setIdCopied(true);
                                            setTimeout(() => setIdCopied(false), 2000);
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            background: idCopied ? 'rgba(0, 243, 160, 0.2)' : 'rgba(108, 92, 231, 0.2)',
                                            border: `1px solid ${idCopied ? 'rgba(0, 243, 160, 0.4)' : 'rgba(108, 92, 231, 0.3)'}`,
                                            borderRadius: '8px',
                                            color: idCopied ? '#00f3a0' : '#a29bfe',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            transition: 'all 0.2s',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                        }}
                                    >
                                        <span style={{ fontSize: '16px' }}>{idCopied ? '✅' : '📋'}</span>
                                        <span>{idCopied ? T[lang].settings.copied : T[lang].settings.copy_id}</span>
                                    </button>
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '14px' }}>💡</span>
                                    <span>{T[lang].settings.share_tip}</span>
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
                                title={T[lang].settings.stealth_mode}
                                description={T[lang].settings.stealth_desc}
                            >
                                <Toggle checked={stealthMode} onChange={toggleStealthMode} />
                            </SettingsRow>

                            {/* PIN Code Lock */}
                            <SettingsRow
                                icon="🔐"
                                title="PIN-код приложения"
                                description={pinCode ? "Пароль установлен" : "Дополнительная защита для входа"}
                            >
                                <button
                                    onClick={() => setShowPinSetter(true)}
                                    style={{
                                        background: pinCode ? 'rgba(0, 243, 160, 0.15)' : 'rgba(108, 92, 231, 0.15)',
                                        border: '1px solid currentColor',
                                        color: pinCode ? '#00f3a0' : '#a29bfe',
                                        padding: '6px 14px',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {pinCode ? 'Изменить' : 'Установить'}
                                </button>
                            </SettingsRow>
                            
                            {pinCode && (
                                <button 
                                    onClick={() => {
                                        if (window.confirm('Вы уверены, что хотите сбросить PIN-код?')) {
                                            setPinCode(null);
                                        }
                                    }}
                                    style={{
                                        alignSelf: 'flex-start',
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#ff4757',
                                        fontSize: '12px',
                                        marginTop: '-4px',
                                        marginLeft: '16px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Сбросить пароль
                                </button>
                            )}

                            {showPinSetter && (
                                <PinModal 
                                    mode="set" 
                                    onSuccess={() => setShowPinSetter(false)} 
                                    onCancel={() => setShowPinSetter(false)} 
                                />
                            )}

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
                                            {T[lang].settings.e2e_active}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            {T[lang].settings.e2e_desc}
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
                                    {T[lang].settings.theme}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                    {([
                                        { id: 'dark', label: T[lang].settings.theme_dark, icon: '🌑', colors: ['#0a0a0f', '#6c5ce7'] },
                                        { id: 'light', label: T[lang].settings.theme_light, icon: '☀️', colors: ['#f0f2f5', '#4a6ee0'] },
                                        { id: 'cyberpunk', label: T[lang].settings.theme_cyberpunk, icon: '🌆', colors: ['#050508', '#00f3ff', '#ff007f'] },
                                    ] as const).map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setTheme(t.id)}
                                            style={{
                                                minHeight: '84px',
                                                padding: '12px 4px',
                                                background: theme === t.id ? 'rgba(108, 92, 231, 0.15)' : 'rgba(255,255,255,0.04)',
                                                border: `2px solid ${theme === t.id ? '#6c5ce7' : 'rgba(255,255,255,0.08)'}`,
                                                borderRadius: '12px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                color: 'var(--text-primary)',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                transition: 'all 0.2s',
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            <div style={{ display: 'flex', gap: '6px', height: '24px', alignItems: 'center' }}>
                                                {t.colors.map((c, i) => (
                                                    <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: '1px solid rgba(255,255,255,0.15)' }} />
                                                ))}
                                            </div>
                                            <div style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>{t.icon}</span>
                                                <span>{t.label}</span>
                                            </div>
                                            {theme === t.id && <span style={{ position: 'absolute', top: 6, right: 8, color: '#6c5ce7', fontSize: '14px', fontWeight: 'bold' }}>✓</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Language */}
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', marginTop: '8px' }}>
                                    {T[lang].settings.language}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                    {([
                                        { id: 'ru', label: 'Русский', icon: 'RU' },
                                        { id: 'en', label: 'English', icon: 'EN' },
                                        { id: 'uk', label: 'Українська', icon: 'UA' }
                                    ] as const).map(l => (
                                        <button
                                            key={l.id}
                                            onClick={() => setLanguage(l.id as 'ru' | 'en' | 'uk')}
                                            style={{
                                                minHeight: '84px',
                                                padding: '12px 4px',
                                                background: lang === l.id ? 'rgba(108, 92, 231, 0.15)' : 'rgba(255,255,255,0.04)',
                                                border: `2px solid ${lang === l.id ? '#6c5ce7' : 'rgba(255,255,255,0.08)'}`,
                                                borderRadius: '12px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                color: 'var(--text-primary)',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                transition: 'all 0.2s',
                                                position: 'relative'
                                            }}
                                        >
                                            <div style={{ height: '24px', display: 'flex', alignItems: 'center', fontSize: '20px', fontWeight: 800, letterSpacing: '1px' }}>
                                                {l.icon}
                                            </div>
                                            <span style={{ whiteSpace: 'nowrap' }}>{l.label}</span>
                                            {lang === l.id && <span style={{ position: 'absolute', top: 6, right: 8, color: '#6c5ce7', fontSize: '14px', fontWeight: 'bold' }}>✓</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
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
                        {T[lang].settings.version}
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
