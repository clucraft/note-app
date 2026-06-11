import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameLoop } from '../useGameLoop';
import { getHighScore, submitHighScore } from '../highScores';
import { sfx } from '../audio';
import styles from '../Arcade.module.css';

const W = 480;
const H = 560;
const HORIZON_Y = 380;
const GROUND_Y = 460;
const PLAYER_X = 110;

const BASE_SPEED = 240;
const MAX_SPEED = 560;
const SPEED_RAMP = 8; // px/s gained per second
const JUMP_VY = -520;
const GRAVITY_HELD = 1100; // floatier while jump is held and rising
const GRAVITY = 2000;

const RUN_W = 18;
const RUN_H = 38;
const SLIDE_H = 20;

interface Obstacle {
  x: number;
  w: number;
  h: number;
  overhead: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

interface State {
  dist: number; // world distance scrolled, px
  speed: number;
  y: number; // height above ground (0 = on ground), positive = up
  vy: number;
  sliding: boolean;
  obstacles: Obstacle[];
  toNext: number; // px until next obstacle spawn
  particles: Particle[];
  shake: number;
  status: 'ready' | 'playing' | 'over';
}

function initialState(): State {
  return {
    dist: 0,
    speed: BASE_SPEED,
    y: 0,
    vy: 0,
    sliding: false,
    obstacles: [],
    toNext: 500,
    particles: [],
    shake: 0,
    status: 'ready',
  };
}

/** Cheap deterministic hash for infinite parallax layers. */
function hash(i: number): number {
  return ((i * 2654435761) >>> 0) % 1000;
}

export function Runner({ onExit, onScore }: { onExit: () => void; onScore?: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(initialState());
  const jumpHeldRef = useRef(false);
  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => getHighScore('runner'));

  const jumpOrStart = useCallback(() => {
    const st = stateRef.current;
    if (st.status !== 'playing') {
      stateRef.current = initialState();
      stateRef.current.status = 'playing';
      setScore(0);
      return;
    }
    if (st.y === 0 && !st.sliding) {
      st.vy = JUMP_VY;
      sfx.bounce(620);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === 'm') {
        onExit();
        return;
      }
      const st = stateRef.current;
      if (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'Enter') {
        e.preventDefault();
        jumpHeldRef.current = true;
        jumpOrStart();
      }
      if (key === 'ArrowDown' || key === 's') {
        e.preventDefault();
        if (st.status === 'playing' && st.y === 0) st.sliding = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'Enter') {
        jumpHeldRef.current = false;
      }
      if (key === 'ArrowDown' || key === 's') {
        stateRef.current.sliding = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onExit, jumpOrStart]);

  useGameLoop((dt) => {
    const st = stateRef.current;

    if (st.status === 'playing') {
      st.speed = Math.min(MAX_SPEED, st.speed + SPEED_RAMP * dt);
      st.dist += st.speed * dt;

      // jump physics with variable height
      if (st.y > 0 || st.vy !== 0) {
        const g = jumpHeldRef.current && st.vy < 0 ? GRAVITY_HELD : GRAVITY;
        st.vy += g * dt;
        st.y -= st.vy * dt;
        if (st.y <= 0) {
          st.y = 0;
          st.vy = 0;
          // landing puff
          for (let i = 0; i < 4; i++) {
            const life = 0.25 + Math.random() * 0.15;
            st.particles.push({
              x: PLAYER_X + (Math.random() - 0.5) * 12,
              y: GROUND_Y,
              vx: -st.speed * 0.15 + (Math.random() - 0.5) * 40,
              vy: -Math.random() * 60,
              life,
              maxLife: life,
              size: 2,
              color: '#557788',
              gravity: 300,
            });
          }
        }
      }

      // run dust
      if (st.y === 0 && Math.random() < 0.3) {
        const life = 0.2 + Math.random() * 0.15;
        st.particles.push({
          x: PLAYER_X - 6,
          y: GROUND_Y - 2,
          vx: -st.speed * 0.2,
          vy: -20 - Math.random() * 40,
          life,
          maxLife: life,
          size: 1.5,
          color: st.sliding ? '#00ffff' : '#445566',
          gravity: 200,
        });
      }

      // spawn obstacles
      st.toNext -= st.speed * dt;
      if (st.toNext <= 0) {
        const overhead = st.dist > 2400 && Math.random() < 0.35;
        if (overhead) {
          st.obstacles.push({ x: W + 40, w: 34, h: 26, overhead: true });
        } else {
          const h = 26 + Math.random() * 18;
          st.obstacles.push({ x: W + 40, w: 18 + Math.random() * 14, h, overhead: false });
          // occasional double block
          if (st.dist > 4800 && Math.random() < 0.25) {
            st.obstacles.push({ x: W + 110, w: 18, h: 26 + Math.random() * 12, overhead: false });
          }
        }
        st.toNext = 260 + Math.random() * 280 + st.speed * 0.35;
      }

      // move obstacles + collide
      const playerH = st.sliding ? SLIDE_H : RUN_H;
      const px1 = PLAYER_X - RUN_W / 2 + 2;
      const px2 = PLAYER_X + RUN_W / 2 - 2;
      const py1 = GROUND_Y - st.y - playerH + 2;
      const py2 = GROUND_Y - st.y - 2;
      for (const o of st.obstacles) {
        o.x -= st.speed * dt;
        const oy1 = o.overhead ? GROUND_Y - 62 : GROUND_Y - o.h;
        const oy2 = o.overhead ? GROUND_Y - 62 + o.h : GROUND_Y;
        if (px2 > o.x && px1 < o.x + o.w && py2 > oy1 && py1 < oy2) {
          st.status = 'over';
          st.shake = 0.25;
          sfx.explosion(true);
          sfx.over();
          for (let i = 0; i < 24; i++) {
            const life = 0.5 + Math.random() * 0.4;
            const angle = Math.random() * Math.PI * 2;
            const v = 80 + Math.random() * 220;
            st.particles.push({
              x: PLAYER_X,
              y: GROUND_Y - st.y - playerH / 2,
              vx: Math.cos(angle) * v,
              vy: Math.sin(angle) * v - 80,
              life,
              maxLife: life,
              size: 2 + Math.random() * 3,
              color: Math.random() < 0.6 ? '#00ffff' : '#ff2d78',
              gravity: 600,
            });
          }
          const finalScore = Math.floor(st.dist / 10);
          submitHighScore('runner', finalScore);
          setHighScore(getHighScore('runner'));
          onScoreRef.current?.(finalScore);
          break;
        }
      }
      st.obstacles = st.obstacles.filter((o) => o.x + o.w > -20);
    }

    for (const p of st.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= dt;
    }
    st.particles = st.particles.filter((p) => p.life > 0);
    st.shake = Math.max(0, st.shake - dt);

    setScore(Math.floor(st.dist / 10));

    // ================= draw =================
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (st.shake > 0) {
      ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
    }

    const t = performance.now() / 1000;

    // stars
    for (let i = 0; i < 40; i++) {
      const sx = (i * 173) % W;
      const sy = (i * 89) % (HORIZON_Y - 100);
      ctx.globalAlpha = 0.25 + 0.3 * Math.sin(t * 2 + i);
      ctx.fillStyle = '#8888aa';
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // retro sun with stripe cuts
    const sunX = 350;
    const sunY = HORIZON_Y - 10;
    const sunR = 64;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, HORIZON_Y);
    ctx.clip();
    const grad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    grad.addColorStop(0, '#ffe600');
    grad.addColorStop(1, '#ff2d78');
    ctx.fillStyle = grad;
    ctx.shadowColor = '#ff6ec7';
    ctx.shadowBlur = 36;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // stripes
    ctx.fillStyle = '#050508';
    for (let i = 0; i < 5; i++) {
      const sy = sunY + 6 + i * 12;
      ctx.fillRect(sunX - sunR, sy, sunR * 2, 3 + i * 1.5);
    }
    ctx.restore();

    // far skyline (parallax 0.15)
    const farScroll = st.dist * 0.15;
    ctx.fillStyle = '#16162e';
    for (let sx = -46; sx < W + 46; sx += 46) {
      const idx = Math.floor((farScroll + sx) / 46);
      const bh = 40 + (hash(idx) % 70);
      const bx = sx - (farScroll % 46);
      ctx.fillRect(bx, HORIZON_Y - bh, 42, bh);
    }

    // mid skyline (parallax 0.35) with lit windows
    const midScroll = st.dist * 0.35;
    for (let sx = -64; sx < W + 64; sx += 64) {
      const idx = Math.floor((midScroll + sx) / 64);
      const bh = 60 + (hash(idx + 500) % 100);
      const bx = sx - (midScroll % 64);
      ctx.fillStyle = '#1d1d3d';
      ctx.fillRect(bx, HORIZON_Y - bh, 56, bh);
      ctx.fillStyle = '#00ffff';
      ctx.globalAlpha = 0.5;
      for (let wy = 0; wy < 3; wy++) {
        for (let wx = 0; wx < 2; wx++) {
          if (hash(idx * 31 + wy * 7 + wx) % 10 < 3) {
            ctx.fillRect(bx + 12 + wx * 24, HORIZON_Y - bh + 14 + wy * 26, 6, 8);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    // horizon glow
    ctx.strokeStyle = '#ff6ec7';
    ctx.shadowColor = '#ff6ec7';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y);
    ctx.lineTo(W, HORIZON_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ground band between horizon and track
    ctx.fillStyle = '#0c0c1c';
    ctx.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);

    // scrolling perspective grid under the track
    ctx.strokeStyle = '#2a1a4a';
    ctx.lineWidth = 1;
    for (const gy of [GROUND_Y + 14, GROUND_Y + 34, GROUND_Y + 62]) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }
    const gridSpacing = 48;
    const gridOffset = st.dist % gridSpacing;
    for (let gx = -gridSpacing; gx < W + gridSpacing; gx += gridSpacing) {
      const x0 = gx - gridOffset;
      ctx.beginPath();
      ctx.moveTo(x0, GROUND_Y);
      ctx.lineTo(x0 - 30, H);
      ctx.stroke();
    }

    // track line
    ctx.strokeStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;

    // obstacles
    for (const o of st.obstacles) {
      if (o.overhead) {
        // hovering drone bar
        ctx.fillStyle = '#ff7a2d';
        ctx.shadowColor = '#ff7a2d';
        ctx.shadowBlur = 8;
        ctx.fillRect(o.x, GROUND_Y - 62, o.w, o.h);
        ctx.shadowBlur = 0;
        ctx.fillStyle = Math.floor(t * 4) % 2 === 0 ? '#ffe600' : '#ff2d78';
        ctx.fillRect(o.x + o.w / 2 - 2, GROUND_Y - 62 + o.h, 4, 4);
      } else {
        ctx.fillStyle = '#ff2d78';
        ctx.shadowColor = '#ff2d78';
        ctx.shadowBlur = 8;
        ctx.fillRect(o.x, GROUND_Y - o.h, o.w, o.h);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(o.x + 3, GROUND_Y - o.h + 3, o.w - 6, o.h - 6);
      }
    }

    // particles
    for (const p of st.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 5;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // player
    if (st.status !== 'over') {
      const ph = st.sliding ? SLIDE_H : RUN_H;
      const py = GROUND_Y - st.y - ph;
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 10;
      if (st.sliding) {
        ctx.fillRect(PLAYER_X - 14, py + 6, 28, ph - 6); // low body
        ctx.fillRect(PLAYER_X + 8, py, 8, 8); // head forward
      } else {
        ctx.fillRect(PLAYER_X - 4, py + 10, 9, ph - 18); // body
        ctx.fillRect(PLAYER_X - 4, py, 9, 9); // head
        if (st.y === 0) {
          const phase = Math.sin(st.dist * 0.06);
          ctx.fillRect(PLAYER_X - 4 + phase * 5, GROUND_Y - 10, 4, 10);
          ctx.fillRect(PLAYER_X - phase * 5, GROUND_Y - 10, 4, 10);
        } else {
          ctx.fillRect(PLAYER_X - 7, py + ph - 12, 5, 8); // tucked legs
          ctx.fillRect(PLAYER_X + 3, py + ph - 14, 5, 8);
        }
      }
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    if (st.status !== 'playing') {
      ctx.fillStyle = 'rgba(5, 5, 8, 0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = st.status === 'over' ? '#ff2d78' : '#00ffff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.font = 'bold 28px Consolas, monospace';
      ctx.fillText(st.status === 'over' ? 'WIPEOUT' : 'NIGHT RUN', W / 2, H / 2 - 20);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#888';
      ctx.font = '14px Consolas, monospace';
      ctx.fillText(
        st.status === 'over'
          ? `${Math.floor(st.dist / 10)}m — SPACE TO RUN AGAIN`
          : 'SPACE TO RUN',
        W / 2,
        H / 2 + 16
      );
    }
  });

  return (
    <div className={styles.gameWrap}>
      <div className={styles.hud} style={{ width: W }}>
        <span>DIST {score}m</span>
        <span>HI {highScore}</span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />
      <div className={styles.gameHint}>
        SPACE / &uarr; JUMP (HOLD = HIGHER) &middot; &darr; SLIDE &middot; M MENU &middot; ESC QUIT
      </div>
    </div>
  );
}
