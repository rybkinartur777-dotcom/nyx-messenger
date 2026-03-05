import React, { useEffect, useRef } from 'react';

interface Star {
    x: number;
    y: number;
    size: number;
    brightness: number;
    maxBrightness: number;
    speed: number;
    angle: number;
    twinkleSpeed: number;
    twinklePhase: number;
    color: string;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    life: number;
    maxLife: number;
    color: string;
}

interface Meteor {
    x: number;
    y: number;
    vx: number;
    vy: number;
    length: number;
    life: number;
    maxLife: number;
    width: number;
}

const STAR_COLORS = [
    '#ffffff', '#ffffffcc', '#a29bfe', '#6c5ce7',
    '#dfe6fd', '#c8c0ff', '#e8eaff', '#b8b0ff',
];

const PARTICLE_COLORS = [
    'rgba(108, 92, 231, 0.9)',
    'rgba(162, 155, 254, 0.9)',
    'rgba(255, 255, 255, 0.7)',
    'rgba(100, 200, 255, 0.8)',
    'rgba(200, 100, 255, 0.8)',
];

export const StarField: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;

        let width = window.innerWidth;
        let height = window.innerHeight;

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };
        resize();
        window.addEventListener('resize', resize);

        // Create stars
        const STAR_COUNT = 280;
        const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() * 2.2 + 0.3,
            brightness: Math.random(),
            maxBrightness: 0.4 + Math.random() * 0.6,
            speed: 0.05 + Math.random() * 0.25,
            angle: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.005 + Math.random() * 0.025,
            twinklePhase: Math.random() * Math.PI * 2,
            color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        }));

        // Particles
        const MAX_PARTICLES = 40;
        const particles: Particle[] = [];
        const spawnParticle = () => {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.6,
                vy: (Math.random() - 0.5) * 0.6,
                size: 1.5 + Math.random() * 3,
                life: 0,
                maxLife: 180 + Math.random() * 240,
                color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
            });
        };
        for (let i = 0; i < 20; i++) spawnParticle();

        // Meteors
        const meteors: Meteor[] = [];
        const spawnMeteor = () => {
            const angle = (Math.random() * 30 + 15) * (Math.PI / 180);
            const speed = 8 + Math.random() * 10;
            meteors.push({
                x: Math.random() * width,
                y: -20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                length: 80 + Math.random() * 120,
                life: 0,
                maxLife: 60 + Math.random() * 40,
                width: 1.5 + Math.random() * 1.5,
            });
        };

        let frame = 0;
        let lastMeteor = 0;

        const draw = () => {
            frame++;
            ctx.clearRect(0, 0, width, height);

            // ── Stars ──
            for (const s of stars) {
                // Gentle chaotic drift
                s.angle += (Math.random() - 0.5) * 0.06;
                s.x += Math.cos(s.angle) * s.speed;
                s.y += Math.sin(s.angle) * s.speed;

                // Wrap around edges
                if (s.x < -5) s.x = width + 5;
                if (s.x > width + 5) s.x = -5;
                if (s.y < -5) s.y = height + 5;
                if (s.y > height + 5) s.y = -5;

                // Twinkle
                s.twinklePhase += s.twinkleSpeed;
                const alpha = s.maxBrightness * (0.5 + 0.5 * Math.sin(s.twinklePhase));

                ctx.save();
                ctx.globalAlpha = alpha;

                // Glow for brighter stars
                if (s.size > 1.4) {
                    ctx.shadowBlur = s.size * 6;
                    ctx.shadowColor = s.color;
                }

                ctx.fillStyle = s.color;
                ctx.beginPath();

                if (s.size > 1.8) {
                    // Cross/plus shape for big stars
                    const r = s.size;
                    ctx.rect(s.x - r * 0.3, s.y - r, r * 0.6, r * 2);
                    ctx.rect(s.x - r, s.y - r * 0.3, r * 2, r * 0.6);
                } else {
                    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                }
                ctx.fill();
                ctx.restore();
            }

            // ── Particles (floating glowing orbs) ──
            if (frame % 8 === 0 && particles.length < MAX_PARTICLES) spawnParticle();

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vx += (Math.random() - 0.5) * 0.04;
                p.vy += (Math.random() - 0.5) * 0.04;
                p.life++;

                if (p.life > p.maxLife) { particles.splice(i, 1); continue; }

                const progress = p.life / p.maxLife;
                const alpha = progress < 0.1 ? progress * 10 : progress > 0.8 ? (1 - progress) * 5 : 1;

                ctx.save();
                ctx.globalAlpha = alpha * 0.75;
                ctx.shadowBlur = p.size * 8;
                ctx.shadowColor = p.color;

                const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
                grad.addColorStop(0, p.color);
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // ── Meteors / Shooting stars ──
            const now = Date.now();
            if (now - lastMeteor > 2500 + Math.random() * 4000 && meteors.length < 4) {
                spawnMeteor();
                lastMeteor = now;
            }

            for (let i = meteors.length - 1; i >= 0; i--) {
                const m = meteors[i];
                m.x += m.vx;
                m.y += m.vy;
                m.life++;

                if (m.life > m.maxLife || m.x > width + 200 || m.y > height + 200) {
                    meteors.splice(i, 1);
                    continue;
                }

                const progress = m.life / m.maxLife;
                const alpha = progress < 0.2 ? progress * 5 : (1 - progress);

                // Tail
                const tailX = m.x - m.vx / Math.hypot(m.vx, m.vy) * m.length;
                const tailY = m.y - m.vy / Math.hypot(m.vx, m.vy) * m.length;

                const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
                grad.addColorStop(0, 'transparent');
                grad.addColorStop(0.6, `rgba(200, 190, 255, ${alpha * 0.4})`);
                grad.addColorStop(1, `rgba(255, 255, 255, ${alpha})`);

                ctx.save();
                ctx.globalAlpha = 1;
                ctx.strokeStyle = grad;
                ctx.lineWidth = m.width;
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(162, 155, 254, 0.8)';
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(tailX, tailY);
                ctx.lineTo(m.x, m.y);
                ctx.stroke();

                // Bright head
                ctx.globalAlpha = alpha;
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#fff';
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(m.x, m.y, m.width * 0.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            animRef.current = requestAnimationFrame(draw);
        };

        animRef.current = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(animRef.current);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0, left: 0,
                width: '100%',
                height: '100%',
                zIndex: -1,
                pointerEvents: 'none',
            }}
        />
    );
};
