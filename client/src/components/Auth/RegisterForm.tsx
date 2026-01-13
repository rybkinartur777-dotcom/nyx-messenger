import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { cryptoService } from '../../crypto/cryptoService';

export const RegisterForm: React.FC = () => {
    const [nickname, setNickname] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedId, setGeneratedId] = useState<string | null>(null);
    const setUser = useStore((state) => state.setUser);

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
            const { publicKey, privateKey } = cryptoService.generateKeyPair();

            // Store private key securely (in real app, would use secure storage)
            localStorage.setItem('nyx_private_key', privateKey);

            // Create user
            const user = {
                id: userId,
                nickname: nickname.trim(),
                publicKey,
                createdAt: new Date(),
                settings: {
                    allowSearchByNickname: false,
                    autoDeleteMessages: null
                }
            };

            setGeneratedId(userId);
            setUser(user);
        } catch (err) {
            setError('Ошибка при регистрации. Попробуйте снова.');
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
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-logo">
                        <div className="logo-icon">N</div>
                        <div className="logo-text">Nyx</div>
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
        );
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <div className="logo-icon">N</div>
                    <div className="logo-text">Nyx</div>
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
    );
};
