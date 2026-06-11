import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameLoop } from '../useGameLoop';
import { getHighScore, submitHighScore } from '../highScores';
import { sfx } from '../audio';
import styles from '../Arcade.module.css';

const COLS = 10;
const ROWS = 20;
const CELL = 24;
const FIELD_X = 20;
const FIELD_Y = 20;
const W = 400;
const H = 520;
const LINE_POINTS = [0, 100, 300, 500, 800];

interface PieceDef {
  cells: [number, number][];
  size: number;
  color: string;
}

const PIECES: PieceDef[] = [
  { cells: [[0, 1], [1, 1], [2, 1], [3, 1]], size: 4, color: '#00ffff' }, // I
  { cells: [[0, 0], [1, 0], [0, 1], [1, 1]], size: 2, color: '#ffe600' }, // O
  { cells: [[1, 0], [0, 1], [1, 1], [2, 1]], size: 3, color: '#b14aff' }, // T
  { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], size: 3, color: '#39ff14' }, // S
  { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], size: 3, color: '#ff2d78' }, // Z
  { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], size: 3, color: '#4a9bff' }, // J
  { cells: [[2, 0], [0, 1], [1, 1], [2, 1]], size: 3, color: '#ff7a2d' }, // L
];

function rotatedCells(piece: number, rot: number): [number, number][] {
  const { cells, size } = PIECES[piece];
  let result = cells;
  for (let i = 0; i < rot % 4; i++) {
    result = result.map(([x, y]) => [size - 1 - y, x]);
  }
  return result;
}

type Status = 'ready' | 'playing' | 'over';

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
  grid: (string | null)[][];
  piece: number;
  rot: number;
  px: number;
  py: number;
  next: number;
  bag: number[];
  gravityAcc: number;
  score: number;
  lines: number;
  level: number;
  status: Status;
  particles: Particle[];
}

function drawFromBag(bag: number[]): number {
  if (bag.length === 0) {
    bag.push(...[0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5));
  }
  return bag.pop()!;
}

function initialState(): State {
  const bag: number[] = [];
  return {
    grid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    piece: drawFromBag(bag),
    rot: 0,
    px: 3,
    py: 0,
    next: drawFromBag(bag),
    bag,
    gravityAcc: 0,
    score: 0,
    lines: 0,
    level: 1,
    status: 'ready',
    particles: [],
  };
}

function collides(st: State, piece: number, rot: number, px: number, py: number): boolean {
  for (const [x, y] of rotatedCells(piece, rot)) {
    const gx = px + x;
    const gy = py + y;
    if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
    if (gy >= 0 && st.grid[gy][gx]) return true;
  }
  return false;
}

function gravitySeconds(level: number): number {
  return Math.max(0.08, 0.8 * Math.pow(0.85, level - 1));
}

export function Stacker({ onExit, onScore }: { onExit: () => void; onScore?: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(initialState());
  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => getHighScore('stacker'));

  const restart = useCallback(() => {
    stateRef.current = initialState();
    stateRef.current.status = 'playing';
    setScore(0);
  }, []);

  const spawn = useCallback((st: State) => {
    st.piece = st.next;
    st.next = drawFromBag(st.bag);
    st.rot = 0;
    st.px = 3;
    st.py = 0;
    st.gravityAcc = 0;
    if (collides(st, st.piece, st.rot, st.px, st.py)) {
      st.status = 'over';
      submitHighScore('stacker', st.score);
      setHighScore(getHighScore('stacker'));
      sfx.over();
      onScoreRef.current?.(st.score);
    }
  }, []);

  const lock = useCallback(
    (st: State) => {
      for (const [x, y] of rotatedCells(st.piece, st.rot)) {
        const gy = st.py + y;
        if (gy < 0) {
          st.status = 'over';
          submitHighScore('stacker', st.score);
          setHighScore(getHighScore('stacker'));
          sfx.over();
          onScoreRef.current?.(st.score);
          return;
        }
        st.grid[gy][st.px + x] = PIECES[st.piece].color;
      }
      const fullRows: number[] = [];
      st.grid.forEach((row, y) => {
        if (row.every((c) => c)) fullRows.push(y);
      });
      if (fullRows.length === 0) {
        sfx.thud();
      } else {
        sfx.explosion(fullRows.length === 4);
        for (const y of fullRows) {
          st.grid[y].forEach((color, x) => {
            for (let i = 0; i < 3; i++) {
              const life = 0.45 + Math.random() * 0.4;
              st.particles.push({
                x: FIELD_X + x * CELL + CELL / 2,
                y: FIELD_Y + y * CELL + CELL / 2,
                vx: (Math.random() - 0.5) * 280,
                vy: -30 - Math.random() * 200,
                life,
                maxLife: life,
                size: 2 + Math.random() * 3,
                color: color!,
              });
            }
          });
        }
        const kept = st.grid.filter((_, y) => !fullRows.includes(y));
        while (kept.length < ROWS) kept.unshift(Array(COLS).fill(null));
        st.grid = kept;
        st.lines += fullRows.length;
        st.score += LINE_POINTS[fullRows.length] * st.level;
        st.level = 1 + Math.floor(st.lines / 10);
      }
      spawn(st);
    },
    [spawn]
  );

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
      if (st.status !== 'playing') return;
      if (key === 'ArrowLeft') {
        e.preventDefault();
        if (!collides(st, st.piece, st.rot, st.px - 1, st.py)) st.px--;
      } else if (key === 'ArrowRight') {
        e.preventDefault();
        if (!collides(st, st.piece, st.rot, st.px + 1, st.py)) st.px++;
      } else if (key === 'ArrowDown') {
        e.preventDefault();
        if (!collides(st, st.piece, st.rot, st.px, st.py + 1)) {
          st.py++;
          st.gravityAcc = 0;
        }
      } else if (key === 'ArrowUp' || key === 'x' || key === 'z') {
        e.preventDefault();
        const newRot = key === 'z' ? st.rot + 3 : st.rot + 1;
        // simple wall kicks
        for (const dx of [0, -1, 1, -2, 2]) {
          if (!collides(st, st.piece, newRot, st.px + dx, st.py)) {
            st.rot = newRot % 4;
            st.px += dx;
            break;
          }
        }
      } else if (key === ' ') {
        e.preventDefault();
        while (!collides(st, st.piece, st.rot, st.px, st.py + 1)) st.py++;
        lock(st);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit, restart, lock]);

  useGameLoop((dt) => {
    const st = stateRef.current;

    if (st.status === 'playing') {
      st.gravityAcc += dt;
      const interval = gravitySeconds(st.level);
      while (st.gravityAcc >= interval && st.status === 'playing') {
        st.gravityAcc -= interval;
        if (!collides(st, st.piece, st.rot, st.px, st.py + 1)) {
          st.py++;
        } else {
          lock(st);
        }
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

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // playfield frame + faint grid
    ctx.strokeStyle = '#1a1a2e';
    ctx.strokeRect(FIELD_X - 1, FIELD_Y - 1, COLS * CELL + 2, ROWS * CELL + 2);
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.04)';
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(FIELD_X + x * CELL, FIELD_Y);
      ctx.lineTo(FIELD_X + x * CELL, FIELD_Y + ROWS * CELL);
      ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(FIELD_X, FIELD_Y + y * CELL);
      ctx.lineTo(FIELD_X + COLS * CELL, FIELD_Y + y * CELL);
      ctx.stroke();
    }

    const drawCell = (gx: number, gy: number, color: string, ghost = false) => {
      const x = FIELD_X + gx * CELL;
      const y = FIELD_Y + gy * CELL;
      if (ghost) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        ctx.shadowBlur = 0;
      }
    };

    // locked cells
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (st.grid[y][x]) drawCell(x, y, st.grid[y][x]!);
      }
    }

    if (st.status === 'playing') {
      // ghost piece
      let ghostY = st.py;
      while (!collides(st, st.piece, st.rot, st.px, ghostY + 1)) ghostY++;
      for (const [x, y] of rotatedCells(st.piece, st.rot)) {
        if (ghostY + y >= 0) drawCell(st.px + x, ghostY + y, PIECES[st.piece].color, true);
      }
      // active piece
      for (const [x, y] of rotatedCells(st.piece, st.rot)) {
        if (st.py + y >= 0) drawCell(st.px + x, st.py + y, PIECES[st.piece].color);
      }
    }

    // line-clear particles
    for (const p of st.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // side panel
    const panelX = FIELD_X + COLS * CELL + 24;
    ctx.fillStyle = '#888';
    ctx.font = '12px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('NEXT', panelX, 40);
    const nextDef = PIECES[st.next];
    for (const [x, y] of rotatedCells(st.next, 0)) {
      ctx.fillStyle = nextDef.color;
      ctx.shadowColor = nextDef.color;
      ctx.shadowBlur = 6;
      ctx.fillRect(panelX + x * 18, 52 + y * 18, 16, 16);
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = '#888';
    ctx.fillText('LEVEL', panelX, 160);
    ctx.fillText('LINES', panelX, 220);
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 18px Consolas, monospace';
    ctx.fillText(String(st.level), panelX, 184);
    ctx.fillText(String(st.lines), panelX, 244);

    if (st.status !== 'playing') {
      ctx.fillStyle = 'rgba(5, 5, 8, 0.7)';
      ctx.fillRect(FIELD_X, FIELD_Y, COLS * CELL, ROWS * CELL);
      ctx.textAlign = 'center';
      const cx = FIELD_X + (COLS * CELL) / 2;
      ctx.fillStyle = st.status === 'over' ? '#ff2d78' : '#00ffff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.font = 'bold 26px Consolas, monospace';
      ctx.fillText(st.status === 'over' ? 'GAME OVER' : 'STACKER', cx, H / 2 - 20);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#888';
      ctx.font = '14px Consolas, monospace';
      ctx.fillText('ENTER TO START', cx, H / 2 + 16);
    }
  });

  return (
    <div className={styles.gameWrap}>
      <div className={styles.hud} style={{ width: W }}>
        <span>SCORE {score}</span>
        <span>HI {highScore}</span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />
      <div className={styles.gameHint}>
        &larr;&rarr; MOVE &middot; &uarr;/X/Z ROTATE &middot; &darr; SOFT &middot; SPACE DROP &middot; M
        MENU &middot; ESC QUIT
      </div>
    </div>
  );
}
