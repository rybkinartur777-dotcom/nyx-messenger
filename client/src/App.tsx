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

const App: React.FC = () => {
    const { isAuthenticated, user, setChats, theme, lang } = useStore();
    const [isLoading, setIsLoading] = useState(true);
    const [showAddContact, setShowAddContact] = useState(false);
    const [isNinjaMode, setIsNinjaMode] = useState(false);

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
                    socketService.connect(user.id);
                }
            } catch (err) {
                console.error('Failed to initialize crypto:', err);
            } finally {
                setIsLoading(false);
            }
        };

        initApp();
    }, [user, setChats]);

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
                setIsNinjaMode(true);
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
        if (!isAuthenticated || !user?.id) return;

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

    return (
        <div className="app">
            <div className="stars-container"></div>
            <div className="twinkling"></div>

            <Sidebar onAddContact={() => setShowAddContact(true)} />
            <ChatWindow />
            <AddContactModal
                isOpen={showAddContact}
                onClose={() => setShowAddContact(false)}
            />

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
                        🔒 {T[lang].ninjaLockedText}
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
