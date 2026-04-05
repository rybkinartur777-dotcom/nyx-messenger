import { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
    src: string;
    isOwn: boolean;
}

// Generate stable waveform bars per-src (so they don't re-randomize on re-render)
function generateBars(seed: string): number[] {
    const bars: number[] = [];
    let h = 0;
    for (let i = 0; i < 32; i++) {
        h = ((h << 5) - h + (seed.charCodeAt(i % seed.length) || i)) | 0;
        bars.push((Math.abs(h) % 70) / 100 + 0.15);
    }
    return bars;
}

function formatTime(sec: number) {
    if (!isFinite(sec) || isNaN(sec) || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Detect iOS Safari
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

export default function AudioPlayer({ src, isOwn }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const [loadError, setLoadError] = useState(false);

    const BARS = generateBars(src.slice(-24));

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
        setIsLoaded(false);
        setLoadError(false);

        const trySetDuration = () => {
            if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
                setDuration(audio.duration);
                setIsLoaded(true);
            }
        };

        const onTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            if (audio.duration && isFinite(audio.duration)) {
                setProgress(audio.currentTime / audio.duration);
            }
        };
        const onLoaded = () => trySetDuration();
        const onCanPlay = () => trySetDuration();
        const onDurationChange = () => trySetDuration();
        const onEnded = () => {
            setIsPlaying(false);
            setProgress(0);
            setCurrentTime(0);
            audio.currentTime = 0;
        };
        const onError = () => {
            // iOS sometimes fails on webm but plays mp4/aac — we'll show grayed state
            setLoadError(true);
            setIsLoaded(true); // still allow tap-to-try
        };

        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('loadedmetadata', onLoaded);
        audio.addEventListener('canplay', onCanPlay);
        audio.addEventListener('durationchange', onDurationChange);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);

        // iOS Safari needs explicit load(). On non-iOS it usually auto-loads.
        audio.load();

        return () => {
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('loadedmetadata', onLoaded);
            audio.removeEventListener('canplay', onCanPlay);
            audio.removeEventListener('durationchange', onDurationChange);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
            audio.pause();
        };
    }, [src]);

    const togglePlay = async () => {
        const audio = audioRef.current;
        if (!audio) return;
        try {
            if (isPlaying) {
                audio.pause();
                setIsPlaying(false);
            } else {
                // On iOS we need user-gesture-initiated play
                // set src again in case of previous error
                if (loadError) {
                    audio.load();
                    setLoadError(false);
                }
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    await playPromise;
                }
                setIsPlaying(true);
                // iOS may only know duration after play starts
                if (!duration && audio.duration && isFinite(audio.duration)) {
                    setDuration(audio.duration);
                    setIsLoaded(true);
                }
            }
        } catch (err) {
            console.warn('Audio play error:', err);
            setIsPlaying(false);
        }
    };

    const getClientX = (e: React.MouseEvent | React.TouchEvent): number => {
        if ('touches' in e && e.touches.length > 0) return e.touches[0].clientX;
        if ('changedTouches' in e && (e as React.TouchEvent).changedTouches.length > 0)
            return (e as React.TouchEvent).changedTouches[0].clientX;
        return (e as React.MouseEvent).clientX;
    };

    const seek = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        if (!audio || !audio.duration || !isFinite(audio.duration)) return;
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (getClientX(e) - rect.left) / rect.width));
        audio.currentTime = ratio * audio.duration;
        setProgress(ratio);
        setCurrentTime(audio.currentTime);
    };

    const filledBars = Math.round(progress * BARS.length);
    const accentColor = isOwn ? 'rgba(255,255,255,0.92)' : 'var(--primary, #7c6aff)';
    const dimColor = isOwn ? 'rgba(255,255,255,0.28)' : 'rgba(124,106,255,0.28)';

    return (
        <div className={`tg-audio-player ${isOwn ? 'own' : 'other'}`}>
            {/* Hidden native audio element — iOS needs playsinline + x-webkit attributes */}
            <audio
                ref={audioRef}
                preload={isIOS ? 'none' : 'metadata'}
                playsInline
                // @ts-ignore — webkit non-standard
                x-webkit-airplay="deny"
                webkit-playsinline="true"
                style={{ display: 'none' }}
            >
                {/* Provide webm and mp4/aac sources — iOS supports AAC, not webm */}
                <source src={src} type="audio/webm; codecs=opus" />
                <source src={src} type="audio/mp4" />
                <source src={src} />
            </audio>

            {/* Play / Pause button */}
            <button
                className="tg-audio-btn"
                onClick={togglePlay}
                style={{ opacity: isLoaded ? 1 : 0.55 }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
            >
                {isPlaying
                    ? <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                        <rect x="5" y="4" width="4" height="16" rx="1.5" />
                        <rect x="15" y="4" width="4" height="16" rx="1.5" />
                    </svg>
                    : <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                }
            </button>

            {/* Waveform + time */}
            <div className="tg-audio-body">
                <div
                    className="tg-audio-wave"
                    onClick={seek}
                    onTouchEnd={seek}
                    style={{ cursor: 'pointer', touchAction: 'pan-y' }}
                >
                    {BARS.map((h, i) => (
                        <span
                            key={i}
                            className="tg-audio-bar"
                            style={{
                                height: `${Math.round(h * 30)}px`,
                                background: i < filledBars ? accentColor : dimColor,
                                transition: 'background 0.08s',
                                flexShrink: 0,
                            }}
                        />
                    ))}
                </div>
                <span className="tg-audio-time">
                    {currentTime > 0
                        ? formatTime(currentTime)
                        : duration > 0
                            ? formatTime(duration)
                            : isLoaded && !duration ? '—' : '...'}
                </span>
            </div>
        </div>
    );
}
