import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameLoop } from '../useGameLoop';
import { getHighScore, submitHighScore } from '../highScores';
import styles from '../Arcade.module.css';

const W = 480;
const H = 560;
const GROUND_Y = H - 30;
const BATTERY_X = W / 2;
const BATTERY_TOP = GROUND_Y - 22;
const CITY_XS = [60, 130, 200, 280, 350, 420];
const CITY_W = 30;
const SHOT_SPEED = 400;
const BLAST_MAX_R = 34;
const BLAST_GROW = 95;
const BLAST_SHRINK = 70;
const AMMO_PER_WAVE = 20;

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
}

interface Blast {
  x: number;
  y: number;
  r: number;
  growing: boolean;
}

interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  sx: number;
  sy: number;
}

interface State {
  cities: boolean[];
  ammo: number;
  shots: Shot[];
  blasts: Blast[];
  enemies: Enemy[];
  toSpawn: number;
  spawnTimer: number;
  wave: number;
  waveClearTimer: number;
  score: number;
  status: 'ready' | 'playing' | 'over';
  mouse: { x: number; y: number };
}

function initialState(): State {
  return {
    cities: CITY_XS.map(() => true),
    ammo: AMMO_PER_WAVE,
    shots: [],
    blasts: [],
    enemies: [],
    toSpawn: 8,
    spawnTimer: 0.5,
    wave: 1,
    waveClearTimer: 0,
    score: 0,
    status: 'ready',
    mouse: { x: W / 2, y: H / 2 },
  };
}

function startWave(st: State, wave: number) {
  st.wave = wave;
  st.toSpawn = 6 + wave * 2;
  st.spawnTimer = 0.5;
  st.ammo = AMMO_PER_WAVE;
  st.shots = [];
  st.blasts = [];
  st.enemies = [];
}

export function CacheCommand({ onExit, onScore }: { onExit: () => void; onScore?: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(initialState());
  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [ammo, setAmmo] = useState(AMMO_PER_WAVE);
  const [highScore, setHighScore] = useState(() => getHighScore('missile'));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === 'm') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    stateRef.current.mouse = {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }, []);

  const onClick = useCallback(() => {
    const st = stateRef.current;
    if (st.status === 'over') {
      stateRef.current = initialState();
      stateRef.current.status = 'playing';
      setScore(0);
      setWave(1);
      return;
    }
    if (st.status === 'ready') {
      st.status = 'playing';
      return;
    }
    if (st.ammo <= 0) return;
    const tx = st.mouse.x;
    const ty = Math.min(st.mouse.y, GROUND_Y - 60);
    const dx = tx - BATTERY_X;
    const dy = ty - BATTERY_TOP;
    const dist = Math.hypot(dx, dy) || 1;
    st.ammo--;
    st.shots.push({
      x: BATTERY_X,
      y: BATTERY_TOP,
      vx: (dx / dist) * SHOT_SPEED,
      vy: (dy / dist) * SHOT_SPEED,
      tx,
      ty,
    });
  }, []);

  const gameOver = useCallback((st: State) => {
    st.status = 'over';
    submitHighScore('missile', st.score);
    setHighScore(getHighScore('missile'));
    onScoreRef.current?.(st.score);
  }, []);

  useGameLoop((dt) => {
    const st = stateRef.current;

    if (st.status === 'playing') {
      // spawn enemies
      if (st.toSpawn > 0) {
        st.spawnTimer -= dt;
        if (st.spawnTimer <= 0) {
          st.spawnTimer = 0.4 + Math.random() * Math.max(0.3, 1.4 - st.wave * 0.1);
          st.toSpawn--;
          const aliveTargets = CITY_XS.filter((_, i) => st.cities[i]);
          const targets = [...aliveTargets, BATTERY_X];
          const tx = targets[Math.floor(Math.random() * targets.length)];
          const sx = 20 + Math.random() * (W - 40);
          const speed = 35 + st.wave * 8;
          const dx = tx - sx;
          const dy = GROUND_Y - 0;
          const dist = Math.hypot(dx, dy);
          st.enemies.push({
            x: sx,
            y: 0,
            vx: (dx / dist) * speed,
            vy: (dy / dist) * speed,
            sx,
            sy: 0,
          });
        }
      }

      // shots
      for (const s of st.shots) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      st.shots = st.shots.filter((s) => {
        if (Math.hypot(s.x - s.tx, s.y - s.ty) < 10) {
          st.blasts.push({ x: s.tx, y: s.ty, r: 2, growing: true });
          return false;
        }
        return true;
      });

      // blasts
      for (const b of st.blasts) {
        if (b.growing) {
          b.r += BLAST_GROW * dt;
          if (b.r >= BLAST_MAX_R) b.growing = false;
        } else {
          b.r -= BLAST_SHRINK * dt;
        }
      }
      st.blasts = st.blasts.filter((b) => b.r > 0);

      // enemies
      const survivors: Enemy[] = [];
      for (const e of st.enemies) {
        e.x += e.vx * dt;
        e.y += e.vy * dt;

        // caught in a blast — chain reaction
        const hit = st.blasts.some((b) => Math.hypot(e.x - b.x, e.y - b.y) < b.r);
        if (hit) {
          st.score += 25 * st.wave;
          st.blasts.push({ x: e.x, y: e.y, r: 2, growing: true });
          continue;
        }

        // ground impact
        if (e.y >= GROUND_Y) {
          st.blasts.push({ x: e.x, y: GROUND_Y, r: 2, growing: true });
          CITY_XS.forEach((cx, i) => {
            if (st.cities[i] && Math.abs(e.x - cx) < CITY_W / 2 + 10) {
              st.cities[i] = false;
            }
          });
          continue;
        }
        survivors.push(e);
      }
      st.enemies = survivors;

      if (!st.cities.some(Boolean)) {
        gameOver(st);
      }

      // wave cleared
      if (
        st.status === 'playing' &&
        st.toSpawn === 0 &&
        st.enemies.length === 0 &&
        st.blasts.length === 0
      ) {
        if (st.waveClearTimer === 0) {
          st.score += st.cities.filter(Boolean).length * 100 + st.ammo * 5;
          st.waveClearTimer = 2;
        }
        st.waveClearTimer -= dt;
        if (st.waveClearTimer <= 0) {
          st.waveClearTimer = 0;
          startWave(st, st.wave + 1);
          setWave(st.wave);
        }
      }
    }

    setScore(st.score);
    setAmmo(st.ammo);

    // draw
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // ground
    ctx.fillStyle = '#101024';
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    // cities
    CITY_XS.forEach((cx, i) => {
      if (st.cities[i]) {
        ctx.fillStyle = '#39ff14';
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 6;
        ctx.fillRect(cx - 13, GROUND_Y - 10, 8, 10);
        ctx.fillRect(cx - 4, GROUND_Y - 16, 8, 16);
        ctx.fillRect(cx + 5, GROUND_Y - 8, 8, 8);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#3a1020';
        ctx.fillRect(cx - 13, GROUND_Y - 4, 26, 4);
      }
    });

    // battery
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(BATTERY_X, BATTERY_TOP);
    ctx.lineTo(BATTERY_X + 16, GROUND_Y);
    ctx.lineTo(BATTERY_X - 16, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // enemy trails
    for (const e of st.enemies) {
      ctx.strokeStyle = 'rgba(255, 45, 120, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(e.sx, e.sy);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(e.x - 1.5, e.y - 1.5, 3, 3);
    }

    // shots
    for (const s of st.shots) {
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.moveTo(BATTERY_X, BATTERY_TOP);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
      // target marker
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.moveTo(s.tx - 4, s.ty);
      ctx.lineTo(s.tx + 4, s.ty);
      ctx.moveTo(s.tx, s.ty - 4);
      ctx.lineTo(s.tx, s.ty + 4);
      ctx.stroke();
    }

    // blasts (flickering)
    const flicker = Math.floor(performance.now() / 60) % 2 === 0;
    for (const b of st.blasts) {
      ctx.fillStyle = flicker ? '#ffffff' : '#ffe600';
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // crosshair
    if (st.status === 'playing') {
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(st.mouse.x - 8, st.mouse.y);
      ctx.lineTo(st.mouse.x + 8, st.mouse.y);
      ctx.moveTo(st.mouse.x, st.mouse.y - 8);
      ctx.lineTo(st.mouse.x, st.mouse.y + 8);
      ctx.stroke();
    }

    if (st.waveClearTimer > 0 && st.status === 'playing') {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe600';
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 10;
      ctx.font = 'bold 22px Consolas, monospace';
      ctx.fillText(`WAVE ${st.wave} CLEAR`, W / 2, H / 2 - 40);
      ctx.shadowBlur = 0;
    }

    if (st.status !== 'playing') {
      ctx.fillStyle = 'rgba(5, 5, 8, 0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = st.status === 'over' ? '#ff2d78' : '#00ffff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.font = 'bold 28px Consolas, monospace';
      ctx.fillText(st.status === 'over' ? 'THE END' : 'CACHE COMMAND', W / 2, H / 2 - 20);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#888';
      ctx.font = '14px Consolas, monospace';
      ctx.fillText(st.status === 'over' ? 'CLICK TO RETRY' : 'CLICK TO START', W / 2, H / 2 + 16);
    }
  });

  return (
    <div className={styles.gameWrap}>
      <div className={styles.hud} style={{ width: W }}>
        <span>SCORE {score}</span>
        <span>WAVE {wave}</span>
        <span>AMMO {ammo}</span>
        <span>HI {highScore}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className={styles.canvas}
        style={{ cursor: 'none' }}
        onMouseMove={onMouseMove}
        onClick={onClick}
      />
      <div className={styles.gameHint}>
        MOUSE AIM &middot; CLICK FIRE &middot; M MENU &middot; ESC QUIT
      </div>
    </div>
  );
}
