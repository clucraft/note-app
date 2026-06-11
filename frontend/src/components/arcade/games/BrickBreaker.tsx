import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameLoop } from '../useGameLoop';
import { getHighScore, submitHighScore } from '../highScores';
import styles from '../Arcade.module.css';

const W = 480;
const H = 560;
const BASE_PADDLE_W = 80;
const EXPANDED_PADDLE_W = 124;
const PADDLE_H = 12;
const PADDLE_Y = H - 36;
const PADDLE_SPEED = 440;
const BALL_R = 7;
const BASE_BALL_SPEED = 330;
const MIN_BALL_SPEED = 180;
const MAX_BALLS = 6;
const BRICK_ROWS = 6;
const BRICK_COLS = 8;
const BRICK_TOP = 70;
const BRICK_GAP = 6;
const MARGIN = 24;
const BRICK_W = (W - MARGIN * 2 - BRICK_GAP * (BRICK_COLS - 1)) / BRICK_COLS;
const BRICK_H = 18;
const ROW_COLORS = ['#ff2d78', '#ff7a2d', '#ffe600', '#39ff14', '#00ffff', '#b14aff'];
const ROW_POINTS = [60, 50, 40, 30, 20, 10];

const CAPSULE_W = 28;
const CAPSULE_H = 14;
const CAPSULE_SPEED = 130;
const DROP_CHANCE = 0.2;
const EXPAND_SECONDS = 20;

type PowerType = 'expand' | 'slow' | 'multi' | 'points' | 'life';

const POWER_TYPES: { type: PowerType; letter: string; color: string; weight: number }[] = [
  { type: 'expand', letter: 'E', color: '#00ffff', weight: 25 },
  { type: 'slow', letter: 'S', color: '#ff7a2d', weight: 20 },
  { type: 'multi', letter: 'M', color: '#39ff14', weight: 25 },
  { type: 'points', letter: 'P', color: '#ffe600', weight: 20 },
  { type: 'life', letter: 'L', color: '#ff2d78', weight: 10 },
];

function randomPowerType(): PowerType {
  const total = POWER_TYPES.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * total;
  for (const p of POWER_TYPES) {
    roll -= p.weight;
    if (roll <= 0) return p.type;
  }
  return 'points';
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  stuck: boolean;
}

interface Capsule {
  x: number;
  y: number;
  type: PowerType;
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
}

interface State {
  paddleX: number;
  paddleW: number;
  expandTimer: number;
  balls: Ball[];
  capsules: Capsule[];
  particles: Particle[];
  bricks: boolean[][];
  bricksLeft: number;
  score: number;
  lives: number;
  level: number;
  status: 'playing' | 'over';
}

function freshBricks(): boolean[][] {
  return Array.from({ length: BRICK_ROWS }, () => Array(BRICK_COLS).fill(true));
}

function stuckBall(): Ball {
  return { x: W / 2, y: PADDLE_Y - BALL_R, vx: 0, vy: 0, stuck: true };
}

function initialState(): State {
  return {
    paddleX: (W - BASE_PADDLE_W) / 2,
    paddleW: BASE_PADDLE_W,
    expandTimer: 0,
    balls: [stuckBall()],
    capsules: [],
    particles: [],
    bricks: freshBricks(),
    bricksLeft: BRICK_ROWS * BRICK_COLS,
    score: 0,
    lives: 3,
    level: 1,
    status: 'playing',
  };
}

/** Reset paddle effects and capsules — on life lost and level cleared. */
function resetEffects(st: State) {
  st.paddleW = BASE_PADDLE_W;
  st.expandTimer = 0;
  st.capsules = [];
  st.paddleX = Math.min(W - st.paddleW, st.paddleX);
}

export function BrickBreaker({ onExit, onScore }: { onExit: () => void; onScore?: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(initialState());
  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;
  const keysRef = useRef({ left: false, right: false });
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState(() => getHighScore('breaker'));

  const launch = useCallback(() => {
    const st = stateRef.current;
    if (st.status === 'over') {
      stateRef.current = initialState();
      setScore(0);
      setLives(3);
      return;
    }
    const speed = BASE_BALL_SPEED + 30 * (st.level - 1);
    for (const b of st.balls) {
      if (!b.stuck) continue;
      const angle = (Math.random() * 60 - 30) * (Math.PI / 180);
      b.vx = speed * Math.sin(angle);
      b.vy = -speed * Math.cos(angle);
      b.stuck = false;
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === 'm') {
        onExit();
        return;
      }
      if (key === 'ArrowLeft' || key === 'a') {
        e.preventDefault();
        keysRef.current.left = true;
      }
      if (key === 'ArrowRight' || key === 'd') {
        e.preventDefault();
        keysRef.current.right = true;
      }
      if (key === ' ' || key === 'Enter') {
        e.preventDefault();
        launch();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === 'ArrowLeft' || key === 'a') keysRef.current.left = false;
      if (key === 'ArrowRight' || key === 'd') keysRef.current.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onExit, launch]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const st = stateRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    st.paddleX = Math.min(W - st.paddleW, Math.max(0, x - st.paddleW / 2));
  }, []);

  const applyPower = useCallback((st: State, type: PowerType) => {
    switch (type) {
      case 'expand': {
        st.paddleW = EXPANDED_PADDLE_W;
        st.expandTimer = EXPAND_SECONDS;
        st.paddleX = Math.min(W - st.paddleW, st.paddleX);
        break;
      }
      case 'slow': {
        for (const b of st.balls) {
          if (b.stuck) continue;
          const speed = Math.hypot(b.vx, b.vy);
          const slowed = Math.max(MIN_BALL_SPEED, speed * 0.75);
          b.vx = (b.vx / speed) * slowed;
          b.vy = (b.vy / speed) * slowed;
        }
        break;
      }
      case 'multi': {
        const moving = st.balls.filter((b) => !b.stuck);
        for (const b of moving) {
          if (st.balls.length >= MAX_BALLS) break;
          for (const da of [-25, 25]) {
            if (st.balls.length >= MAX_BALLS) break;
            const rad = (da * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            st.balls.push({
              x: b.x,
              y: b.y,
              vx: b.vx * cos - b.vy * sin,
              vy: b.vx * sin + b.vy * cos,
              stuck: false,
            });
          }
        }
        break;
      }
      case 'points':
        st.score += 500;
        break;
      case 'life':
        st.lives = Math.min(6, st.lives + 1);
        break;
    }
  }, []);

  useGameLoop((dt) => {
    const st = stateRef.current;

    if (st.status === 'playing') {
      // paddle
      if (keysRef.current.left) st.paddleX -= PADDLE_SPEED * dt;
      if (keysRef.current.right) st.paddleX += PADDLE_SPEED * dt;
      st.paddleX = Math.min(W - st.paddleW, Math.max(0, st.paddleX));

      // expand wears off
      if (st.expandTimer > 0) {
        st.expandTimer -= dt;
        if (st.expandTimer <= 0) {
          st.paddleW = BASE_PADDLE_W;
          st.expandTimer = 0;
        }
      }

      for (const b of st.balls) {
        if (b.stuck) {
          b.x = st.paddleX + st.paddleW / 2;
          b.y = PADDLE_Y - BALL_R;
          continue;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // walls
        if (b.x - BALL_R < 0) {
          b.x = BALL_R;
          b.vx = Math.abs(b.vx);
        }
        if (b.x + BALL_R > W) {
          b.x = W - BALL_R;
          b.vx = -Math.abs(b.vx);
        }
        if (b.y - BALL_R < 0) {
          b.y = BALL_R;
          b.vy = Math.abs(b.vy);
        }

        // paddle
        if (
          b.vy > 0 &&
          b.y + BALL_R >= PADDLE_Y &&
          b.y + BALL_R <= PADDLE_Y + PADDLE_H + 8 &&
          b.x >= st.paddleX - BALL_R &&
          b.x <= st.paddleX + st.paddleW + BALL_R
        ) {
          const speed = Math.hypot(b.vx, b.vy);
          const rel = (b.x - (st.paddleX + st.paddleW / 2)) / (st.paddleW / 2);
          const angle = rel * (Math.PI / 3); // up to 60°
          b.vx = speed * Math.sin(angle);
          b.vy = -speed * Math.cos(angle);
          b.y = PADDLE_Y - BALL_R;
        }

        // bricks (one hit per ball per frame)
        outer: for (let r = 0; r < BRICK_ROWS; r++) {
          for (let c = 0; c < BRICK_COLS; c++) {
            if (!st.bricks[r][c]) continue;
            const bx = MARGIN + c * (BRICK_W + BRICK_GAP);
            const by = BRICK_TOP + r * (BRICK_H + BRICK_GAP);
            if (
              b.x + BALL_R > bx &&
              b.x - BALL_R < bx + BRICK_W &&
              b.y + BALL_R > by &&
              b.y - BALL_R < by + BRICK_H
            ) {
              st.bricks[r][c] = false;
              st.bricksLeft--;
              st.score += ROW_POINTS[r];
              for (let i = 0; i < 8; i++) {
                const life = 0.4 + Math.random() * 0.35;
                st.particles.push({
                  x: bx + Math.random() * BRICK_W,
                  y: by + Math.random() * BRICK_H,
                  vx: (Math.random() - 0.5) * 240,
                  vy: -40 - Math.random() * 160,
                  life,
                  maxLife: life,
                  size: 2 + Math.random() * 3,
                  color: ROW_COLORS[r],
                });
              }
              if (Math.random() < DROP_CHANCE) {
                st.capsules.push({
                  x: bx + BRICK_W / 2,
                  y: by + BRICK_H / 2,
                  type: randomPowerType(),
                });
              }
              const ox = Math.min(b.x + BALL_R - bx, bx + BRICK_W - (b.x - BALL_R));
              const oy = Math.min(b.y + BALL_R - by, by + BRICK_H - (b.y - BALL_R));
              if (ox < oy) b.vx = -b.vx;
              else b.vy = -b.vy;
              break outer;
            }
          }
        }
      }

      // lost balls
      st.balls = st.balls.filter((b) => b.y - BALL_R <= H);
      if (st.balls.length === 0) {
        st.lives--;
        resetEffects(st);
        if (st.lives <= 0) {
          st.status = 'over';
          submitHighScore('breaker', st.score);
          setHighScore(getHighScore('breaker'));
          onScoreRef.current?.(st.score);
        } else {
          st.balls = [stuckBall()];
        }
      }

      // capsules fall, get caught or missed
      for (const cap of st.capsules) cap.y += CAPSULE_SPEED * dt;
      st.capsules = st.capsules.filter((cap) => {
        if (
          cap.y + CAPSULE_H / 2 >= PADDLE_Y &&
          cap.y - CAPSULE_H / 2 <= PADDLE_Y + PADDLE_H &&
          cap.x + CAPSULE_W / 2 >= st.paddleX &&
          cap.x - CAPSULE_W / 2 <= st.paddleX + st.paddleW
        ) {
          applyPower(st, cap.type);
          return false;
        }
        return cap.y - CAPSULE_H / 2 < H;
      });

      // level cleared
      if (st.status === 'playing' && st.bricksLeft === 0) {
        st.level++;
        st.bricks = freshBricks();
        st.bricksLeft = BRICK_ROWS * BRICK_COLS;
        resetEffects(st);
        st.balls = [stuckBall()];
      }
    }

    // particles keep animating regardless of game state
    for (const p of st.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 600 * dt;
      p.life -= dt;
    }
    st.particles = st.particles.filter((p) => p.life > 0);

    setScore(st.score);
    setLives(st.lives);

    // draw
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        if (!st.bricks[r][c]) continue;
        const bx = MARGIN + c * (BRICK_W + BRICK_GAP);
        const by = BRICK_TOP + r * (BRICK_H + BRICK_GAP);
        ctx.fillStyle = ROW_COLORS[r];
        ctx.shadowColor = ROW_COLORS[r];
        ctx.shadowBlur = 6;
        ctx.fillRect(bx, by, BRICK_W, BRICK_H);
      }
    }
    ctx.shadowBlur = 0;

    // brick shards
    for (const p of st.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // capsules
    for (const cap of st.capsules) {
      const def = POWER_TYPES.find((p) => p.type === cap.type)!;
      ctx.fillStyle = def.color;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(cap.x - CAPSULE_W / 2, cap.y - CAPSULE_H / 2, CAPSULE_W, CAPSULE_H, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0a0a12';
      ctx.font = 'bold 11px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.letter, cap.x, cap.y + 1);
      ctx.textBaseline = 'alphabetic';
    }

    // paddle
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.fillRect(st.paddleX, PADDLE_Y, st.paddleW, PADDLE_H);

    // balls
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    for (const b of st.balls) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    const anyStuck = st.balls.some((b) => b.stuck);
    if (st.status === 'over' || anyStuck) {
      ctx.textAlign = 'center';
      if (st.status === 'over') {
        ctx.fillStyle = 'rgba(5, 5, 8, 0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ff2d78';
        ctx.shadowColor = '#ff2d78';
        ctx.shadowBlur = 10;
        ctx.font = 'bold 28px Consolas, monospace';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 20);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#888';
        ctx.font = '14px Consolas, monospace';
        ctx.fillText('SPACE TO RETRY', W / 2, H / 2 + 16);
      } else {
        ctx.fillStyle = '#888';
        ctx.font = '14px Consolas, monospace';
        ctx.fillText('SPACE TO LAUNCH', W / 2, H / 2 + 60);
      }
    }
  });

  return (
    <div className={styles.gameWrap}>
      <div className={styles.hud} style={{ width: W }}>
        <span>SCORE {score}</span>
        <span>LIVES {'◆'.repeat(Math.max(0, lives))}</span>
        <span>HI {highScore}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className={styles.canvas}
        onMouseMove={onMouseMove}
        onClick={launch}
      />
      <div className={styles.gameHint}>
        MOUSE / ARROWS MOVE &middot; SPACE LAUNCH &middot; M MENU &middot; ESC QUIT
      </div>
    </div>
  );
}
