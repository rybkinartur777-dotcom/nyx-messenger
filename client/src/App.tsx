import React, { useState, useEffect } from 'react';
import { useStore } from './store/useStore';
import { cryptoService } from './crypto/cryptoService';
import { RegisterForm } from './components/Auth/RegisterForm';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatWindow } from './components/Chat/ChatWindow';
import { AddContactModal } from './components/Contacts/AddContactModal';
import { socketService } from './socket/socketService';
import { API_BASE_URL } from './config';

const App: React.FC = () => {
    const { isAuthenticated, user, setChats, theme } = useStore();
    const [isLoading, setIsLoading] = useState(true);
    const [showAddContact, setShowAddContact] = useState(false);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme || 'dark');
    }, [theme]);

    useEffect(() => {
        const initApp = async () => {
            try {
                await cryptoService.init();

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
            <Sidebar onAddContact={() => setShowAddContact(true)} />
            <ChatWindow />
            <AddContactModal
                isOpen={showAddContact}
                onClose={() => setShowAddContact(false)}
            />
        </div>
    );
};

export default App;
