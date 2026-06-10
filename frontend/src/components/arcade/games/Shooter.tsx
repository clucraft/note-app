import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameLoop } from '../useGameLoop';
import { getHighScore, submitHighScore } from '../highScores';
import styles from '../Arcade.module.css';

const W = 480;
const H = 560;
const PLAYER_W = 30;
const PLAYER_H = 16;
const PLAYER_Y = H - 40;
const PLAYER_SPEED = 280;
const BULLET_SPEED = 460;
const ENEMY_BULLET_SPEED = 190;
const FIRE_COOLDOWN = 0.25;
const MAX_PLAYER_BULLETS = 3;
const ENEMY_COLS = 8;
const ENEMY_ROWS = 4;
const ENEMY_W = 30;
const ENEMY_H = 20;
const ENEMY_X_SPACING = 50;
const ENEMY_Y_SPACING = 40;
const ENEMY_LEFT = 38;
const ENEMY_TOP = 70;
const DESCEND = 16;
const ROW_POINTS = [40, 30, 20, 10];
const ROW_COLORS = ['#ff2d78', '#ff7a2d', '#ffe600', '#39ff14'];

interface Enemy {
  col: number;
  row: number;
  alive: boolean;
}

interface Bullet {
  x: number;
  y: number;
}

interface State {
  playerX: number;
  bullets: Bullet[];
  enemyBullets: Bullet[];
  enemies: Enemy[];
  offsetX: number;
  offsetY: number;
  marchDir: 1 | -1;
  fireCooldown: number;
  enemyFireTimer: number;
  invulnTimer: number;
  score: number;
  lives: number;
  wave: number;
  status: 'ready' | 'playing' | 'over';
}

function freshEnemies(): Enemy[] {
  const enemies: Enemy[] = [];
  for (let row = 0; row < ENEMY_ROWS; row++) {
    for (let col = 0; col < ENEMY_COLS; col++) {
      enemies.push({ col, row, alive: true });
    }
  }
  return enemies;
}

function initialState(): State {
  return {
    playerX: (W - PLAYER_W) / 2,
    bullets: [],
    enemyBullets: [],
    enemies: freshEnemies(),
    offsetX: 0,
    offsetY: 0,
    marchDir: 1,
    fireCooldown: 0,
    enemyFireTimer: 0,
    invulnTimer: 0,
    score: 0,
    lives: 3,
    wave: 1,
    status: 'ready',
  };
}

function enemyPos(e: Enemy, st: State) {
  return {
    x: ENEMY_LEFT + e.col * ENEMY_X_SPACING + st.offsetX,
    y: ENEMY_TOP + e.row * ENEMY_Y_SPACING + st.offsetY,
  };
}

export function Shooter({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(initialState());
  const keysRef = useRef({ left: false, right: false, fire: false });
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [highScore, setHighScore] = useState(() => getHighScore('shooter'));

  const start = useCallback(() => {
    const st = stateRef.current;
    if (st.status === 'over') {
      stateRef.current = initialState();
      stateRef.current.status = 'playing';
      setScore(0);
      setLives(3);
      setWave(1);
    } else if (st.status === 'ready') {
      st.status = 'playing';
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
        keysRef.current.fire = true;
        start();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === 'ArrowLeft' || key === 'a') keysRef.current.left = false;
      if (key === 'ArrowRight' || key === 'd') keysRef.current.right = false;
      if (key === ' ' || key === 'Enter') keysRef.current.fire = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onExit, start]);

  const gameOver = useCallback((st: State) => {
    st.status = 'over';
    submitHighScore('shooter', st.score);
    setHighScore(getHighScore('shooter'));
  }, []);

  useGameLoop((dt) => {
    const st = stateRef.current;

    if (st.status === 'playing') {
      // player
      if (keysRef.current.left) st.playerX -= PLAYER_SPEED * dt;
      if (keysRef.current.right) st.playerX += PLAYER_SPEED * dt;
      st.playerX = Math.min(W - PLAYER_W, Math.max(0, st.playerX));

      // player fire
      st.fireCooldown -= dt;
      if (keysRef.current.fire && st.fireCooldown <= 0 && st.bullets.length < MAX_PLAYER_BULLETS) {
        st.bullets.push({ x: st.playerX + PLAYER_W / 2, y: PLAYER_Y - 4 });
        st.fireCooldown = FIRE_COOLDOWN;
      }

      // march
      const alive = st.enemies.filter((e) => e.alive);
      const total = ENEMY_COLS * ENEMY_ROWS;
      const baseSpeed = 40 + (st.wave - 1) * 15;
      const speed = baseSpeed * (1 + 2 * (1 - alive.length / total));
      st.offsetX += speed * st.marchDir * dt;
      if (alive.length > 0) {
        const xs = alive.map((e) => enemyPos(e, st).x);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs) + ENEMY_W;
        if (st.marchDir === 1 && maxX > W - 12) {
          st.marchDir = -1;
          st.offsetY += DESCEND;
        } else if (st.marchDir === -1 && minX < 12) {
          st.marchDir = 1;
          st.offsetY += DESCEND;
        }
      }

      // enemy fire
      st.enemyFireTimer -= dt;
      if (st.enemyFireTimer <= 0 && alive.length > 0) {
        st.enemyFireTimer = Math.max(0.35, 1.1 - st.wave * 0.08);
        // bottom-most enemy of a random occupied column fires
        const cols = [...new Set(alive.map((e) => e.col))];
        const col = cols[Math.floor(Math.random() * cols.length)];
        const shooter = alive
          .filter((e) => e.col === col)
          .reduce((a, b) => (a.row > b.row ? a : b));
        const p = enemyPos(shooter, st);
        st.enemyBullets.push({ x: p.x + ENEMY_W / 2, y: p.y + ENEMY_H });
      }

      // bullets
      st.bullets.forEach((b) => (b.y -= BULLET_SPEED * dt));
      st.bullets = st.bullets.filter((b) => b.y > -10);
      st.enemyBullets.forEach((b) => (b.y += ENEMY_BULLET_SPEED * dt));
      st.enemyBullets = st.enemyBullets.filter((b) => b.y < H + 10);

      // player bullets vs enemies
      for (const b of st.bullets) {
        for (const e of st.enemies) {
          if (!e.alive) continue;
          const p = enemyPos(e, st);
          if (b.x > p.x && b.x < p.x + ENEMY_W && b.y > p.y && b.y < p.y + ENEMY_H) {
            e.alive = false;
            st.score += ROW_POINTS[e.row];
            b.y = -100; // consumed
            break;
          }
        }
      }

      // enemy bullets vs player
      st.invulnTimer = Math.max(0, st.invulnTimer - dt);
      if (st.invulnTimer === 0) {
        for (const b of st.enemyBullets) {
          if (
            b.x > st.playerX &&
            b.x < st.playerX + PLAYER_W &&
            b.y > PLAYER_Y &&
            b.y < PLAYER_Y + PLAYER_H
          ) {
            st.lives--;
            b.y = H + 100; // consumed
            if (st.lives <= 0) {
              gameOver(st);
            } else {
              st.invulnTimer = 1.5;
            }
            break;
          }
        }
      }

      // enemies reaching the player line
      if (st.status === 'playing' && alive.some((e) => enemyPos(e, st).y + ENEMY_H >= PLAYER_Y)) {
        gameOver(st);
      }

      // wave cleared
      if (st.status === 'playing' && alive.length === 0) {
        st.wave++;
        st.enemies = freshEnemies();
        st.offsetX = 0;
        st.offsetY = 0;
        st.marchDir = 1;
        st.bullets = [];
        st.enemyBullets = [];
        setWave(st.wave);
      }
    }

    setScore(st.score);
    setLives(st.lives);

    // draw
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // enemies
    for (const e of st.enemies) {
      if (!e.alive) continue;
      const p = enemyPos(e, st);
      const color = ROW_COLORS[e.row];
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.fillRect(p.x + 4, p.y, ENEMY_W - 8, ENEMY_H - 6);
      ctx.fillRect(p.x, p.y + 6, ENEMY_W, ENEMY_H - 12);
      // eyes
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(p.x + 8, p.y + 6, 4, 4);
      ctx.fillRect(p.x + ENEMY_W - 12, p.y + 6, 4, 4);
    }
    ctx.shadowBlur = 0;

    // player (blink while invulnerable)
    const blink = st.invulnTimer > 0 && Math.floor(performance.now() / 100) % 2 === 0;
    if (!blink && st.status !== 'over') {
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(st.playerX + PLAYER_W / 2, PLAYER_Y);
      ctx.lineTo(st.playerX + PLAYER_W, PLAYER_Y + PLAYER_H);
      ctx.lineTo(st.playerX, PLAYER_Y + PLAYER_H);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // bullets
    ctx.fillStyle = '#ffffff';
    for (const b of st.bullets) ctx.fillRect(b.x - 1.5, b.y - 8, 3, 8);
    ctx.fillStyle = '#ff2d78';
    for (const b of st.enemyBullets) ctx.fillRect(b.x - 1.5, b.y, 3, 8);

    if (st.status !== 'playing') {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(5, 5, 8, 0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = st.status === 'over' ? '#ff2d78' : '#00ffff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.font = 'bold 28px Consolas, monospace';
      ctx.fillText(st.status === 'over' ? 'GAME OVER' : 'CACHE INVADERS', W / 2, H / 2 - 20);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#888';
      ctx.font = '14px Consolas, monospace';
      ctx.fillText(st.status === 'over' ? 'SPACE TO RETRY' : 'SPACE TO START', W / 2, H / 2 + 16);
    }
  });

  return (
    <div className={styles.gameWrap}>
      <div className={styles.hud} style={{ width: W }}>
        <span>SCORE {score}</span>
        <span>WAVE {wave}</span>
        <span>LIVES {'▲'.repeat(Math.max(0, lives))}</span>
        <span>HI {highScore}</span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />
      <div className={styles.gameHint}>
        ARROWS MOVE &middot; SPACE FIRE &middot; M MENU &middot; ESC QUIT
      </div>
    </div>
  );
}
