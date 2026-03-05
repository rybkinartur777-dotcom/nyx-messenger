import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { cryptoService } from '../../crypto/cryptoService';
import { API_BASE_URL } from '../../config';

export const RegisterForm: React.FC = () => {
    const [nickname, setNickname] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedId, setGeneratedId] = useState<string | null>(null);
    const [selectedAvatar, setSelectedAvatar] = useState('/avatars/avatar1.png');
    const setUser = useStore((state) => state.setUser);

    const AVATARS = [
        '/avatars/avatar1.png',
        '/avatars/avatar2.png',
        '/avatars/avatar3.png',
        '/avatars/avatar4.png',
        '/avatars/avatar5.png',
        '/avatars/avatar6.png',
    ];

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!nickname.trim()) {
            setError('Введите никнейм');
            return;
        }

        if (nickname.length < 3) {
            setError('Никнейм должен быть не менее 3 символов');
            return;
        }

        if (nickname.length > 20) {
            setError('Никнейм должен быть не более 20 символов');
            return;
        }

        setIsLoading(true);

        try {
            // Initialize crypto
            await cryptoService.init();

            // Generate unique ID and key pair
            const userId = cryptoService.generateUserId();
            const { publicKey, privateKey } = await cryptoService.generateKeyPair();

            // Store private key securely
            localStorage.setItem('nyx_private_key', privateKey);

            // Register on server
            const serverUrl = API_BASE_URL.replace(/\/$/, '');
            const response = await fetch(`${serverUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId, nickname: nickname.trim(), publicKey, avatar: selectedAvatar })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Registration failed');
            }

            // Create user locally
            const user = {
                id: userId,
                nickname: nickname.trim(),
                publicKey,
                avatar: selectedAvatar,
                createdAt: new Date(),
                settings: {
                    allowSearchByNickname: false,
                    autoDeleteMessages: null
                }
            };

            setGeneratedId(userId);
            setUser(user);
        } catch (err: any) {
            setGeneratedId(null);
            setError(err.message || 'Ошибка сети. Проверьте соединение.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const copyId = () => {
        if (generatedId) {
            navigator.clipboard.writeText(generatedId);
        }
    };

    if (generatedId) {
        return (
            <div className="app auth-page">
                <div className="stars-container"></div>
                <div className="twinkling"></div>
                <div className="auth-container">
                    <div className="auth-card">
                        <div className="auth-logo">
                            <div style={{ width: '90px', height: '90px', margin: '0 auto 12px', borderRadius: '20px', overflow: 'hidden', filter: 'drop-shadow(0 0 20px rgba(124,106,255,0.7))' }}>
                                <img src="/logo.png" alt="Nyx Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.4)', clipPath: 'inset(16% round 15px)' }} />
                            </div>
                            <div className="logo-text">NYX</div>
                        </div>

                        <h2 style={{ textAlign: 'center', marginBottom: '16px', color: 'var(--success)' }}>
                            ✓ Регистрация завершена!
                        </h2>

                        <div className="user-id-display">
                            <div className="user-id-label">Ваш уникальный ID</div>
                            <div className="user-id-value">{generatedId}</div>
                            <button className="btn btn-secondary user-id-copy" onClick={copyId}>
                                📋 Скопировать ID
                            </button>
                        </div>

                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                            Сохраните этот ID! Он нужен для добавления в контакты.
                        </p>

                        <button
                            className="btn btn-primary auth-submit"
                            onClick={() => window.location.reload()}
                        >
                            Начать общение →
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="app auth-page">
            <div className="stars-container"></div>
            <div className="twinkling"></div>

            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-logo">
                        <div style={{ width: '110px', height: '110px', margin: '0 auto', borderRadius: '24px', overflow: 'hidden', filter: 'drop-shadow(0 0 24px rgba(124,106,255,0.8)) drop-shadow(0 0 48px rgba(0,243,255,0.3))' }}>
                            <img src="/logo.png" alt="Nyx Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.4)', clipPath: 'inset(16% round 18px)' }} />
                        </div>
                        <div className="logo-text" style={{ fontSize: '2.2rem', marginTop: '14px', letterSpacing: '5px' }}>NYX</div>
                    </div>

                    <p className="auth-title">
                        Анонимный защищённый мессенджер
                    </p>

                    <form onSubmit={handleRegister}>
                        <div className="form-group">
                            <label className="form-label">Выберите никнейм</label>
                            <input
                                type="text"
                                className={`form-input ${error ? 'error' : ''}`}
                                placeholder="Ваш никнейм"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                disabled={isLoading}
                                autoFocus
                            />
                            {error && <div className="form-error">{error}</div>}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Выберите аватар</label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', justifyContent: 'center' }}>
                                {AVATARS.map((avatar, index) => (
                                    <img
                                        key={index}
                                        src={avatar}
                                        alt={`Avatar ${index + 1}`}
                                        onClick={() => setSelectedAvatar(avatar)}
                                        style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '50%',
                                            cursor: 'pointer',
                                            border: selectedAvatar === avatar ? '2px solid var(--primary)' : '2px solid transparent',
                                            opacity: selectedAvatar === avatar ? 1 : 0.6,
                                            transition: 'all 0.2s',
                                            objectFit: 'cover'
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div style={{
                            background: 'var(--bg-tertiary)',
                            padding: '12px',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            fontSize: '13px',
                            color: 'var(--text-secondary)'
                        }}>
                            <div className="encryption-badge" style={{ marginBottom: '8px' }}>
                                🔐 E2E шифрование
                            </div>
                            • Без номера телефона и email<br />
                            • Без сбора персональных данных<br />
                            • Уникальный ID генерируется автоматически
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary auth-submit"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <span className="spinner" style={{ width: '20px', height: '20px' }}></span>
                                    Создание...
                                </>
                            ) : (
                                'Создать аккаунт'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
