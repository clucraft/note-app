import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameLoop } from '../useGameLoop';
import { getHighScore, submitHighScore } from '../highScores';
import { sfx } from '../audio';
import styles from '../Arcade.module.css';

const W = 480;
const H = 560;
const BASE_PADDLE_W = 80;
const EXPANDED_PADDLE_W = 124;
const SHRUNK_PADDLE_W = 56;
const PADDLE_H = 12;
const PADDLE_Y = H - 36;
const PADDLE_SPEED = 440;
const BALL_R = 7;
const BASE_BALL_SPEED = 330;
const MIN_BALL_SPEED = 180;
const MAX_BALL_SPEED = 560;
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
const DROP_CHANCE = 0.25;
const LASER_SECONDS = 12;
const FIRE_SECONDS = 10;
const PADDLE_EFFECT_SECONDS = 20;
const SHRINK_SECONDS = 15;
const CATCH_AUTO_RELEASE = 2.5;
const BOLT_SPEED = 500;
const BOLT_COOLDOWN = 0.3;
const SHIELD_Y = H - 8;

type PowerType =
  | 'expand'
  | 'slow'
  | 'multi'
  | 'points'
  | 'life'
  | 'laser'
  | 'fire'
  | 'catch'
  | 'shield'
  | 'shrink'
  | 'haste';

const POWER_TYPES: { type: PowerType; letter: string; color: string; weight: number }[] = [
  { type: 'expand', letter: 'E', color: '#00ffff', weight: 13 },
  { type: 'slow', letter: 'S', color: '#4a9bff', weight: 9 },
  { type: 'multi', letter: 'M', color: '#39ff14', weight: 13 },
  { type: 'points', letter: 'P', color: '#ffe600', weight: 10 },
  { type: 'life', letter: '♥', color: '#ff00ff', weight: 5 },
  { type: 'laser', letter: 'L', color: '#ffffff', weight: 12 },
  { type: 'fire', letter: 'F', color: '#ff7a2d', weight: 10 },
  { type: 'catch', letter: 'C', color: '#b14aff', weight: 12 },
  { type: 'shield', letter: 'W', color: '#39ff14', weight: 10 },
  { type: 'shrink', letter: '−', color: '#ff2222', weight: 3 },
  { type: 'haste', letter: '!', color: '#ff2222', weight: 3 },
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
  stuckOffset: number;
  stuckTimer: number;
}

interface Capsule {
  x: number;
  y: number;
  type: PowerType;
}

interface Bolt {
  x: number;
  y: number;
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
  paddleX: number;
  paddleW: number;
  paddleTimer: number;
  laserTimer: number;
  fireTimer: number;
  catchOn: boolean;
  shieldOn: boolean;
  boltCooldown: number;
  shake: number;
  shakeMag: number;
  balls: Ball[];
  capsules: Capsule[];
  bolts: Bolt[];
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
  return {
    x: W / 2,
    y: PADDLE_Y - BALL_R,
    vx: 0,
    vy: 0,
    stuck: true,
    stuckOffset: 0,
    stuckTimer: 0,
  };
}

function initialState(): State {
  return {
    paddleX: (W - BASE_PADDLE_W) / 2,
    paddleW: BASE_PADDLE_W,
    paddleTimer: 0,
    laserTimer: 0,
    fireTimer: 0,
    catchOn: false,
    shieldOn: false,
    boltCooldown: 0,
    shake: 0,
    shakeMag: 0,
    balls: [stuckBall()],
    capsules: [],
    bolts: [],
    particles: [],
    bricks: freshBricks(),
    bricksLeft: BRICK_ROWS * BRICK_COLS,
    score: 0,
    lives: 3,
    level: 1,
    status: 'playing',
  };
}

/** Reset all active effects — on life lost and level cleared. */
function resetEffects(st: State) {
  st.paddleW = BASE_PADDLE_W;
  st.paddleTimer = 0;
  st.laserTimer = 0;
  st.fireTimer = 0;
  st.catchOn = false;
  st.shieldOn = false;
  st.capsules = [];
  st.bolts = [];
  st.paddleX = Math.min(W - st.paddleW, st.paddleX);
}

function spawnBurst(
  st: State,
  x: number,
  y: number,
  color: string,
  count: number,
  speed = 240,
  gravity = 600
) {
  for (let i = 0; i < count; i++) {
    const life = 0.35 + Math.random() * 0.35;
    const angle = Math.random() * Math.PI * 2;
    const v = (0.3 + Math.random() * 0.7) * speed;
    st.particles.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v - 60,
      life,
      maxLife: life,
      size: 2 + Math.random() * 3,
      color,
      gravity,
    });
  }
}

export function BrickBreaker({ onExit, onScore }: { onExit: () => void; onScore?: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(initialState());
  const keysRef = useRef({ left: false, right: false });
  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState(() => getHighScore('breaker'));

  const destroyBrick = useCallback((st: State, r: number, c: number, fiery: boolean) => {
    const bx = MARGIN + c * (BRICK_W + BRICK_GAP);
    const by = BRICK_TOP + r * (BRICK_H + BRICK_GAP);
    st.bricks[r][c] = false;
    st.bricksLeft--;
    st.score += ROW_POINTS[r];
    sfx.brick();
    spawnBurst(st, bx + BRICK_W / 2, by + BRICK_H / 2, ROW_COLORS[r], fiery ? 12 : 8);
    if (fiery) {
      spawnBurst(st, bx + BRICK_W / 2, by + BRICK_H / 2, '#ff7a2d', 6, 180);
      st.shake = 0.08;
      st.shakeMag = 2;
    }
    if (Math.random() < DROP_CHANCE) {
      st.capsules.push({ x: bx + BRICK_W / 2, y: by + BRICK_H / 2, type: randomPowerType() });
    }
  }, []);

  const fireOrLaunch = useCallback(() => {
    const st = stateRef.current;
    if (st.status === 'over') {
      stateRef.current = initialState();
      setScore(0);
      setLives(3);
      return;
    }
    const stuck = st.balls.filter((b) => b.stuck);
    if (stuck.length > 0) {
      for (const b of stuck) {
        const center = st.paddleX + st.paddleW / 2;
        const rel = (b.x - center) / (st.paddleW / 2);
        const speed = BASE_BALL_SPEED + 30 * (st.level - 1);
        const angle =
          Math.abs(rel) > 0.05 ? rel * (Math.PI / 3) : (Math.random() * 60 - 30) * (Math.PI / 180);
        b.vx = speed * Math.sin(angle);
        b.vy = -speed * Math.cos(angle);
        b.stuck = false;
        b.stuckTimer = 0;
      }
      sfx.bounce(880);
      return;
    }
    if (st.laserTimer > 0 && st.boltCooldown <= 0 && st.bolts.length < 6) {
      st.bolts.push({ x: st.paddleX + 6, y: PADDLE_Y - 4 });
      st.bolts.push({ x: st.paddleX + st.paddleW - 6, y: PADDLE_Y - 4 });
      st.boltCooldown = BOLT_COOLDOWN;
      sfx.zap();
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
        fireOrLaunch();
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
  }, [onExit, fireOrLaunch]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const st = stateRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    st.paddleX = Math.min(W - st.paddleW, Math.max(0, x - st.paddleW / 2));
  }, []);

  const applyPower = useCallback((st: State, type: PowerType) => {
    switch (type) {
      case 'expand':
        st.paddleW = EXPANDED_PADDLE_W;
        st.paddleTimer = PADDLE_EFFECT_SECONDS;
        st.paddleX = Math.min(W - st.paddleW, st.paddleX);
        break;
      case 'shrink':
        st.paddleW = SHRUNK_PADDLE_W;
        st.paddleTimer = SHRINK_SECONDS;
        break;
      case 'slow':
        for (const b of st.balls) {
          if (b.stuck) continue;
          const speed = Math.hypot(b.vx, b.vy);
          const slowed = Math.max(MIN_BALL_SPEED, speed * 0.75);
          b.vx = (b.vx / speed) * slowed;
          b.vy = (b.vy / speed) * slowed;
        }
        break;
      case 'haste':
        for (const b of st.balls) {
          if (b.stuck) continue;
          const speed = Math.hypot(b.vx, b.vy);
          const fast = Math.min(MAX_BALL_SPEED, speed * 1.35);
          b.vx = (b.vx / speed) * fast;
          b.vy = (b.vy / speed) * fast;
        }
        break;
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
              stuckOffset: 0,
              stuckTimer: 0,
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
      case 'laser':
        st.laserTimer = LASER_SECONDS;
        break;
      case 'fire':
        st.fireTimer = FIRE_SECONDS;
        break;
      case 'catch':
        st.catchOn = true;
        break;
      case 'shield':
        st.shieldOn = true;
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

      // effect timers
      if (st.paddleTimer > 0) {
        st.paddleTimer -= dt;
        if (st.paddleTimer <= 0) {
          st.paddleW = BASE_PADDLE_W;
          st.paddleX = Math.min(W - st.paddleW, st.paddleX);
        }
      }
      st.laserTimer = Math.max(0, st.laserTimer - dt);
      st.fireTimer = Math.max(0, st.fireTimer - dt);
      st.boltCooldown = Math.max(0, st.boltCooldown - dt);

      const fiery = st.fireTimer > 0;

      for (const b of st.balls) {
        if (b.stuck) {
          const center = st.paddleX + st.paddleW / 2;
          b.x = Math.max(
            st.paddleX + BALL_R,
            Math.min(st.paddleX + st.paddleW - BALL_R, center + b.stuckOffset)
          );
          b.y = PADDLE_Y - BALL_R;
          b.stuckTimer += dt;
          if (b.stuckTimer > CATCH_AUTO_RELEASE) {
            const rel = (b.x - center) / (st.paddleW / 2);
            const speed = BASE_BALL_SPEED + 30 * (st.level - 1);
            const angle = rel * (Math.PI / 3);
            b.vx = speed * Math.sin(angle);
            b.vy = -speed * Math.cos(angle);
            b.stuck = false;
            b.stuckTimer = 0;
          }
          continue;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // ball trail
        if (Math.random() < (fiery ? 0.9 : 0.4)) {
          const life = fiery ? 0.3 : 0.18;
          st.particles.push({
            x: b.x + (Math.random() - 0.5) * 4,
            y: b.y + (Math.random() - 0.5) * 4,
            vx: -b.vx * 0.05,
            vy: -b.vy * 0.05,
            life,
            maxLife: life,
            size: fiery ? 2.5 : 1.5,
            color: fiery ? (Math.random() < 0.5 ? '#ff7a2d' : '#ffe600') : '#557788',
            gravity: 0,
          });
        }

        // walls
        if (b.x - BALL_R < 0) {
          b.x = BALL_R;
          b.vx = Math.abs(b.vx);
          sfx.bounce(700);
          spawnBurst(st, 2, b.y, '#00ffff', 3, 120, 200);
        }
        if (b.x + BALL_R > W) {
          b.x = W - BALL_R;
          b.vx = -Math.abs(b.vx);
          sfx.bounce(700);
          spawnBurst(st, W - 2, b.y, '#00ffff', 3, 120, 200);
        }
        if (b.y - BALL_R < 0) {
          b.y = BALL_R;
          b.vy = Math.abs(b.vy);
          sfx.bounce(700);
          spawnBurst(st, b.x, 2, '#00ffff', 3, 120, 200);
        }

        // paddle
        if (
          b.vy > 0 &&
          b.y + BALL_R >= PADDLE_Y &&
          b.y + BALL_R <= PADDLE_Y + PADDLE_H + 8 &&
          b.x >= st.paddleX - BALL_R &&
          b.x <= st.paddleX + st.paddleW + BALL_R
        ) {
          if (st.catchOn) {
            b.stuck = true;
            b.stuckOffset = b.x - (st.paddleX + st.paddleW / 2);
            b.stuckTimer = 0;
            b.vx = 0;
            b.vy = 0;
            b.y = PADDLE_Y - BALL_R;
            sfx.bounce(440);
          } else {
            const speed = Math.hypot(b.vx, b.vy);
            const rel = (b.x - (st.paddleX + st.paddleW / 2)) / (st.paddleW / 2);
            const angle = rel * (Math.PI / 3); // up to 60°
            b.vx = speed * Math.sin(angle);
            b.vy = -speed * Math.cos(angle);
            b.y = PADDLE_Y - BALL_R;
            sfx.bounce(440);
            spawnBurst(st, b.x, PADDLE_Y, '#00ffff', 4, 140, 300);
          }
        }

        // shield save
        if (st.shieldOn && b.vy > 0 && b.y + BALL_R >= SHIELD_Y) {
          st.shieldOn = false;
          b.y = SHIELD_Y - BALL_R;
          b.vy = -Math.abs(b.vy);
          sfx.explosion();
          for (let i = 0; i < 24; i++) {
            const life = 0.4 + Math.random() * 0.3;
            st.particles.push({
              x: (i / 24) * W + Math.random() * 16,
              y: SHIELD_Y,
              vx: (Math.random() - 0.5) * 120,
              vy: -Math.random() * 160,
              life,
              maxLife: life,
              size: 2 + Math.random() * 2,
              color: '#39ff14',
              gravity: 400,
            });
          }
          st.shake = 0.1;
          st.shakeMag = 2;
        }

        // bricks — fireball plows through, normal ball bounces off the first hit
        for (let r = 0; r < BRICK_ROWS; r++) {
          let bounced = false;
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
              destroyBrick(st, r, c, fiery);
              if (!fiery) {
                const ox = Math.min(b.x + BALL_R - bx, bx + BRICK_W - (b.x - BALL_R));
                const oy = Math.min(b.y + BALL_R - by, by + BRICK_H - (b.y - BALL_R));
                if (ox < oy) b.vx = -b.vx;
                else b.vy = -b.vy;
                bounced = true;
                break;
              }
            }
          }
          if (bounced) break;
        }
      }

      // lost balls
      const before = st.balls.length;
      st.balls = st.balls.filter((b) => b.y - BALL_R <= H);
      if (st.balls.length < before && st.balls.length === 0) {
        st.lives--;
        spawnBurst(st, W / 2, H - 6, '#ff2d78', 16, 200);
        st.shake = 0.15;
        st.shakeMag = 3;
        resetEffects(st);
        if (st.lives <= 0) {
          st.status = 'over';
          submitHighScore('breaker', st.score);
          setHighScore(getHighScore('breaker'));
          sfx.over();
          onScoreRef.current?.(st.score);
        } else {
          sfx.thud();
          st.balls = [stuckBall()];
        }
      }

      // laser bolts
      st.bolts = st.bolts.filter((bolt) => {
        bolt.y -= BOLT_SPEED * dt;
        for (let r = BRICK_ROWS - 1; r >= 0; r--) {
          for (let c = 0; c < BRICK_COLS; c++) {
            if (!st.bricks[r][c]) continue;
            const bx = MARGIN + c * (BRICK_W + BRICK_GAP);
            const by = BRICK_TOP + r * (BRICK_H + BRICK_GAP);
            if (bolt.x > bx && bolt.x < bx + BRICK_W && bolt.y < by + BRICK_H && bolt.y > by - 6) {
              destroyBrick(st, r, c, false);
              return false;
            }
          }
        }
        return bolt.y > -10;
      });

      // capsules fall, get caught or missed
      for (const cap of st.capsules) cap.y += CAPSULE_SPEED * dt;
      st.capsules = st.capsules.filter((cap) => {
        if (
          cap.y + CAPSULE_H / 2 >= PADDLE_Y &&
          cap.y - CAPSULE_H / 2 <= PADDLE_Y + PADDLE_H &&
          cap.x + CAPSULE_W / 2 >= st.paddleX &&
          cap.x - CAPSULE_W / 2 <= st.paddleX + st.paddleW
        ) {
          const def = POWER_TYPES.find((p) => p.type === cap.type)!;
          const negative = cap.type === 'shrink' || cap.type === 'haste';
          if (negative) sfx.thud();
          else sfx.pickup();
          spawnBurst(st, cap.x, PADDLE_Y, def.color, 10, 180, 300);
          applyPower(st, cap.type);
          return false;
        }
        return cap.y - CAPSULE_H / 2 < H;
      });

      // level cleared — fireworks!
      if (st.status === 'playing' && st.bricksLeft === 0) {
        sfx.sweep();
        for (let i = 0; i < 6; i++) {
          spawnBurst(
            st,
            60 + Math.random() * (W - 120),
            90 + Math.random() * 200,
            ROW_COLORS[Math.floor(Math.random() * ROW_COLORS.length)],
            14,
            260,
            300
          );
        }
        st.level++;
        st.bricks = freshBricks();
        st.bricksLeft = BRICK_ROWS * BRICK_COLS;
        resetEffects(st);
        st.balls = [stuckBall()];
      }
    }

    // particles + shake keep animating regardless of game state
    for (const p of st.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= dt;
    }
    st.particles = st.particles.filter((p) => p.life > 0);
    st.shake = Math.max(0, st.shake - dt);

    setScore(st.score);
    setLives(st.lives);

    // draw
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (st.shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * 2 * st.shakeMag,
        (Math.random() - 0.5) * 2 * st.shakeMag
      );
    }

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

    // particles
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

    // shield
    if (st.shieldOn) {
      ctx.strokeStyle = '#39ff14';
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, SHIELD_Y);
      ctx.lineTo(W, SHIELD_Y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
    }

    // laser bolts
    ctx.fillStyle = '#ff4444';
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 8;
    for (const bolt of st.bolts) ctx.fillRect(bolt.x - 1.5, bolt.y - 10, 3, 10);
    ctx.shadowBlur = 0;

    // paddle (+ cannons while laser is active)
    ctx.fillStyle = st.catchOn ? '#b14aff' : '#00ffff';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.fillRect(st.paddleX, PADDLE_Y, st.paddleW, PADDLE_H);
    if (st.laserTimer > 0) {
      ctx.fillStyle = '#ff4444';
      ctx.shadowColor = '#ff4444';
      ctx.fillRect(st.paddleX + 2, PADDLE_Y - 6, 8, 6);
      ctx.fillRect(st.paddleX + st.paddleW - 10, PADDLE_Y - 6, 8, 6);
    }
    ctx.shadowBlur = 0;

    // balls
    const fieryDraw = st.fireTimer > 0;
    ctx.fillStyle = fieryDraw ? '#ffb347' : '#ffffff';
    ctx.shadowColor = fieryDraw ? '#ff7a2d' : '#ffffff';
    ctx.shadowBlur = fieryDraw ? 14 : 8;
    for (const b of st.balls) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    ctx.restore();

    const allStuck = st.balls.length > 0 && st.balls.every((b) => b.stuck);
    if (st.status === 'over' || allStuck) {
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
        onClick={fireOrLaunch}
      />
      <div className={styles.gameHint}>
        MOUSE / ARROWS MOVE &middot; SPACE LAUNCH / FIRE &middot; M MENU &middot; ESC QUIT
      </div>
    </div>
  );
}
