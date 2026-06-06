import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { callService } from '../../socket/callService';
import '../../styles/calling.css';

export const CallOverlay: React.FC = () => {
    const { activeCall, localStream, remoteStream } = useStore();
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isCamOff, setIsCamOff] = useState(false);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    // Call duration timer
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (activeCall?.status === 'connected') {
            setDuration(0);
            timer = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } else {
            setDuration(0);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [activeCall?.status]);

    // Feed streams to HTML video elements
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    // Reset local component states when call session closes
    useEffect(() => {
        if (!activeCall) {
            setIsMuted(false);
            setIsCamOff(false);
        }
    }, [activeCall]);

    if (!activeCall) return null;

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getInitials = (name: string) => {
        return name ? name.slice(0, 2).toUpperCase() : '??';
    };

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
        }
    };

    const toggleCamera = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsCamOff(!isCamOff);
        }
    };

    const handleAccept = () => {
        callService.acceptCall();
    };

    const handleReject = () => {
        callService.rejectCall();
    };

    const handleHangup = () => {
        callService.hangupCall();
    };

    // Render helper for peer avatar
    const renderAvatar = () => {
        if (activeCall.peerAvatar) {
            return <img src={activeCall.peerAvatar} alt={activeCall.peerName} className="call-avatar" />;
        }
        return (
            <div className="call-avatar-placeholder">
                {getInitials(activeCall.peerName)}
            </div>
        );
    };

    const isVideoCall = activeCall.type === 'video';
    const isConnected = activeCall.status === 'connected';
    const isIncoming = activeCall.direction === 'incoming';
    const isRinging = activeCall.status === 'ringing';

    // Icons SVG elements
    const MicIcon = () => (
        <svg viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
    );

    const MicMutedIcon = () => (
        <svg viewBox="0 0 24 24">
            <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.92 1.92c-.78.49-1.69.78-2.67.84V21h-2v-3.08c-3.39-.49-6-3.39-6-6.92h2c0 2.76 2.24 5 5 5 .91 0 1.76-.25 2.5-.67l4.27 4.27L21 20.73 4.27 3z"/>
        </svg>
    );

    const CamIcon = () => (
        <svg viewBox="0 0 24 24">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
        </svg>
    );

    const CamOffIcon = () => (
        <svg viewBox="0 0 24 24">
            <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-1.73l4.27 4.27L22 20.73 3.27 2z"/>
        </svg>
    );

    const PhoneIcon = () => (
        <svg viewBox="0 0 24 24">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.21a.96.96 0 0 0 .25-1.02c-.36-1.11-.56-2.3-.56-3.53C8.58 3.45 8.13 3 7.58 3H4.03C3.48 3 3 3.45 3 4.01c0 9.37 7.63 17 17 17 .56 0 1.01-.45 1.01-1.01v-3.58c0-.56-.45-1.03-1-1.03z"/>
        </svg>
    );

    const HangupIcon = () => (
        <svg viewBox="0 0 24 24" style={{ transform: 'rotate(135deg)' }}>
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.21a.96.96 0 0 0 .25-1.02c-.36-1.11-.56-2.3-.56-3.53C8.58 3.45 8.13 3 7.58 3H4.03C3.48 3 3 3.45 3 4.01c0 9.37 7.63 17 17 17 .56 0 1.01-.45 1.01-1.01v-3.58c0-.56-.45-1.03-1-1.03z"/>
        </svg>
    );

    // 1. Ringing or Incoming layout
    if (isRinging) {
        return (
            <div className="call-overlay-container">
                <div style={{ flex: 1 }} />
                
                <div className="call-card">
                    <div className="call-card-content">
                        <div className="call-avatar-wrapper">
                            <div className="pulse-ring pulse-ring-1"></div>
                            <div className="pulse-ring pulse-ring-2"></div>
                            <div className="pulse-ring pulse-ring-3"></div>
                            {renderAvatar()}
                        </div>
                        <h2 className="call-peer-name">{activeCall.peerName}</h2>
                        <p className="call-status">
                            {isIncoming 
                                ? `${isVideoCall ? 'Видеозвонок' : 'Аудиозвонок'}...` 
                                : 'Вызов...'
                            }
                        </p>
                    </div>
                </div>

                <div style={{ flex: 1 }} />

                <div className="call-actions-panel">
                    {isIncoming ? (
                        <>
                            <button onClick={handleAccept} className="btn-call-action btn-call-accept" title="Принять">
                                <PhoneIcon />
                            </button>
                            <button onClick={handleReject} className="btn-call-action btn-call-reject" title="Отклонить">
                                <HangupIcon />
                            </button>
                        </>
                    ) : (
                        <button onClick={handleHangup} className="btn-call-action btn-call-reject" title="Отмена">
                            <HangupIcon />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // 2. Connected Video Call layout
    if (isVideoCall && isConnected) {
        return (
            <div className="call-overlay-container video-layout">
                <div className="video-grid">
                    {/* Remote video stream */}
                    <div className="remote-video-container">
                        {remoteStream ? (
                            <video 
                                ref={remoteVideoRef} 
                                className="remote-video" 
                                autoPlay 
                                playsInline 
                            />
                        ) : (
                            <div className="video-fallback-avatar">
                                {renderAvatar()}
                                <div className="video-fallback-text">Ожидание видео от собеседника...</div>
                            </div>
                        )}
                    </div>

                    {/* Local video stream (Picture in Picture) */}
                    <div className="local-video-container">
                        {!isCamOff && localStream ? (
                            <video 
                                ref={localVideoRef} 
                                className="local-video" 
                                autoPlay 
                                playsInline 
                                muted 
                            />
                        ) : (
                            <div className="video-fallback-avatar" style={{ background: '#111' }}>
                                <span style={{ fontSize: '1.5rem' }}>{getInitials(useStore.getState().user?.nickname || '')}</span>
                                <div className="video-fallback-text" style={{ fontSize: '0.7rem' }}>Камера выкл.</div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="call-actions-panel">
                    <button 
                        onClick={toggleMute} 
                        className={`btn-call-action btn-call-control ${isMuted ? 'active-off' : ''}`}
                        title={isMuted ? "Включить микрофон" : "Выключить микрофон"}
                    >
                        {isMuted ? <MicMutedIcon /> : <MicIcon />}
                    </button>
                    <button 
                        onClick={toggleCamera} 
                        className={`btn-call-action btn-call-control ${isCamOff ? 'active-off' : ''}`}
                        title={isCamOff ? "Включить камеру" : "Выключить камеру"}
                    >
                        {isCamOff ? <CamOffIcon /> : <CamIcon />}
                    </button>
                    <button onClick={handleHangup} className="btn-call-action btn-call-reject" title="Завершить звонок">
                        <HangupIcon />
                    </button>
                </div>
            </div>
        );
    }

    // 3. Connected Audio Call layout
    return (
        <div className="call-overlay-container">
            <div style={{ flex: 1 }} />

            <div className="call-card">
                <div className="call-card-content">
                    <div className="call-avatar-wrapper">
                        {/* Audio wave effect around avatar */}
                        <div className="pulse-ring pulse-ring-1" style={{ animationDuration: '3s' }}></div>
                        <div className="pulse-ring pulse-ring-2" style={{ animationDuration: '3s' }}></div>
                        {renderAvatar()}
                    </div>
                    <h2 className="call-peer-name">{activeCall.peerName}</h2>
                    <p className="call-status">Звонок подключен</p>
                    
                    <div className="audio-waves-container">
                        <div className="audio-wave-bar"></div>
                        <div className="audio-wave-bar"></div>
                        <div className="audio-wave-bar"></div>
                        <div className="audio-wave-bar"></div>
                        <div className="audio-wave-bar"></div>
                    </div>

                    <div className="call-timer">
                        {formatDuration(duration)}
                    </div>
                </div>
            </div>

            <div style={{ flex: 1 }} />

            <div className="call-actions-panel">
                <button 
                    onClick={toggleMute} 
                    className={`btn-call-action btn-call-control ${isMuted ? 'active-off' : ''}`}
                    title={isMuted ? "Включить микрофон" : "Выключить микрофон"}
                >
                    {isMuted ? <MicMutedIcon /> : <MicIcon />}
                </button>
                <button onClick={handleHangup} className="btn-call-action btn-call-reject" title="Завершить звонок">
                    <HangupIcon />
                </button>
            </div>
        </div>
    );
};
