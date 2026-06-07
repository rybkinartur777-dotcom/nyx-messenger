import { useEffect, useState, useRef } from 'react';

interface LiveVisualizerProps {
    stream: MediaStream | null;
}

export default function LiveVisualizer({ stream }: LiveVisualizerProps) {
    const [volumes, setVolumes] = useState<number[]>(new Array(24).fill(6));
    const animationRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    useEffect(() => {
        if (!stream) return;

        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioContextClass();
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64; // Small fftSize to get 32 frequency bins
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            audioContextRef.current = audioCtx;
            analyserRef.current = analyser;
            sourceRef.current = source;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateVisualizer = () => {
                if (!analyserRef.current) return;
                analyser.getByteFrequencyData(dataArray);

                // Map frequency data to 24 bars
                const newVolumes = Array.from({ length: 24 }).map((_, i) => {
                    // Focus on low-to-mid range frequencies where human voice lies
                    const dataIndex = Math.floor((i / 24) * (bufferLength * 0.7));
                    const val = dataArray[dataIndex] || 0;
                    // Scale values from 0-255 to heights between 4px and 28px
                    return Math.max(4, (val / 255) * 24 + 4);
                });

                setVolumes(newVolumes);
                animationRef.current = requestAnimationFrame(updateVisualizer);
            };

            updateVisualizer();
        } catch (err) {
            console.error('Failed to initialize live visualizer:', err);
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            if (sourceRef.current) {
                sourceRef.current.disconnect();
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close().catch(() => {});
            }
        };
    }, [stream]);

    return (
        <div className="recording-wave" style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '32px' }}>
            {volumes.map((h, i) => (
                <span
                    key={i}
                    className="wave-bar"
                    style={{
                        width: '3px',
                        height: `${h}px`,
                        background: 'linear-gradient(to top, var(--primary, #7c6aff), #00f3ff)',
                        borderRadius: '2px',
                        transition: 'height 0.05s ease-out',
                        flexShrink: 0
                    }}
                />
            ))}
        </div>
    );
}
