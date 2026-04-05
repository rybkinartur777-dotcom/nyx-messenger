import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useStore } from '../../store/useStore';

interface PinModalProps {
    mode: 'set' | 'unlock';
    onSuccess: () => void;
    onCancel?: () => void;
    onPinSet?: (pin: string) => void; // Used to override default setPinCode
}

export const PinModal: React.FC<PinModalProps> = ({ mode, onSuccess, onCancel, onPinSet }) => {
    const { pinCode, fakePinCode, setPinCode, setLocked, setFakeMode } = useStore();
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState(1);
    const [error, setError] = useState('');

    const handleKeyClick = (num: string) => {
        if (pin.length < 4) {
            setPin(p => p + num);
            setError('');
        }
    };

    const handleDelete = () => {
        setPin(p => p.slice(0, -1));
        setError('');
    };

    useEffect(() => {
        if (pin.length === 4) {
            if (mode === 'unlock') {
                if (pin === pinCode) {
                    setLocked(false);
                    setFakeMode(false);
                    onSuccess();
                } else if (fakePinCode && pin === fakePinCode) {
                    setLocked(false);
                    setFakeMode(true);
                    useStore.getState().setActiveChat(null);
                    onSuccess();
                } else {
                    setError('Неверный PIN-код');
                    setPin('');
                }
            } else if (mode === 'set') {
                if (step === 1) {
                    setConfirmPin(pin);
                    setPin('');
                    setStep(2);
                } else {
                    if (pin === confirmPin) {
                        if (onPinSet) {
                            onPinSet(pin);
                        } else {
                            setPinCode(pin);
                        }
                        onSuccess();
                    } else {
                        setError('PIN-коды не совпадают');
                        setPin('');
                        setStep(1);
                    }
                }
            }
        }
    }, [pin, mode, pinCode, fakePinCode, step, confirmPin, onSuccess, setPinCode, setLocked, setFakeMode, onPinSet]);

    const content = (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(10, 10, 15, 0.98)', backdropFilter: 'blur(20px)',
            zIndex: 100000, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', color: '#fff'
        }}>
            <div style={{ marginBottom: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
                <h2 style={{ fontSize: '20px', fontWeight: 600 }}>
                    {mode === 'unlock' ? 'Введите PIN-код для входа' : 
                     step === 1 ? 'Установите новый PIN-код' : 'Подтвердите PIN-код'}
                </h2>
                {error && <div style={{ color: '#ff4757', marginTop: '10px', fontSize: '14px' }}>{error}</div>}
            </div>

            {/* Dots */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '50px' }}>
                {[1, 2, 3, 4].map(idx => (
                    <div key={idx} style={{
                        width: '15px', height: '15px', borderRadius: '50%',
                        background: pin.length >= idx ? 'var(--primary, #7c6aff)' : 'rgba(255,255,255,0.1)',
                        boxShadow: pin.length >= idx ? '0 0 10px var(--primary-glow)' : 'none',
                        transition: 'all 0.2s'
                    }} />
                ))}
            </div>

            {/* Keypad */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 80px)', gap: '20px',
                justifyContent: 'center'
            }}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                    <button key={num} onClick={() => handleKeyClick(num)} style={keyStyle}>{num}</button>
                ))}
                <div />
                <button onClick={() => handleKeyClick('0')} style={keyStyle}>0</button>
                <button onClick={handleDelete} style={{...keyStyle, fontSize: '18px'}}>⌫</button>
            </div>

            {onCancel && (
                <button 
                    onClick={onCancel}
                    style={{
                        marginTop: '40px', background: 'transparent', border: 'none',
                        color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px'
                    }}
                >
                    Отмена
                </button>
            )}
        </div>
    );

    return ReactDOM.createPortal(content, document.body);
};

const keyStyle: React.CSSProperties = {
    width: '80px', height: '80px', borderRadius: '50%',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', fontSize: '24px', fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s'
};
