import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useStore } from '../../store/useStore';
import { T } from '../../locales';
import { PinModal } from '../Auth/PinModal';
import { API_BASE_URL } from '../../config';

export const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { user, lang, setLanguage, stealthMode, toggleStealthMode, theme, setTheme, pinCode, setPinCode, fakePinCode, setFakePinCode, panicWipe, ghostMode, toggleGhostMode, screenSecurity, toggleScreenSecurity, setUser } = useStore();
    const [idCopied, setIdCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'privacy' | 'appearance'>('profile');
    const [showPinSetter, setShowPinSetter] = useState(false);
    const [showFakePinSetter, setShowFakePinSetter] = useState(false);
    const [panicStep, setPanicStep] = useState(0);
    const panicHoldTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    // Profile editing
    const [editingNickname, setEditingNickname] = useState(false);
    const [newNickname, setNewNickname] = useState('');
    const [nicknameError, setNicknameError] = useState('');
    const [nicknameLoading, setNicknameLoading] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [avatarLoading, setAvatarLoading] = useState(false);

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
                                {/* Avatar with edit overlay */}
                                <div
                                    style={{
                                        width: 80, height: 80,
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        border: '3px solid rgba(108, 92, 231, 0.5)',
                                        boxShadow: '0 0 20px rgba(108, 92, 231, 0.3)',
                                        position: 'relative',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => avatarInputRef.current?.click()}
                                    title="Изменить аватар"
                                >
                                    {user.avatar
                                        ? <img src={user.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="avatar" />
                                        : <div style={{
                                            width: '100%', height: '100%',
                                            background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '2rem', fontWeight: 700
                                        }}>{user.nickname[0].toUpperCase()}</div>
                                    }
                                    {/* Hover overlay */}
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: 'rgba(0,0,0,0.45)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        opacity: avatarLoading ? 1 : 0,
                                        transition: 'opacity 0.2s',
                                        fontSize: avatarLoading ? '12px' : '20px'
                                    }}
                                    onMouseEnter={e => { if (!avatarLoading) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                                    onMouseLeave={e => { if (!avatarLoading) (e.currentTarget as HTMLElement).style.opacity = '0'; }}
                                    >
                                        {avatarLoading ? '...' : '📷'}
                                    </div>
                                    <input
                                        ref={avatarInputRef}
                                        type="file" accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file || !user) return;
                                            setAvatarLoading(true);
                                            try {
                                                const reader = new FileReader();
                                                reader.onload = async () => {
                                                    const base64 = reader.result as string;
                                                    const serverUrl = API_BASE_URL.replace(/\/$/, '');
                                                    const res = await fetch(`${serverUrl}/api/users/${user.id}`, {
                                                        method: 'PATCH',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ avatar: base64 })
                                                    });
                                                    const result = await res.json();
                                                    if (result.success) {
                                                        setUser({ ...user, avatar: base64 });
                                                    }
                                                    setAvatarLoading(false);
                                                };
                                                reader.readAsDataURL(file);
                                            } catch {
                                                setAvatarLoading(false);
                                            }
                                            if (avatarInputRef.current) avatarInputRef.current.value = '';
                                        }}
                                    />
                                </div>

                                <div style={{ textAlign: 'center' }}>
                                    {/* Nickname inline editor */}
                                    {editingNickname ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                            <input
                                                autoFocus
                                                value={newNickname}
                                                onChange={e => { setNewNickname(e.target.value); setNicknameError(''); }}
                                                onKeyDown={async e => {
                                                    if (e.key === 'Escape') { setEditingNickname(false); setNicknameError(''); }
                                                }}
                                                maxLength={32}
                                                style={{
                                                    background: 'rgba(255,255,255,0.07)',
                                                    border: `1px solid ${nicknameError ? '#ff4757' : 'rgba(108,92,231,0.5)'}`,
                                                    borderRadius: '10px',
                                                    color: '#fff',
                                                    padding: '8px 14px',
                                                    fontSize: '1.1rem',
                                                    fontWeight: 700,
                                                    textAlign: 'center',
                                                    outline: 'none',
                                                    width: '200px'
                                                }}
                                            />
                                            {nicknameError && <div style={{ fontSize: '11px', color: '#ff4757' }}>{nicknameError}</div>}
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => { setEditingNickname(false); setNicknameError(''); }}
                                                    style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}
                                                >Отмена</button>
                                                <button
                                                    disabled={nicknameLoading || !newNickname.trim()}
                                                    onClick={async () => {
                                                        const trimmed = newNickname.trim();
                                                        if (!trimmed || trimmed.length < 2) { setNicknameError('Мин. 2 символа'); return; }
                                                        setNicknameLoading(true);
                                                        try {
                                                            const serverUrl = API_BASE_URL.replace(/\/$/, '');
                                                            const res = await fetch(`${serverUrl}/api/users/${user.id}`, {
                                                                method: 'PATCH',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ nickname: trimmed })
                                                            });
                                                            const result = await res.json();
                                                            if (result.success) {
                                                                setUser({ ...user, nickname: trimmed });
                                                                setEditingNickname(false);
                                                            } else {
                                                                setNicknameError(result.error === 'Nickname already taken' ? 'Никнейм уже занят' : result.error || 'Ошибка');
                                                            }
                                                        } catch { setNicknameError('Ошибка сети'); }
                                                        setNicknameLoading(false);
                                                    }}
                                                    style={{ padding: '6px 14px', background: nicknameLoading ? 'rgba(108,92,231,0.3)' : '#6c5ce7', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                                >{nicknameLoading ? '...' : 'Сохранить'}</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{user.nickname}</div>
                                            <button
                                                onClick={() => { setNewNickname(user.nickname); setEditingNickname(true); setNicknameError(''); }}
                                                title="Изменить никнейм"
                                                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}
                                            >✏️</button>
                                        </div>
                                    )}
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

                            {/* Ghost Mode */}
                            <SettingsRow
                                icon="👻"
                                title="Режим «Невидимка»"
                                description="Скрывает ваш статус «В сети» от всех пользователей"
                            >
                                <Toggle checked={ghostMode} onChange={toggleGhostMode} />
                            </SettingsRow>

                            {/* Screen Security */}
                            <SettingsRow
                                icon="🛡️"
                                title="Защита экрана"
                                description="Размывать экран при потере фокуса и детектировать скриншоты"
                            >
                                <Toggle checked={screenSecurity} onChange={toggleScreenSecurity} />
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

                            {/* Fake PIN Lock */}
                            <SettingsRow
                                icon="👻"
                                title="Фантомный PIN-код"
                                description={fakePinCode ? "Фантомный PIN установлен" : "Скрывает переписки при вводе фейкового PIN"}
                            >
                                <button
                                    onClick={() => setShowFakePinSetter(true)}
                                    style={{
                                        background: fakePinCode ? 'rgba(0, 243, 160, 0.15)' : 'rgba(108, 92, 231, 0.15)',
                                        border: '1px solid currentColor',
                                        color: fakePinCode ? '#00f3a0' : '#a29bfe',
                                        padding: '6px 14px',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {fakePinCode ? 'Изменить' : 'Установить'}
                                </button>
                            </SettingsRow>
                            
                            {fakePinCode && (
                                <button 
                                    onClick={() => {
                                        if (window.confirm('Вы уверены, что хотите отключить Фантомный учетный профиль?')) {
                                            setFakePinCode(null);
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
                                    Отключить
                                </button>
                            )}

                            {showFakePinSetter && (
                                <div style={{ position: 'fixed', zIndex: 9999999 }}>
                                    <PinModal 
                                        mode="set" 
                                        onPinSet={(pin) => setFakePinCode(pin)}
                                        onSuccess={() => {
                                            setShowFakePinSetter(false)
                                        }} 
                                        onCancel={() => setShowFakePinSetter(false)} 
                                    />
                                </div>
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

                            {/* PANIC BUTTON */}
                            <div style={{
                                marginTop: '12px',
                                background: 'rgba(255, 71, 87, 0.06)',
                                border: '1px solid rgba(255, 71, 87, 0.2)',
                                borderRadius: '12px',
                                padding: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '20px' }}>🚨</span>
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#ff4757', fontSize: '14px', marginBottom: '4px' }}>
                                            Экстренное уничтожение
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            Мгновенно удаляет все чаты, сообщения, контакты и аккаунт с устройства. Данные невозможно восстановить.
                                        </div>
                                    </div>
                                </div>
                                {panicStep === 0 ? (
                                    <button
                                        onClick={() => setPanicStep(1)}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            background: 'rgba(255, 71, 87, 0.15)',
                                            border: '1px solid rgba(255, 71, 87, 0.3)',
                                            borderRadius: '10px',
                                            color: '#ff4757',
                                            fontSize: '14px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <span>💣</span> Кнопка паники
                                    </button>
                                ) : (
                                    <button
                                        onMouseDown={() => {
                                            panicHoldTimerRef.current = setTimeout(() => {
                                                panicWipe();
                                                onClose();
                                            }, 3000);
                                        }}
                                        onMouseUp={() => {
                                            if (panicHoldTimerRef.current) {
                                                clearTimeout(panicHoldTimerRef.current);
                                                panicHoldTimerRef.current = null;
                                            }
                                        }}
                                        onMouseLeave={() => {
                                            if (panicHoldTimerRef.current) {
                                                clearTimeout(panicHoldTimerRef.current);
                                                panicHoldTimerRef.current = null;
                                            }
                                        }}
                                        onTouchStart={() => {
                                            panicHoldTimerRef.current = setTimeout(() => {
                                                panicWipe();
                                                onClose();
                                            }, 3000);
                                        }}
                                        onTouchEnd={() => {
                                            if (panicHoldTimerRef.current) {
                                                clearTimeout(panicHoldTimerRef.current);
                                                panicHoldTimerRef.current = null;
                                            }
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '14px',
                                            background: 'linear-gradient(135deg, #ff4757, #c0392b)',
                                            border: 'none',
                                            borderRadius: '10px',
                                            color: '#fff',
                                            fontSize: '14px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            animation: 'pulse 1s ease infinite',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            boxShadow: '0 0 20px rgba(255, 71, 87, 0.4)'
                                        }}
                                    >
                                        <span>⚠️</span> Удерживайте 3 сек для уничтожения
                                    </button>
                                )}
                                {panicStep === 1 && (
                                    <button
                                        onClick={() => setPanicStep(0)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--text-secondary)',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            padding: '4px'
                                        }}
                                    >
                                        Отмена
                                    </button>
                                )}
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
