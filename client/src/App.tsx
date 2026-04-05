import React, { useState, useEffect } from 'react';
import { useStore } from './store/useStore';
import { cryptoService } from './crypto/cryptoService';
import { RegisterForm } from './components/Auth/RegisterForm';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatWindow } from './components/Chat/ChatWindow';
import { AddContactModal } from './components/Contacts/AddContactModal';
import { socketService } from './socket/socketService';
import { API_BASE_URL } from './config';
import { T } from './locales';
import { StarField } from './components/StarField';
import { ToastContainer } from './components/ToastContainer';
import { setupWebPush } from './socket/pushService';
import { PinModal } from './components/Auth/PinModal';

const App: React.FC = () => {
    const { isAuthenticated, user, setChats, chats, theme, lang, pinCode, isLocked, setLocked, isFakeMode, screenSecurity, addToast } = useStore();
    const [isLoading, setIsLoading] = useState(true);
    const [showAddContact, setShowAddContact] = useState(false);
    const [isNinjaMode, setIsNinjaMode] = useState(false);
    const [isBlurred, setIsBlurred] = useState(false);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme || 'dark');
    }, [theme]);

    useEffect(() => {
        const initApp = async () => {
            try {
                await cryptoService.init();

                // Request push notification permission
                socketService.requestNotificationPermission();

                // Check for stored keys
                const privateKey = localStorage.getItem('nyx_private_key');
                const publicKey = localStorage.getItem('nyx_public_key');
                if (privateKey && publicKey) {
                    await cryptoService.loadKeyPair(publicKey, privateKey);
                }

                if (user?.id) {
                    if (!isFakeMode) {
                        socketService.connect(user.id);
                        // Initialize background Web Push notifications
                        setupWebPush(user.id);
                    } else {
                        socketService.disconnect();
                    }
                    if (pinCode) setLocked(true);
                }
            } catch (err) {
                console.error('Failed to initialize crypto:', err);
            } finally {
                setIsLoading(false);
            }
        };

        initApp();
    }, [user, setChats, isFakeMode]);

    // Ninja Mode logic
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isNinjaMode) {
                setIsNinjaMode(false);
                return;
            }
            // Ctrl + Shift + H for Ninja Mode
            if (e.ctrlKey && e.shiftKey && (e.key === 'H' || e.key === 'h' || e.key === 'р' || e.key === 'Р')) {
                setIsNinjaMode(true);
            }
        };

        const idleTimer = setTimeout(() => {
            if (isAuthenticated && !isNinjaMode) {
                if (pinCode) {
                    setLocked(true);
                } else {
                    setIsNinjaMode(true);
                }
            }
        }, 5 * 60 * 1000); // 5 minutes idle

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('mousemove', () => clearTimeout(idleTimer));

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            clearTimeout(idleTimer);
        };
    }, [isNinjaMode, isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated || !user?.id || isFakeMode) return;

        const fetchChats = async () => {
            try {
                const serverUrl = API_BASE_URL.replace(/\/$/, '');
                const response = await fetch(`${serverUrl}/api/chats/user/${user.id}`);
                const result = await response.json();

                if (result.success) {
                    setChats(result.data);
                }
            } catch (err) {
                console.error('Failed to fetch chats:', err);
            }
        };

        fetchChats();
    }, [isAuthenticated, user?.id, setChats]);

    // App Badge API
    useEffect(() => {
        if ('setAppBadge' in navigator && isAuthenticated) {
            const totalUnread = chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
            if (totalUnread > 0) {
                navigator.setAppBadge(totalUnread).catch(e => console.error('Failed to set app badge', e));
            } else {
                navigator.clearAppBadge().catch(e => console.error('Failed to clear app badge', e));
            }
        }
    }, [chats, isAuthenticated]);

    // Handle screen security (blur on focus loss & screenshot detection)
    useEffect(() => {
        if (!screenSecurity) {
            setIsBlurred(false);
            return;
        }

        const handleBlur = () => setIsBlurred(true);
        const handleFocus = () => setIsBlurred(false);
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                setIsBlurred(true);
            } else {
                setIsBlurred(false);
            }
        };

        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 'p')) {
                addToast({
                    title: '⚠️ Безопасность',
                    body: 'Скриншот контента может скомпрометировать вашу приватность.',
                });
            }
        };

        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('keydown', handleKeydown);

        return () => {
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('keydown', handleKeydown);
        };
    }, [screenSecurity, addToast]);

    if (isLoading) {
        return (
            <div className="auth-container">
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    <p style={{ color: 'var(--text-secondary)' }}>Инициализация шифрования...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <RegisterForm />;
    }

    if (pinCode && isLocked) {
        return <PinModal mode="unlock" onSuccess={() => setLocked(false)} onCancel={() => {}} />;
    }

    return (
        <div className={`app-container ${theme} ${isBlurred ? 'privacy-blurred' : ''}`}>
            <StarField />
            
            <div style={isBlurred ? { filter: 'blur(30px)', transition: 'filter 0.3s' } : { transition: 'filter 0.3s' }}>
                <Sidebar onAddContact={() => setShowAddContact(true)} />
                <ChatWindow />
                <ToastContainer />
            </div>

            {showAddContact && (
                <AddContactModal
                    isOpen={showAddContact}
                    onClose={() => setShowAddContact(false)}
                />
            )}

            {isNinjaMode && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                        background: 'rgba(10, 10, 15, 0.95)', backdropFilter: 'blur(40px)',
                        zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#4e54c8', fontSize: '1.5rem', fontWeight: 'bold', cursor: 'pointer'
                    }}
                    onClick={() => setIsNinjaMode(false)}
                >
                    <div className="ninja-lock-content">
                        🔒 {T[lang].chat.ninja_locked}
                    </div>
                </div>
            )}

            <ToastContainer />
        </div>
    );
};

export default App;
