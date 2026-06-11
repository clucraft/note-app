import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameLoop } from '../useGameLoop';
import { getHighScore, submitHighScore } from '../highScores';
import { sfx } from '../audio';
import styles from '../Arcade.module.css';

const COLS = 24;
const ROWS = 24;
const CELL = 20;
const W = COLS * CELL;
const H = ROWS * CELL;
const START_TICK_MS = 140;
const MIN_TICK_MS = 70;

type Vec = { x: number; y: number };
type Status = 'ready' | 'playing' | 'over';

interface State {
  snake: Vec[];
  dir: Vec;
  pendingDirs: Vec[];
  food: Vec;
  score: number;
  tickMs: number;
  acc: number;
  status: Status;
}

function randomFood(snake: Vec[]): Vec {
  while (true) {
    const p = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    };
    if (!snake.some((s) => s.x === p.x && s.y === p.y)) return p;
  }
}

function initialState(): State {
  const snake = [
    { x: 12, y: 12 },
    { x: 11, y: 12 },
    { x: 10, y: 12 },
  ];
  return {
    snake,
    dir: { x: 1, y: 0 },
    pendingDirs: [],
    food: randomFood(snake),
    score: 0,
    tickMs: START_TICK_MS,
    acc: 0,
    status: 'ready',
  };
}

const KEY_DIRS: Record<string, Vec> = {
  ArrowUp: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
};

export function Snake({ onExit, onScore }: { onExit: () => void; onScore?: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(initialState());
  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => getHighScore('snake'));

  const restart = useCallback(() => {
    stateRef.current = initialState();
    stateRef.current.status = 'playing';
    setScore(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === 'm') {
        onExit();
        return;
      }
      const st = stateRef.current;
      if (key === 'Enter' && st.status !== 'playing') {
        e.preventDefault();
        restart();
        return;
      }
      const dir = KEY_DIRS[key];
      if (!dir) return;
      e.preventDefault();
      if (st.status === 'ready') st.status = 'playing';
      if (st.status !== 'playing') return;
      const last = st.pendingDirs[st.pendingDirs.length - 1] ?? st.dir;
      if (dir.x === -last.x && dir.y === -last.y) return; // no 180° turns
      if (dir.x === last.x && dir.y === last.y) return;
      if (st.pendingDirs.length < 3) st.pendingDirs.push(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit, restart]);

  const step = useCallback((st: State) => {
    if (st.pendingDirs.length) st.dir = st.pendingDirs.shift()!;
    const head = { x: st.snake[0].x + st.dir.x, y: st.snake[0].y + st.dir.y };
    const hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
    const hitSelf = st.snake.some((s) => s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) {
      st.status = 'over';
      submitHighScore('snake', st.score);
      setHighScore(getHighScore('snake'));
      sfx.over();
      onScoreRef.current?.(st.score);
      return;
    }
    st.snake.unshift(head);
    if (head.x === st.food.x && head.y === st.food.y) {
      sfx.pickup();
      st.score += 10;
      st.tickMs = Math.max(MIN_TICK_MS, st.tickMs - 2);
      st.food = randomFood(st.snake);
    } else {
      st.snake.pop();
    }
  }, []);

  useGameLoop((dt) => {
    const st = stateRef.current;
    if (st.status === 'playing') {
      st.acc += dt * 1000;
      while (st.acc >= st.tickMs && st.status === 'playing') {
        st.acc -= st.tickMs;
        step(st);
      }
    }
    setScore(st.score);

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // faint grid
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i < COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, H);
      ctx.stroke();
    }
    for (let i = 1; i < ROWS; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(W, i * CELL);
      ctx.stroke();
    }

    // food (pulsing magenta)
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 200);
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 12 * pulse;
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(st.food.x * CELL + 4, st.food.y * CELL + 4, CELL - 8, CELL - 8);

    // snake (neon green, brighter head)
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 8;
    st.snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? '#aaff8c' : '#39ff14';
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    });
    ctx.shadowBlur = 0;

    if (st.status !== 'playing') {
      ctx.fillStyle = 'rgba(5, 5, 8, 0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = st.status === 'over' ? '#ff2d78' : '#00ffff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.font = 'bold 28px Consolas, monospace';
      ctx.fillText(st.status === 'over' ? 'GAME OVER' : 'SNAKE', W / 2, H / 2 - 20);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#888';
      ctx.font = '14px Consolas, monospace';
      ctx.fillText(
        st.status === 'over' ? 'ENTER TO RETRY' : 'ARROWS / WASD TO START',
        W / 2,
        H / 2 + 16
      );
    }
  });

  return (
    <div className={styles.gameWrap}>
      <div className={styles.hud} style={{ width: W }}>
        <span>SCORE {score}</span>
        <span>HI {highScore}</span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />
      <div className={styles.gameHint}>ARROWS / WASD MOVE &middot; M MENU &middot; ESC QUIT</div>
    </div>
  );
}
