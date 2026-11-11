'use client';

import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: string;
  hasFlare: boolean;
}

interface Meteor {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  alpha: number;
  thickness: number;
  life: number;
  maxLife: number;
}

export default function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initStars();
    };
    window.addEventListener('resize', onResize);

    // Star Palettes (Cosmic Diamond, Electric Arcane Cyan, Soft Lavender Blue)
    const starColors = [
      '#FFFFFF',
      '#E0F2FE',
      '#BAE6FD',
      '#00F0FF',
      '#38BDF8',
      '#C7D2FE',
      '#818CF8',
    ];

    let stars: Star[] = [];
    const initStars = () => {
      stars = [];
      // Calculate star count based on screen area (around 240-360 stars)
      const count = Math.min(350, Math.floor((width * height) / 3800));

      for (let i = 0; i < count; i++) {
        const radius = Math.random() < 0.8 ? Math.random() * 0.9 + 0.3 : Math.random() * 1.4 + 1.1;
        const hasFlare = radius > 1.6 && Math.random() < 0.4;
        const color = starColors[Math.floor(Math.random() * starColors.length)];

        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius,
          baseAlpha: Math.random() * 0.5 + 0.35,
          alpha: Math.random() * 0.5 + 0.35,
          twinkleSpeed: Math.random() * 0.025 + 0.008,
          twinklePhase: Math.random() * Math.PI * 2,
          color,
          hasFlare,
        });
      }
    };
    initStars();

    // Meteors (Shooting Stars)
    const meteors: Meteor[] = [];
    let lastMeteorSpawn = Date.now();

    const spawnMeteor = () => {
      const angle = (Math.PI / 4) + (Math.random() - 0.5) * 0.25; // around 45 degrees
      meteors.push({
        x: Math.random() * width * 0.8,
        y: Math.random() * (height * 0.4),
        length: Math.random() * 80 + 70,
        speed: Math.random() * 8 + 9,
        angle,
        alpha: 1,
        thickness: Math.random() * 1.5 + 1.2,
        life: 0,
        maxLife: Math.random() * 45 + 35,
      });
    };

    let time = 0;

    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Stars
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        // Organic sinusoidal twinkling
        const currentAlpha = Math.max(
          0.1,
          Math.min(1, s.baseAlpha + Math.sin(time * s.twinkleSpeed * 60 + s.twinklePhase) * 0.35)
        );

        ctx.save();
        ctx.globalAlpha = currentAlpha;
        ctx.fillStyle = s.color;
        ctx.shadowBlur = s.radius > 1.2 ? 6 : 0;
        ctx.shadowColor = s.color;

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();

        // 4-Point Diffraction Spike Flare for prominent stars
        if (s.hasFlare && currentAlpha > 0.6) {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 0.5;
          ctx.globalAlpha = currentAlpha * 0.45;

          const flareLen = s.radius * 4;
          ctx.beginPath();
          ctx.moveTo(s.x - flareLen, s.y);
          ctx.lineTo(s.x + flareLen, s.y);
          ctx.moveTo(s.x, s.y - flareLen);
          ctx.lineTo(s.x, s.y + flareLen);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 2. Spawn and Draw Meteors (Shooting Stars)
      const now = Date.now();
      if (now - lastMeteorSpawn > 3200 && Math.random() < 0.03) {
        spawnMeteor();
        lastMeteorSpawn = now;
      }

      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.life++;
        m.x += Math.cos(m.angle) * m.speed;
        m.y += Math.sin(m.angle) * m.speed;

        const tailX = m.x - Math.cos(m.angle) * m.length;
        const tailY = m.y - Math.sin(m.angle) * m.length;

        const progress = m.life / m.maxLife;
        const currentAlpha = (1 - progress) * m.alpha;

        if (progress >= 1 || m.x > width + 100 || m.y > height + 100) {
          meteors.splice(i, 1);
          continue;
        }

        ctx.save();
        const gradient = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
        gradient.addColorStop(0, 'rgba(0, 240, 255, 0)');
        gradient.addColorStop(0.7, `rgba(56, 189, 248, ${currentAlpha * 0.6})`);
        gradient.addColorStop(1, `rgba(255, 255, 255, ${currentAlpha})`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = m.thickness;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00F0FF';

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(m.x, m.y);
        ctx.stroke();

        // Glowing Meteor Head
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.thickness * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* HTML5 Dynamic Starfield & Shooting Stars Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Atmospheric Cosmic Nebula Clouds */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-gradient-to-b from-cyan-500/[0.15] via-indigo-600/[0.08] to-transparent rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute top-1/4 -left-48 w-[700px] h-[700px] bg-cyan-400/[0.08] rounded-full blur-[160px] pointer-events-none"></div>
      <div className="absolute top-1/2 -right-48 w-[750px] h-[750px] bg-indigo-500/[0.07] rounded-full blur-[170px] pointer-events-none"></div>
      <div className="absolute bottom-10 left-1/3 w-[800px] h-[500px] bg-emerald-500/[0.06] rounded-full blur-[150px] pointer-events-none"></div>

      {/* Cyber Circuit Grid Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(0,240,255,0.07)_1px,transparent_1px)] [background-size:40px_40px] opacity-80 pointer-events-none"></div>
    </div>
  );
}

