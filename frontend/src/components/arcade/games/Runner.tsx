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
const SPEED_RAMP = 8;
const JUMP_VY = -520;
const GRAVITY_HELD = 1100;
const GRAVITY = 2000;

const RUN_W = 18;
const RUN_H = 38;
const SLIDE_H = 20;

const BULLET_SPEED = 700;
const LASER_SPEED = 900;
const BASE_FIRE_CD = 0.4;
const RAPID_FIRE_CD = 0.12;
const LASER_FIRE_CD = 0.25;

const COSTS = { rapid: 10, laser: 25, invincible: 40 };
const RAPID_SECONDS = 15;
const LASER_SECONDS = 10;
const INVINCIBLE_SECONDS = 6;

interface Obstacle {
  x: number;
  w: number;
  h: number;
  overhead: boolean;
  hp: number;
}

interface Enemy {
  x: number;
  baseY: number; // height above ground
  type: 'drone' | 'crawler';
  phase: number;
}

interface Coin {
  x: number;
  y: number; // height above ground
}

interface Bullet {
  x: number;
  y: number; // absolute canvas y
  pierce: boolean;
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
  dist: number;
  speed: number;
  y: number;
  vy: number;
  sliding: boolean;
  wallet: number;
  bonus: number; // score from coins/kills, added to distance
  obstacles: Obstacle[];
  enemies: Enemy[];
  coins: Coin[];
  bullets: Bullet[];
  toNext: number;
  enemyTimer: number;
  coinTimer: number;
  fireCooldown: number;
  rapidTimer: number;
  laserTimer: number;
  invTimer: number;
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
    wallet: 0,
    bonus: 0,
    obstacles: [],
    enemies: [],
    coins: [],
    bullets: [],
    toNext: 500,
    enemyTimer: 6,
    coinTimer: 2,
    fireCooldown: 0,
    rapidTimer: 0,
    laserTimer: 0,
    invTimer: 0,
    particles: [],
    shake: 0,
    status: 'ready',
  };
}

function hash(i: number): number {
  let x = (i * 2654435761) >>> 0;
  x ^= x >> 13;
  x = (x * 1274126177) >>> 0;
  x ^= x >> 16;
  return x % 100000;
}

function totalScore(st: State): number {
  return Math.floor(st.dist / 10) + st.bonus;
}

export function Runner({ onExit, onScore }: { onExit: () => void; onScore?: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(initialState());
  const jumpHeldRef = useRef(false);
  const fireHeldRef = useRef(false);
  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;
  const [score, setScore] = useState(0);
  const [wallet, setWallet] = useState(0);
  const [highScore, setHighScore] = useState(() => getHighScore('runner'));

  const spawnBurst = useCallback(
    (st: State, x: number, y: number, color: string, count: number, speed = 200) => {
      for (let i = 0; i < count; i++) {
        const life = 0.3 + Math.random() * 0.35;
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
          gravity: 500,
        });
      }
    },
    []
  );

  const die = useCallback(
    (st: State) => {
      st.status = 'over';
      st.shake = 0.25;
      sfx.explosion(true);
      sfx.over();
      spawnBurst(st, PLAYER_X, GROUND_Y - st.y - RUN_H / 2, '#00ffff', 14, 280);
      spawnBurst(st, PLAYER_X, GROUND_Y - st.y - RUN_H / 2, '#ff2d78', 10, 280);
      const finalScore = totalScore(st);
      submitHighScore('runner', finalScore);
      setHighScore(getHighScore('runner'));
      onScoreRef.current?.(finalScore);
    },
    [spawnBurst]
  );

  const buy = useCallback((st: State, which: 'rapid' | 'laser' | 'invincible') => {
    if (st.status !== 'playing') return;
    const cost = COSTS[which];
    if (st.wallet < cost) {
      sfx.thud();
      return;
    }
    st.wallet -= cost;
    sfx.sweep();
    if (which === 'rapid') st.rapidTimer = RAPID_SECONDS;
    else if (which === 'laser') st.laserTimer = LASER_SECONDS;
    else st.invTimer = INVINCIBLE_SECONDS;
  }, []);

  const jumpOrStart = useCallback(() => {
    const st = stateRef.current;
    if (st.status !== 'playing') {
      stateRef.current = initialState();
      stateRef.current.status = 'playing';
      setScore(0);
      setWallet(0);
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
      } else if (key === 'ArrowDown' || key === 's') {
        e.preventDefault();
        if (st.status === 'playing' && st.y === 0) st.sliding = true;
      } else if (key === 'x' || key === 'f') {
        e.preventDefault();
        fireHeldRef.current = true;
      } else if (key === '1') {
        buy(st, 'rapid');
      } else if (key === '2') {
        buy(st, 'laser');
      } else if (key === '3') {
        buy(st, 'invincible');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'Enter') {
        jumpHeldRef.current = false;
      } else if (key === 'ArrowDown' || key === 's') {
        stateRef.current.sliding = false;
      } else if (key === 'x' || key === 'f') {
        fireHeldRef.current = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onExit, jumpOrStart, buy]);

  useGameLoop((dt) => {
    const st = stateRef.current;

    if (st.status === 'playing') {
      st.speed = Math.min(MAX_SPEED, st.speed + SPEED_RAMP * dt);
      st.dist += st.speed * dt;
      st.rapidTimer = Math.max(0, st.rapidTimer - dt);
      st.laserTimer = Math.max(0, st.laserTimer - dt);
      st.invTimer = Math.max(0, st.invTimer - dt);
      st.fireCooldown = Math.max(0, st.fireCooldown - dt);

      // jump physics
      if (st.y > 0 || st.vy !== 0) {
        const g = jumpHeldRef.current && st.vy < 0 ? GRAVITY_HELD : GRAVITY;
        st.vy += g * dt;
        st.y -= st.vy * dt;
        if (st.y <= 0) {
          st.y = 0;
          st.vy = 0;
          for (let i = 0; i < 4; i++) {
            const life = 0.2 + Math.random() * 0.15;
            st.particles.push({
              x: PLAYER_X + (Math.random() - 0.5) * 12,
              y: GROUND_Y,
              vx: -st.speed * 0.15,
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
          color: st.invTimer > 0 ? '#ffe600' : '#445566',
          gravity: 200,
        });
      }

      // firing
      if (fireHeldRef.current && st.fireCooldown === 0) {
        const laser = st.laserTimer > 0;
        st.fireCooldown = laser ? LASER_FIRE_CD : st.rapidTimer > 0 ? RAPID_FIRE_CD : BASE_FIRE_CD;
        const by = GROUND_Y - st.y - (st.sliding ? 10 : 26);
        st.bullets.push({ x: PLAYER_X + 12, y: by, pierce: laser });
        sfx.zap();
      }

      // ---- spawning ----
      // obstacles, with variety
      st.toNext -= st.speed * dt;
      if (st.toNext <= 0) {
        const d = st.dist;
        const roll = Math.random();
        if (d > 2400 && roll < 0.25) {
          st.obstacles.push({ x: W + 40, w: 34, h: 26, overhead: true, hp: 1 });
        } else if (d > 1500 && roll < 0.4) {
          // tall block — needs a full jump
          st.obstacles.push({ x: W + 40, w: 20, h: 46 + Math.random() * 10, overhead: false, hp: 2 });
        } else if (d > 3000 && roll < 0.55) {
          // staggered pair
          st.obstacles.push({ x: W + 40, w: 18, h: 28, overhead: false, hp: 1 });
          st.obstacles.push({ x: W + 130 + Math.random() * 40, w: 18, h: 36, overhead: false, hp: 1 });
        } else if (d > 5000 && roll < 0.65) {
          // bar + block combo: slide then jump
          st.obstacles.push({ x: W + 40, w: 34, h: 26, overhead: true, hp: 1 });
          st.obstacles.push({ x: W + 200, w: 20, h: 32, overhead: false, hp: 1 });
        } else {
          const wdt = 18 + Math.random() * 16;
          st.obstacles.push({ x: W + 40, w: wdt, h: 26 + Math.random() * 16, overhead: false, hp: 1 });
        }
        st.toNext = 280 + Math.random() * 300 + st.speed * 0.35;
      }

      // enemies
      if (st.dist > 1200) {
        st.enemyTimer -= dt;
        if (st.enemyTimer <= 0) {
          st.enemyTimer = Math.max(1.2, 4.5 - st.dist / 4000) + Math.random() * 1.5;
          if (Math.random() < 0.6) {
            st.enemies.push({
              x: W + 30,
              baseY: 30 + Math.random() * 90,
              type: 'drone',
              phase: Math.random() * 10,
            });
          } else {
            st.enemies.push({ x: W + 30, baseY: 0, type: 'crawler', phase: 0 });
          }
        }
      }

      // coin rows and arcs
      st.coinTimer -= dt;
      if (st.coinTimer <= 0) {
        st.coinTimer = 1.6 + Math.random() * 2.2;
        const n = 3 + Math.floor(Math.random() * 3);
        const arc = Math.random() < 0.4;
        const baseY = arc ? 50 : 16 + Math.random() * 70;
        for (let i = 0; i < n; i++) {
          const y = arc ? baseY + Math.sin((i / (n - 1)) * Math.PI) * 45 : baseY;
          st.coins.push({ x: W + 30 + i * 34, y });
        }
      }

      // ---- movement & collisions ----
      const playerH = st.sliding ? SLIDE_H : RUN_H;
      const px1 = PLAYER_X - RUN_W / 2 + 2;
      const px2 = PLAYER_X + RUN_W / 2 - 2;
      const py1 = GROUND_Y - st.y - playerH + 2;
      const py2 = GROUND_Y - st.y - 2;
      const inv = st.invTimer > 0;

      // obstacles
      for (const o of st.obstacles) {
        o.x -= st.speed * dt;
        const oy1 = o.overhead ? GROUND_Y - 62 : GROUND_Y - o.h;
        const oy2 = o.overhead ? GROUND_Y - 62 + o.h : GROUND_Y;
        if (px2 > o.x && px1 < o.x + o.w && py2 > oy1 && py1 < oy2) {
          if (inv) {
            o.hp = 0;
            spawnBurst(st, o.x + o.w / 2, (oy1 + oy2) / 2, '#ffe600', 10, 240);
            sfx.brick();
            st.bonus += 5;
          } else {
            die(st);
            break;
          }
        }
      }
      st.obstacles = st.obstacles.filter((o) => o.hp > 0 && o.x + o.w > -20);

      if (st.status === 'playing') {
        // enemies
        for (const en of st.enemies) {
          en.x -= (st.speed + (en.type === 'crawler' ? 110 : 60)) * dt;
          en.phase += dt * 3;
          const ey = en.type === 'drone' ? en.baseY + Math.sin(en.phase) * 18 : 7;
          const ey1 = GROUND_Y - ey - 10;
          const ey2 = GROUND_Y - ey + 10;
          if (px2 > en.x - 10 && px1 < en.x + 10 && py2 > ey1 && py1 < ey2) {
            if (inv) {
              en.phase = -999; // mark dead
              spawnBurst(st, en.x, (ey1 + ey2) / 2, '#ffe600', 12, 260);
              sfx.brick();
              st.bonus += 30;
            } else {
              die(st);
              break;
            }
          }
        }
        st.enemies = st.enemies.filter((en) => en.phase !== -999 && en.x > -30);
      }

      if (st.status === 'playing') {
        // bullets
        st.bullets = st.bullets.filter((b) => {
          b.x += (b.pierce ? LASER_SPEED : BULLET_SPEED) * dt;
          // vs enemies
          for (const en of st.enemies) {
            const ey = en.type === 'drone' ? en.baseY + Math.sin(en.phase) * 18 : 7;
            if (Math.abs(b.x - en.x) < 14 && Math.abs(b.y - (GROUND_Y - ey)) < 16) {
              en.phase = -999;
              spawnBurst(st, en.x, GROUND_Y - ey, en.type === 'drone' ? '#ff7a2d' : '#ff2d78', 12, 260);
              sfx.brick();
              st.bonus += 30;
              st.wallet += 2;
              if (!b.pierce) return false;
            }
          }
          // vs ground obstacles
          for (const o of st.obstacles) {
            if (o.overhead && !b.pierce) continue;
            const oy1 = o.overhead ? GROUND_Y - 62 : GROUND_Y - o.h;
            const oy2 = o.overhead ? GROUND_Y - 62 + o.h : GROUND_Y;
            if (b.x > o.x && b.x < o.x + o.w && b.y > oy1 && b.y < oy2) {
              o.hp -= b.pierce ? 99 : 1;
              if (o.hp <= 0) {
                spawnBurst(st, o.x + o.w / 2, (oy1 + oy2) / 2, '#ff2d78', 10, 240);
                sfx.brick();
                st.bonus += 5;
                if (Math.random() < 0.3) st.wallet += 1;
              }
              if (!b.pierce) return false;
            }
          }
          return b.x < W + 20;
        });
        st.enemies = st.enemies.filter((en) => en.phase !== -999);
        st.obstacles = st.obstacles.filter((o) => o.hp > 0);

        // coins
        st.coins = st.coins.filter((c) => {
          c.x -= st.speed * dt;
          const cy = GROUND_Y - c.y;
          if (px2 + 6 > c.x - 7 && px1 - 6 < c.x + 7 && py2 + 6 > cy - 7 && py1 - 6 < cy + 7) {
            st.wallet += 1;
            st.bonus += 10;
            sfx.pickup();
            spawnBurst(st, c.x, cy, '#ffe600', 5, 140);
            return false;
          }
          return c.x > -20;
        });
      }
    }

    for (const p of st.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= dt;
    }
    st.particles = st.particles.filter((p) => p.life > 0);
    st.shake = Math.max(0, st.shake - dt);

    setScore(totalScore(st));
    setWallet(st.wallet);

    // ================= draw =================
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (st.shake > 0) {
      ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
    }

    const t = performance.now() / 1000;

    // stars — properly scattered
    for (let i = 0; i < 48; i++) {
      const sx = hash(i) % W;
      const sy = hash(i + 1337) % (HORIZON_Y - 110);
      ctx.globalAlpha = 0.2 + 0.3 * Math.sin(t * 2 + i * 1.7);
      ctx.fillStyle = '#8888aa';
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // retro sun
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
    ctx.fillStyle = '#050508';
    for (let i = 0; i < 5; i++) {
      const sy = sunY + 6 + i * 12;
      ctx.fillRect(sunX - sunR, sy, sunR * 2, 3 + i * 1.5);
    }
    ctx.restore();

    // far skyline
    const farScroll = st.dist * 0.15;
    ctx.fillStyle = '#16162e';
    for (let sx = -46; sx < W + 46; sx += 46) {
      const idx = Math.floor((farScroll + sx) / 46);
      const bh = 40 + (hash(idx) % 70);
      const bx = sx - (farScroll % 46);
      ctx.fillRect(bx, HORIZON_Y - bh, 42, bh);
    }

    // mid skyline with lit windows
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

    // horizon
    ctx.strokeStyle = '#ff6ec7';
    ctx.shadowColor = '#ff6ec7';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y);
    ctx.lineTo(W, HORIZON_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ground
    ctx.fillStyle = '#0c0c1c';
    ctx.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);
    ctx.strokeStyle = '#2a1a4a';
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

    // coins
    for (const c of st.coins) {
      const cy = GROUND_Y - c.y + Math.sin(t * 4 + c.x * 0.05) * 3;
      const squish = Math.abs(Math.sin(t * 3 + c.x * 0.02));
      ctx.fillStyle = '#ffe600';
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(c.x, cy, 6 * Math.max(0.25, squish), 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // obstacles
    for (const o of st.obstacles) {
      if (o.overhead) {
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

    // enemies
    for (const en of st.enemies) {
      if (en.type === 'drone') {
        const ey = GROUND_Y - (en.baseY + Math.sin(en.phase) * 18);
        ctx.fillStyle = '#ff7a2d';
        ctx.shadowColor = '#ff7a2d';
        ctx.shadowBlur = 8;
        ctx.fillRect(en.x - 9, ey - 5, 18, 10);
        ctx.fillRect(en.x - 4, ey - 9, 8, 4);
        ctx.shadowBlur = 0;
        ctx.fillStyle = Math.floor(t * 6) % 2 === 0 ? '#ffe600' : '#ff2d78';
        ctx.fillRect(en.x - 2, ey + 5, 4, 3);
      } else {
        const ey = GROUND_Y - 7;
        ctx.fillStyle = '#ff2d78';
        ctx.shadowColor = '#ff2d78';
        ctx.shadowBlur = 8;
        ctx.fillRect(en.x - 10, ey - 7, 20, 14);
        ctx.shadowBlur = 0;
        // scuttling legs
        const leg = Math.sin(t * 20) * 3;
        ctx.fillRect(en.x - 8 + leg, GROUND_Y - 3, 3, 3);
        ctx.fillRect(en.x + 5 - leg, GROUND_Y - 3, 3, 3);
      }
    }

    // bullets
    for (const b of st.bullets) {
      ctx.fillStyle = b.pierce ? '#ff4444' : '#00ffff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8;
      ctx.fillRect(b.x - 6, b.y - 1.5, b.pierce ? 16 : 10, 3);
    }
    ctx.shadowBlur = 0;

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
      const inv = st.invTimer > 0;
      const color = inv
        ? ['#ffe600', '#00ffff', '#ff6ec7'][Math.floor(t * 8) % 3]
        : '#00ffff';
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = inv ? 16 : 10;
      if (st.sliding) {
        ctx.fillRect(PLAYER_X - 14, py + 6, 28, ph - 6);
        ctx.fillRect(PLAYER_X + 8, py, 8, 8);
      } else {
        ctx.fillRect(PLAYER_X - 4, py + 10, 9, ph - 18);
        ctx.fillRect(PLAYER_X - 4, py, 9, 9);
        if (st.y === 0) {
          const phase = Math.sin(st.dist * 0.06);
          ctx.fillRect(PLAYER_X - 4 + phase * 5, GROUND_Y - 10, 4, 10);
          ctx.fillRect(PLAYER_X - phase * 5, GROUND_Y - 10, 4, 10);
        } else {
          ctx.fillRect(PLAYER_X - 7, py + ph - 12, 5, 8);
          ctx.fillRect(PLAYER_X + 3, py + ph - 14, 5, 8);
        }
      }
      // gun
      ctx.fillRect(PLAYER_X + 4, py + (st.sliding ? 8 : 11), 10, 3);
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // shop bar
    if (st.status === 'playing') {
      ctx.font = '10px Consolas, monospace';
      ctx.textAlign = 'left';
      const items: [string, number, number][] = [
        [`1 RAPID ${COSTS.rapid}`, COSTS.rapid, st.rapidTimer],
        [`2 LASER ${COSTS.laser}`, COSTS.laser, st.laserTimer],
        [`3 INVINC ${COSTS.invincible}`, COSTS.invincible, st.invTimer],
      ];
      let x = 10;
      for (const [label, cost, timer] of items) {
        if (timer > 0) {
          ctx.fillStyle = '#ffe600';
          ctx.fillText(`${label.split(' ')[1]} ${Math.ceil(timer)}s`, x, H - 10);
        } else {
          ctx.fillStyle = st.wallet >= cost ? '#39ff14' : '#444';
          ctx.fillText(label, x, H - 10);
        }
        x += 95;
      }
    }

    if (st.status !== 'playing') {
      ctx.fillStyle = 'rgba(5, 5, 8, 0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = st.status === 'over' ? '#ff2d78' : '#00ffff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.font = 'bold 28px Consolas, monospace';
      ctx.fillText(st.status === 'over' ? 'WIPEOUT' : 'NIGHT RUN', W / 2, H / 2 - 30);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#888';
      ctx.font = '14px Consolas, monospace';
      if (st.status === 'over') {
        ctx.fillText(`SCORE ${totalScore(st)}`, W / 2, H / 2 + 2);
        ctx.fillText('SPACE TO RUN AGAIN', W / 2, H / 2 + 26);
      } else {
        ctx.fillText('SPACE JUMP · DOWN SLIDE · X FIRE', W / 2, H / 2 + 2);
        ctx.fillText('COINS BUY POWER-UPS (1/2/3) · SPACE TO RUN', W / 2, H / 2 + 24);
      }
    }
  });

  return (
    <div className={styles.gameWrap}>
      <div className={styles.hud} style={{ width: W }}>
        <span>SCORE {score}</span>
        <span>COINS {wallet}</span>
        <span>HI {highScore}</span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />
      <div className={styles.gameHint}>
        SPACE JUMP &middot; &darr; SLIDE &middot; X FIRE &middot; 1/2/3 BUY &middot; M MENU &middot;
        ESC QUIT
      </div>
    </div>
  );
}
