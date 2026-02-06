import { useMemo } from 'react';

function generateParticles(count: number, spacing: number, color: string): string {
  const shadows: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * spacing);
    const y = Math.floor(Math.random() * spacing);
    shadows.push(`${x}px ${y}px ${color}`);
  }
  return shadows.join(', ');
}

interface ParticleLayerProps {
  count: number;
  size: number;
  duration: number;
  color: string;
  spacing: number;
}

function ParticleLayer({ count, size, duration, color, spacing }: ParticleLayerProps) {
  const boxShadow = useMemo(() => generateParticles(count, spacing, color), [count, spacing, color]);
  const boxShadowAfter = useMemo(() => generateParticles(Math.floor(count * 0.8), spacing, color), [count, spacing, color]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${size}px`,
        height: `${size}px`,
        background: 'transparent',
        boxShadow,
        borderRadius: '50%',
        animation: `particleFloat ${duration}s linear infinite`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: `${spacing}px`,
          left: 0,
          width: `${size}px`,
          height: `${size}px`,
          background: 'transparent',
          boxShadow: boxShadowAfter,
          borderRadius: '50%',
        }}
      />
    </div>
  );
}

interface ParticleBackgroundProps {
  contained?: boolean;
}

export function ParticleBackground({ contained }: ParticleBackgroundProps) {
  const spacing = contained ? 1200 : 2000;

  return (
    <div className={`particle-bg ${contained ? 'particle-bg--contained' : ''}`}>
      <ParticleLayer count={contained ? 150 : 300} size={1} duration={80} color="var(--particle-color, #3b82f6)" spacing={spacing} />
      <ParticleLayer count={contained ? 100 : 200} size={2} duration={120} color="var(--particle-color, #3b82f6)" spacing={spacing} />
      <ParticleLayer count={contained ? 50 : 100} size={2} duration={160} color="var(--particle-color, #3b82f6)" spacing={spacing} />
    </div>
  );
}
