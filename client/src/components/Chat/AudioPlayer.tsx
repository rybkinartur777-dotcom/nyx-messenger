import { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
    src: string;
    isOwn: boolean;
}

// Generate fake waveform bars (30 bars with random heights)
const BARS = Array.from({ length: 30 }, () => Math.random() * 0.7 + 0.2);

function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ src, isOwn }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0); // 0–1
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
        };
        const onLoaded = () => setDuration(audio.duration);
        const onEnded = () => { setIsPlaying(false); setProgress(0); setCurrentTime(0); };

        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('loadedmetadata', onLoaded);
        audio.addEventListener('ended', onEnded);
        return () => {
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('loadedmetadata', onLoaded);
            audio.removeEventListener('ended', onEnded);
        };
    }, []);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        if (!audio || !audio.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        audio.currentTime = ratio * audio.duration;
        setProgress(ratio);
    };

    const filledBars = Math.round(progress * BARS.length);
    const accentColor = isOwn ? 'rgba(255,255,255,0.9)' : '#8774e1';
    const dimColor = isOwn ? 'rgba(255,255,255,0.35)' : 'rgba(135,116,225,0.35)';

    return (
        <div className={`tg-audio-player ${isOwn ? 'own' : 'other'}`}>
            <audio ref={audioRef} src={src} preload="metadata" />

            {/* Play / Pause button */}
            <button className="tg-audio-btn" onClick={togglePlay}>
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
                {/* Waveform bars */}
                <div className="tg-audio-wave" onClick={handleBarClick}>
                    {BARS.map((h, i) => (
                        <span
                            key={i}
                            className="tg-audio-bar"
                            style={{
                                height: `${Math.round(h * 28)}px`,
                                background: i < filledBars ? accentColor : dimColor,
                                transition: 'background 0.1s',
                            }}
                        />
                    ))}
                </div>
                {/* Duration */}
                <span className="tg-audio-time">
                    {formatTime(isPlaying || currentTime > 0 ? currentTime : duration)}
                </span>
            </div>
        </div>
    );
}
