import React from 'react';
export const EncryptionInfoModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', filter: 'drop-shadow(0 0 15px rgba(0, 243, 160, 0.4))' }}>
                    🔐
                </div>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: 'var(--success)' }}>
                    End-to-End Encryption
                </h2>
                <div style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
                    Messages are encrypted on your device and can only be read by the recipient.
                    Nyx Messenger cannot read your messages or see your files.
                </div>
                <button
                    className="btn btn-primary"
                    onClick={onClose}
                    style={{ width: '100%' }}
                >
                    OK
                </button>
            </div>
        </div>
    );
};
