import React, { useState, useEffect, useCallback } from 'react';
import { Message } from '../../types';

interface MediaGalleryProps {
    messages: Message[];
    onClose: () => void;
    chatName: string;
}

type GalleryTab = 'photo' | 'video' | 'file';

const MediaGallery: React.FC<MediaGalleryProps> = ({ messages, onClose, chatName }) => {
    const [activeTab, setActiveTab] = useState<GalleryTab>('photo');
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
    const [lightboxIndex, setLightboxIndex] = useState<number>(0);

    const photos = messages.filter(m => m.type === 'image' && m.fileUrl);
    const videos = messages.filter(m => m.type === 'video' && m.fileUrl);
    const files = messages.filter(m => m.type === 'file' && m.fileUrl);

    const currentItems = activeTab === 'photo' ? photos : activeTab === 'video' ? videos : files;

    // Keyboard navigation
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (lightboxSrc) setLightboxSrc(null);
                else onClose();
            }
            if (lightboxSrc) {
                if (e.key === 'ArrowRight') {
                    const next = (lightboxIndex + 1) % photos.length;
                    setLightboxIndex(next);
                    setLightboxSrc(photos[next]?.fileUrl || null);
                }
                if (e.key === 'ArrowLeft') {
                    const prev = (lightboxIndex - 1 + photos.length) % photos.length;
                    setLightboxIndex(prev);
                    setLightboxSrc(photos[prev]?.fileUrl || null);
                }
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [lightboxSrc, lightboxIndex, photos, onClose]);

    const openLightbox = (src: string, index: number) => {
        setLightboxSrc(src);
        setLightboxIndex(index);
    };

    const formatFileSize = (dataUrl: string): string => {
        const base64 = dataUrl.split(',')[1] || '';
        const bytes = Math.ceil((base64.length * 3) / 4);
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getFileName = (msg: Message): string => {
        const match = msg.content.match(/\[(?:Файл|File): (.+?)\]/);
        return match ? match[1] : 'Файл';
    };

    const getFileIcon = (name: string) => {
        const ext = name.split('.').pop()?.toLowerCase();
        if (['pdf'].includes(ext || '')) return '📄';
        if (['doc', 'docx'].includes(ext || '')) return '📝';
        if (['xls', 'xlsx'].includes(ext || '')) return '📊';
        if (['zip', 'rar', '7z'].includes(ext || '')) return '🗜️';
        if (['mp3', 'wav', 'ogg'].includes(ext || '')) return '🎵';
        return '📎';
    };

    const tabCounts = { photo: photos.length, video: videos.length, file: files.length };

    return (
        <>
            {/* Overlay */}
            <div
                className="media-gallery-overlay"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="media-gallery-panel">
                {/* Header */}
                <div className="media-gallery-header">
                    <div>
                        <div className="media-gallery-title">Медиа</div>
                        <div className="media-gallery-subtitle">{chatName}</div>
                    </div>
                    <button className="media-gallery-close" onClick={onClose}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="media-gallery-tabs">
                    {(['photo', 'video', 'file'] as GalleryTab[]).map(tab => (
                        <button
                            key={tab}
                            className={`media-gallery-tab ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'photo' ? '🖼️ Фото' : tab === 'video' ? '🎬 Видео' : '📎 Файлы'}
                            {tabCounts[tab] > 0 && (
                                <span className="media-gallery-tab-count">{tabCounts[tab]}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="media-gallery-content">
                    {currentItems.length === 0 ? (
                        <div className="media-gallery-empty">
                            <div className="media-gallery-empty-icon">
                                {activeTab === 'photo' ? '🖼️' : activeTab === 'video' ? '🎬' : '📎'}
                            </div>
                            <div className="media-gallery-empty-text">
                                {activeTab === 'photo' ? 'Нет фотографий' : activeTab === 'video' ? 'Нет видео' : 'Нет файлов'}
                            </div>
                            <div className="media-gallery-empty-hint">
                                Отправленные медиафайлы появятся здесь
                            </div>
                        </div>
                    ) : activeTab === 'photo' ? (
                        <div className="media-gallery-grid">
                            {photos.map((msg, i) => (
                                <div
                                    key={msg.id}
                                    className="media-gallery-thumb"
                                    onClick={() => openLightbox(msg.fileUrl!, i)}
                                >
                                    <img src={msg.fileUrl} alt="" loading="lazy" />
                                    <div className="media-gallery-thumb-overlay">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                            <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                                        </svg>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : activeTab === 'video' ? (
                        <div className="media-gallery-grid">
                            {videos.map((msg, i) => (
                                <div
                                    key={msg.id}
                                    className="media-gallery-thumb media-gallery-thumb--video"
                                    onClick={() => openLightbox(msg.fileUrl!, i)}
                                >
                                    <video src={msg.fileUrl} muted />
                                    <div className="media-gallery-play-btn">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                            <polygon points="5,3 19,12 5,21"/>
                                        </svg>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="media-gallery-files">
                            {files.map(msg => {
                                const name = getFileName(msg);
                                return (
                                    <a
                                        key={msg.id}
                                        className="media-gallery-file-item"
                                        href={msg.fileUrl}
                                        download={name}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <div className="media-gallery-file-icon">{getFileIcon(name)}</div>
                                        <div className="media-gallery-file-info">
                                            <div className="media-gallery-file-name">{name}</div>
                                            <div className="media-gallery-file-size">
                                                {new Date(msg.timestamp).toLocaleDateString('ru-RU')}
                                            </div>
                                        </div>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                        </svg>
                                    </a>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Lightbox */}
            {lightboxSrc && (
                <div className="media-lightbox" onClick={() => setLightboxSrc(null)}>
                    <button className="media-lightbox-close" onClick={() => setLightboxSrc(null)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>

                    {photos.length > 1 && (
                        <>
                            <button
                                className="media-lightbox-nav media-lightbox-nav--prev"
                                onClick={e => {
                                    e.stopPropagation();
                                    const prev = (lightboxIndex - 1 + photos.length) % photos.length;
                                    setLightboxIndex(prev);
                                    setLightboxSrc(photos[prev]?.fileUrl || null);
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                            <button
                                className="media-lightbox-nav media-lightbox-nav--next"
                                onClick={e => {
                                    e.stopPropagation();
                                    const next = (lightboxIndex + 1) % photos.length;
                                    setLightboxIndex(next);
                                    setLightboxSrc(photos[next]?.fileUrl || null);
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                        </>
                    )}

                    <img
                        src={lightboxSrc}
                        className="media-lightbox-img"
                        onClick={e => e.stopPropagation()}
                        alt=""
                    />

                    {photos.length > 1 && (
                        <div className="media-lightbox-counter">
                            {lightboxIndex + 1} / {photos.length}
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default MediaGallery;
