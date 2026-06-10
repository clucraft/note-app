import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameLoop } from '../useGameLoop';
import { getHighScore, submitHighScore } from '../highScores';
import styles from '../Arcade.module.css';

const W = 480;
const H = 560;
const PADDLE_W = 80;
const PADDLE_H = 12;
const PADDLE_Y = H - 36;
const PADDLE_SPEED = 440;
const BALL_R = 7;
const BASE_BALL_SPEED = 330;
const BRICK_ROWS = 6;
const BRICK_COLS = 8;
const BRICK_TOP = 70;
const BRICK_GAP = 6;
const MARGIN = 24;
const BRICK_W = (W - MARGIN * 2 - BRICK_GAP * (BRICK_COLS - 1)) / BRICK_COLS;
const BRICK_H = 18;
const ROW_COLORS = ['#ff2d78', '#ff7a2d', '#ffe600', '#39ff14', '#00ffff', '#b14aff'];
const ROW_POINTS = [60, 50, 40, 30, 20, 10];

interface State {
  paddleX: number;
  ball: { x: number; y: number; vx: number; vy: number; stuck: boolean };
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

function initialState(): State {
  return {
    paddleX: (W - PADDLE_W) / 2,
    ball: { x: W / 2, y: PADDLE_Y - BALL_R, vx: 0, vy: 0, stuck: true },
    bricks: freshBricks(),
    bricksLeft: BRICK_ROWS * BRICK_COLS,
    score: 0,
    lives: 3,
    level: 1,
    status: 'playing',
  };
}

export function BrickBreaker({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(initialState());
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
    if (!st.ball.stuck) return;
    const speed = BASE_BALL_SPEED + 30 * (st.level - 1);
    const angle = (Math.random() * 60 - 30) * (Math.PI / 180);
    st.ball.vx = speed * Math.sin(angle);
    st.ball.vy = -speed * Math.cos(angle);
    st.ball.stuck = false;
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
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    stateRef.current.paddleX = Math.min(W - PADDLE_W, Math.max(0, x - PADDLE_W / 2));
  }, []);

  useGameLoop((dt) => {
    const st = stateRef.current;

    if (st.status === 'playing') {
      // paddle
      if (keysRef.current.left) st.paddleX -= PADDLE_SPEED * dt;
      if (keysRef.current.right) st.paddleX += PADDLE_SPEED * dt;
      st.paddleX = Math.min(W - PADDLE_W, Math.max(0, st.paddleX));

      const b = st.ball;
      if (b.stuck) {
        b.x = st.paddleX + PADDLE_W / 2;
        b.y = PADDLE_Y - BALL_R;
      } else {
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
          b.x <= st.paddleX + PADDLE_W + BALL_R
        ) {
          const speed = Math.hypot(b.vx, b.vy);
          const rel = (b.x - (st.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
          const angle = rel * (Math.PI / 3); // up to 60°
          b.vx = speed * Math.sin(angle);
          b.vy = -speed * Math.cos(angle);
          b.y = PADDLE_Y - BALL_R;
        }

        // bricks (one hit per frame)
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
              const ox = Math.min(b.x + BALL_R - bx, bx + BRICK_W - (b.x - BALL_R));
              const oy = Math.min(b.y + BALL_R - by, by + BRICK_H - (b.y - BALL_R));
              if (ox < oy) b.vx = -b.vx;
              else b.vy = -b.vy;
              break outer;
            }
          }
        }

        // level cleared
        if (st.bricksLeft === 0) {
          st.level++;
          st.bricks = freshBricks();
          st.bricksLeft = BRICK_ROWS * BRICK_COLS;
          b.stuck = true;
        }

        // ball lost
        if (b.y - BALL_R > H) {
          st.lives--;
          if (st.lives <= 0) {
            st.status = 'over';
            submitHighScore('breaker', st.score);
            setHighScore(getHighScore('breaker'));
          } else {
            b.stuck = true;
          }
        }
      }
    }

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

    // paddle
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.fillRect(st.paddleX, PADDLE_Y, PADDLE_W, PADDLE_H);

    // ball
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.beginPath();
    ctx.arc(st.ball.x, st.ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (st.status === 'over' || st.ball.stuck) {
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
