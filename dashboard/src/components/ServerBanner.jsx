import { useEffect, useRef, useState, useCallback } from 'react';

/* ─────────────────────────────────────────────
   Variant 1: Parallax + Lightning Pulse + Particles
───────────────────────────────────────────── */
function BannerParallax() {
  const containerRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const frameRef = useRef(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    targetRef.current = {
      x: (e.clientX - cx) / rect.width,
      y: (e.clientY - cy) / rect.height,
    };
  }, []);

  useEffect(() => {
    const animate = () => {
      currentRef.current.x += (targetRef.current.x - currentRef.current.x) * 0.05;
      currentRef.current.y += (targetRef.current.y - currentRef.current.y) * 0.05;
      setOffset({ x: currentRef.current.x, y: currentRef.current.y });
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  const px = offset.x * 20;
  const py = offset.y * 10;

  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: `${(i * 37 + 5) % 100}%`,
    top: `${(i * 53 + 10) % 100}%`,
    size: 2 + (i % 3),
    delay: (i * 0.3) % 4,
    duration: 3 + (i % 3),
  }));

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '960/300',
        borderRadius: '16px',
        overflow: 'hidden',
        cursor: 'crosshair',
        boxShadow: '0 0 60px rgba(88,65,242,0.5), 0 0 120px rgba(88,65,242,0.2)',
      }}
    >
      {/* Background image with parallax */}
      <div style={{
        position: 'absolute',
        inset: '-5%',
        backgroundImage: 'url(/banner.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transform: `translate(${px}px, ${py}px) scale(1.12)`,
        transition: 'transform 0.05s linear',
        willChange: 'transform',
      }} />

      {/* Dark vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, rgba(0,0,5,0.6) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Scan lines overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
        pointerEvents: 'none',
      }} />

      {/* Animated particles */}
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: p.left,
          top: p.top,
          width: `${p.size}px`,
          height: `${p.size}px`,
          borderRadius: '50%',
          background: 'rgba(138, 43, 226, 0.9)',
          boxShadow: '0 0 8px 2px rgba(138,43,226,0.8)',
          animation: `float-particle ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Lightning bolts SVG */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 960 300">
        <defs>
          <filter id="glow1">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g filter="url(#glow1)">
          <polyline points="480,0 470,80 490,80 460,160 480,160 440,260" stroke="rgba(180,100,255,0.7)" strokeWidth="2" fill="none"
            style={{ animation: 'lightning-flash 2.5s ease-in-out 0s infinite' }} />
          <polyline points="300,10 310,60 295,60 315,120 300,120 320,200" stroke="rgba(100,150,255,0.5)" strokeWidth="1.5" fill="none"
            style={{ animation: 'lightning-flash 3.2s ease-in-out 0.8s infinite' }} />
          <polyline points="660,5 650,70 670,70 645,140 665,140 635,230" stroke="rgba(180,100,255,0.5)" strokeWidth="1.5" fill="none"
            style={{ animation: 'lightning-flash 2.8s ease-in-out 1.4s infinite' }} />
        </g>
      </svg>

      {/* Animated purple orb glow at top center */}
      <div style={{
        position: 'absolute',
        top: '5%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(140,60,255,0.6) 0%, transparent 70%)',
        animation: 'orb-pulse 2s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Bottom gradient fade */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
        background: 'linear-gradient(to top, rgba(30,0,60,0.7), transparent)',
        pointerEvents: 'none',
      }} />

      <style>{`
        @keyframes float-particle {
          0%   { transform: translate(0, 0) scale(1); opacity: 0.4; }
          100% { transform: translate(${Math.random()*20-10}px, -15px) scale(1.5); opacity: 1; }
        }
        @keyframes lightning-flash {
          0%, 100% { opacity: 0; }
          10%, 12% { opacity: 1; }
          11%       { opacity: 0.3; }
          50%, 52% { opacity: 0.8; }
          51%      { opacity: 0.2; }
        }
        @keyframes orb-pulse {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.6; }
          50%       { transform: translateX(-50%) scale(1.4); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Variant 2: 3D Tilt + Holographic Sheen + Depth layers
───────────────────────────────────────────── */
function Banner3DTilt() {
  const containerRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50 });
  const targetRef = useRef({ rx: 0, ry: 0, mx: 50, my: 50 });
  const currentRef = useRef({ rx: 0, ry: 0, mx: 50, my: 50 });
  const frameRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    targetRef.current = {
      rx: (0.5 - y) * 18,
      ry: (x - 0.5) * 24,
      mx: x * 100,
      my: y * 100,
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    targetRef.current = { rx: 0, ry: 0, mx: 50, my: 50 };
    setIsHovered(false);
  }, []);

  useEffect(() => {
    const animate = () => {
      const lerp = 0.08;
      currentRef.current.rx += (targetRef.current.rx - currentRef.current.rx) * lerp;
      currentRef.current.ry += (targetRef.current.ry - currentRef.current.ry) * lerp;
      currentRef.current.mx += (targetRef.current.mx - currentRef.current.mx) * lerp;
      currentRef.current.my += (targetRef.current.my - currentRef.current.my) * lerp;
      setTilt({ ...currentRef.current });
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  const { rx, ry, mx, my } = tilt;

  return (
    <div
      style={{ perspective: '1200px', width: '100%', aspectRatio: '960/300' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
          transform: `rotateX(${rx}deg) rotateY(${ry}deg) scale(${isHovered ? 1.02 : 1})`,
          transition: isHovered ? 'none' : 'transform 0.6s ease',
          transformStyle: 'preserve-3d',
          willChange: 'transform',
          boxShadow: `
            0 0 40px rgba(88,65,242,0.4),
            0 ${20 + Math.abs(rx)}px ${60 + Math.abs(ry * 2)}px rgba(0,0,0,0.8),
            inset 0 0 80px rgba(88,65,242,0.1)
          `,
        }}
      >
        {/* Base image */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(/banner.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />

        {/* Depth layer 1 — foreground darkening */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(5,0,20,0.5) 100%)',
          transform: 'translateZ(20px)',
        }} />

        {/* Holographic rainbow sheen that follows cursor */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse 50% 80% at ${mx}% ${my}%,
            rgba(138,43,226,0.25) 0%,
            rgba(88,65,242,0.15) 30%,
            rgba(0,100,255,0.1) 60%,
            transparent 80%)`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
          transform: 'translateZ(30px)',
        }} />

        {/* Glare spot */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle 80px at ${mx}% ${my}%, rgba(255,255,255,0.12) 0%, transparent 70%)`,
          pointerEvents: 'none',
          transform: 'translateZ(40px)',
        }} />

        {/* Edge light glow (top) */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: `linear-gradient(90deg, transparent, rgba(140,60,255,${0.3 + Math.max(0,-rx/18)*0.7}), transparent)`,
          transform: 'translateZ(50px)',
        }} />

        {/* Animated energy rings */}
        <div style={{
          position: 'absolute',
          top: '8%', left: '50%',
          transform: 'translateX(-50%) translateZ(25px)',
          pointerEvents: 'none',
        }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              position: 'absolute',
              borderRadius: '50%',
              border: `1px solid rgba(140,60,255,${0.6 - i*0.15})`,
              width: `${60 + i*30}px`,
              height: `${30 + i*15}px`,
              top: `${-15 - i*7}px`,
              left: `${-30 - i*15}px`,
              animation: `ring-expand 3s ease-out ${i*0.8}s infinite`,
              boxShadow: '0 0 8px rgba(140,60,255,0.5)',
            }} />
          ))}
        </div>

        <style>{`
          @keyframes ring-expand {
            0%   { opacity: 0.8; transform: scale(0.8); }
            100% { opacity: 0; transform: scale(2); }
          }
        `}</style>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Variant 3: Canvas Particle Storm + RGB Glitch
───────────────────────────────────────────── */
function BannerGlitch() {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const frameRef = useRef(null);
  const particlesRef = useRef([]);
  const [glitchActive, setGlitchActive] = useState(false);
  const glitchTimerRef = useRef(null);

  const PARTICLE_COUNT = 80;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imgRef.current;

    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;

    // Init particles
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -0.3 - Math.random() * 0.8,
      size: 1 + Math.random() * 2.5,
      alpha: 0.3 + Math.random() * 0.7,
      hue: 260 + Math.random() * 60,
      life: Math.random(),
    }));

    let glitchFrame = 0;
    let isGlitching = false;
    let glitchSlices = [];

    const triggerGlitch = () => {
      isGlitching = true;
      glitchFrame = 0;
      glitchSlices = Array.from({ length: 6 }, () => ({
        y: Math.random() * H,
        h: 2 + Math.random() * 20,
        dx: (Math.random() - 0.5) * 30,
        channel: Math.floor(Math.random() * 3),
      }));
      setTimeout(() => { isGlitching = false; }, 200 + Math.random() * 300);
    };

    // Glitch interval
    const scheduleGlitch = () => {
      glitchTimerRef.current = setTimeout(() => {
        triggerGlitch();
        scheduleGlitch();
      }, 2000 + Math.random() * 4000);
    };
    scheduleGlitch();

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      if (img.complete) {
        ctx.drawImage(img, 0, 0, W, H);

        // RGB split on full image during glitch
        if (isGlitching && glitchFrame < 12) {
          const shift = 6 + glitchFrame * 2;
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = 0.15;
          ctx.filter = 'url(#none)';

          // Red channel offset
          ctx.drawImage(img, shift, 0, W, H);
          ctx.fillStyle = 'rgba(255,0,0,0.15)';
          ctx.fillRect(0,0,W,H);

          // Blue channel offset
          ctx.drawImage(img, -shift, 0, W, H);
          ctx.fillStyle = 'rgba(0,0,255,0.15)';
          ctx.fillRect(0,0,W,H);

          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';

          // Slice distortion
          glitchSlices.forEach(s => {
            if (img.complete) {
              ctx.drawImage(img, 0, s.y, W, s.h, s.dx, s.y, W, s.h);
            }
          });

          // Glitch scan line
          ctx.fillStyle = `rgba(140,60,255,0.4)`;
          ctx.fillRect(0, (glitchFrame * H / 12), W, 3);

          glitchFrame++;
        }
      }

      // Dark vignette
      const vignette = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.8);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,15,0.55)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);

      // Particles
      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life += 0.005;
        if (p.y < -5 || p.life > 1) {
          p.x = Math.random() * W;
          p.y = H + 5;
          p.life = 0;
          p.alpha = 0.3 + Math.random() * 0.7;
        }
        const fade = Math.sin(p.life * Math.PI);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${p.alpha * fade})`;
        ctx.shadowColor = `hsla(${p.hue}, 100%, 60%, 0.8)`;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Animated bottom-to-top scan beam
      const scanY = (Date.now() / 3000 % 1) * H;
      const beam = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
      beam.addColorStop(0, 'rgba(140,60,255,0)');
      beam.addColorStop(0.5, 'rgba(140,60,255,0.06)');
      beam.addColorStop(1, 'rgba(140,60,255,0)');
      ctx.fillStyle = beam;
      ctx.fillRect(0, scanY - 40, W, 80);

      frameRef.current = requestAnimationFrame(draw);
    };

    img.onload = () => { frameRef.current = requestAnimationFrame(draw); };
    if (img.complete) frameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRef.current);
      clearTimeout(glitchTimerRef.current);
    };
  }, []);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      aspectRatio: '960/300',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 0 80px rgba(88,65,242,0.4)',
    }}>
      <img
        ref={imgRef}
        src="/banner.png"
        style={{ display: 'none' }}
        alt=""
        crossOrigin="anonymous"
      />
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {/* Corner decorations */}
      {['top-left','top-right','bottom-left','bottom-right'].map(pos => {
        const isRight = pos.includes('right');
        const isBottom = pos.includes('bottom');
        return (
          <div key={pos} style={{
            position: 'absolute',
            [isBottom ? 'bottom' : 'top']: '12px',
            [isRight ? 'right' : 'left']: '12px',
            width: '24px', height: '24px',
            borderTop: isBottom ? 'none' : '2px solid rgba(140,60,255,0.8)',
            borderBottom: isBottom ? '2px solid rgba(140,60,255,0.8)' : 'none',
            borderLeft: isRight ? 'none' : '2px solid rgba(140,60,255,0.8)',
            borderRight: isRight ? '2px solid rgba(140,60,255,0.8)' : 'none',
            pointerEvents: 'none',
            animation: 'corner-pulse 2s ease-in-out infinite',
          }} />
        );
      })}

      {/* HUD-style overlay text */}
      <div style={{
        position: 'absolute', bottom: '10px', left: '16px',
        fontSize: '9px', fontFamily: 'monospace',
        color: 'rgba(140,60,255,0.7)',
        letterSpacing: '2px',
        animation: 'hud-blink 3s ease-in-out infinite',
        pointerEvents: 'none',
        textShadow: '0 0 8px rgba(140,60,255,0.8)',
      }}>
        SYS://PRETWORA.DS ██ ONLINE ██ {new Date().getFullYear()}
      </div>

      <style>{`
        @keyframes corner-pulse {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; box-shadow: 0 0 8px rgba(140,60,255,0.8); }
        }
        @keyframes hud-blink {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main ServerBanner — variant switcher
───────────────────────────────────────────── */
const VARIANTS = [
  { id: 'parallax', label: 'Параллакс' },
  { id: '3d',       label: '3D Tilt' },
  { id: 'glitch',   label: 'Glitch' },
];

export default function ServerBanner({ defaultVariant = 'parallax' }) {
  const [variant, setVariant] = useState(defaultVariant);

  return (
    <div style={{ width: '100%' }}>
      {/* Variant switcher */}
      <div style={{
        display: 'flex', gap: '8px', marginBottom: '12px',
        justifyContent: 'flex-end',
      }}>
        {VARIANTS.map(v => (
          <button
            key={v.id}
            onClick={() => setVariant(v.id)}
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              border: `1px solid ${variant === v.id ? 'rgba(140,60,255,0.8)' : 'rgba(255,255,255,0.1)'}`,
              background: variant === v.id ? 'rgba(140,60,255,0.2)' : 'rgba(255,255,255,0.05)',
              color: variant === v.id ? '#c084fc' : 'rgba(255,255,255,0.4)',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {variant === 'parallax' && <BannerParallax />}
      {variant === '3d'       && <Banner3DTilt />}
      {variant === 'glitch'   && <BannerGlitch />}
    </div>
  );
}
