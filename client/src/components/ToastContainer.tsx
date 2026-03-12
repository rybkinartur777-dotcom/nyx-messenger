import React from 'react';
import { useStore } from '../store/useStore';
import { ToastData } from '../types';

export const ToastContainer: React.FC = () => {
    const { toasts, removeToast, setActiveChat, chats, toggleSidebar } = useStore();

    if (toasts.length === 0) return null;

    const handleToastClick = (toast: ToastData) => {
        if (toast.chatId) {
            const chat = chats.find(c => c.id === toast.chatId);
            if (chat) {
                setActiveChat(chat);
                // On mobile, clicking a toast might need to close sidebar
                if (window.innerWidth <= 768) {
                    const { sidebarOpen } = useStore.getState();
                    if (sidebarOpen) toggleSidebar();
                }
            }
        }
        removeToast(toast.id);
    };

    return (
        <div className="toast-container">
            {toasts.map((toast) => (
                <div key={toast.id} className="toast" onClick={() => handleToastClick(toast)}>
                    <div className="toast-avatar">
                        {toast.avatar ? (
                            <img src={toast.avatar} alt="Avatar" />
                        ) : (
                            <div className="toast-avatar-placeholder">
                                {toast.title.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="toast-content">
                        <div className="toast-title">{toast.title}</div>
                        <div className="toast-body">{toast.body}</div>
                    </div>
                    <button
                        className="toast-close"
                        onClick={(e) => {
                            e.stopPropagation();
                            removeToast(toast.id);
                        }}
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
};
