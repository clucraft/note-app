import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameLoop } from '../useGameLoop';
import { sfx } from '../audio';
import styles from '../Arcade.module.css';

const VIEW_W = 480;
const VIEW_H = 560;
const HUD_H = 40;
const TILE = 32;

const PLAYER_SPEED = 150;
const PLAYER_R = 11; // collision half-size
const ATTACK_TIME = 0.18;
const ATTACK_CD = 0.35;
const INVULN_TIME = 1.0;
const MAX_HP_START = 6; // half-hearts
const SAVE_KEY = 'arcade.quest.save';

// ---- world ----------------------------------------------------------------
// Authored as ASCII rows; rows are padded/truncated to width and the border
// is forced solid, so small authoring slips can't break the world.
// . grass  , path  S sand  T tree  R rock  W water  B bridge  D dungeon door
const RAW = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTRRRRRRRRRRRRRRRRRRRRRRRRRDDRRRRRRRRRRRRRRRRRRRRRRRRRRTTTT',
  'TT.....R..................R,,R..................R.......TTTT',
  'TT..RR.................RRRR,,RRRR.....................RRTTTT',
  'TT.........TT..............,,...........TT.............TTTT',
  'TT..T.......................,,..........................TTT',
  'TTT.....RR..................,,......WWWWWWWWWW..........TTT',
  'TT..........................,,....WWWWWWWWWWWWWW........TTT',
  'TT...TT.....................,,...WWWWWWWWWWWWWWWW.......TTT',
  'TT..TTTT..T.................,,...WWWWWWWWWWWWWWWWW......TTT',
  'TT.TTTT.....................,,..SSWWWWWWWWWWWWWWWW......TTT',
  'TT.TT...T..R................,,..SSSWWWWWWWWWWWWWW.......TTT',
  'TT.TT..T....................,,...SSSWWWWWWWWWWWW........TTT',
  'TT.TT...T..........,,,,,,,,,,,...BBBBBBBBWWWWW..........TTT',
  'TT.TTT..T..........,........SS...SSSSSSSS...............TTT',
  'TT.TTTT............,.......SSS......................R...TTT',
  'TT..TTTT..T........,........................RR..........TTT',
  'TT...TTTTT.........,....................................TTT',
  'TT.....TTT.........,..........RR........................TTT',
  'TT.T....T..........,....................TT..............TTT',
  'TT.................,......................TT............TTT',
  'TT.....R...........,,,,,,,,,,,..........................TTT',
  'TT.............................,...........R...........TTT',
  'TT....TT.......................,........................TTT',
  'TT...TTTT......................,.....TT.........RR......TTT',
  'TT....TT.......................,........................TTT',
  'TT.............................,.........TT............TTT',
  'TT......................................................TTT',
  'TTT....................................................TTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];
const COLS = 60;
const ROWS = RAW.length;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;
const SOLID = new Set(['T', 'R', 'W', 'D']);

function buildGrid(): string[][] {
  const grid: string[][] = [];
  for (let y = 0; y < ROWS; y++) {
    const row = (RAW[y] || '').padEnd(COLS, '.').slice(0, COLS).split('');
    grid.push(row);
  }
  // force a solid border no matter what the art says
  for (let x = 0; x < COLS; x++) {
    grid[0][x] = 'T';
    grid[ROWS - 1][x] = 'T';
  }
  for (let y = 0; y < ROWS; y++) {
    grid[y][0] = 'T';
    grid[y][COLS - 1] = 'T';
  }
  return grid;
}

const GRID = buildGrid();

function tileAt(px: number, py: number): string {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return 'T';
  return GRID[ty][tx];
}

function blocked(px: number, py: number): boolean {
  return SOLID.has(tileAt(px, py));
}

function boxBlocked(x: number, y: number, r: number): boolean {
  return (
    blocked(x - r, y - r) || blocked(x + r, y - r) || blocked(x - r, y + r) || blocked(x + r, y + r)
  );
}

/** Axis-separated tile collision: slide along walls. */
function tryMove(e: { x: number; y: number }, dx: number, dy: number, r: number) {
  if (dx !== 0 && !boxBlocked(e.x + dx, e.y, r)) e.x += dx;
  if (dy !== 0 && !boxBlocked(e.x, e.y + dy, r)) e.y += dy;
}

// ---- entities ---------------------------------------------------------------

type EnemyType = 'blob' | 'stalker' | 'spitter';

interface EnemyDef {
  type: EnemyType;
  tx: number;
  ty: number;
}

const ENEMY_SPAWNS: EnemyDef[] = [
  { type: 'blob', tx: 8, ty: 5 },
  { type: 'blob', tx: 20, ty: 17 },
  { type: 'blob', tx: 36, ty: 17 },
  { type: 'blob', tx: 45, ty: 20 },
  { type: 'blob', tx: 15, ty: 22 },
  { type: 'blob', tx: 40, ty: 4 },
  { type: 'blob', tx: 50, ty: 8 },
  { type: 'blob', tx: 24, ty: 24 },
  { type: 'stalker', tx: 12, ty: 12 },
  { type: 'stalker', tx: 33, ty: 20 },
  { type: 'stalker', tx: 48, ty: 15 },
  { type: 'stalker', tx: 22, ty: 6 },
  { type: 'stalker', tx: 44, ty: 25 },
  { type: 'spitter', tx: 10, ty: 19 },
  { type: 'spitter', tx: 38, ty: 22 },
  { type: 'spitter', tx: 50, ty: 5 },
  { type: 'spitter', tx: 26, ty: 15 },
];

const ENEMY_STATS: Record<EnemyType, { hp: number; speed: number; color: string }> = {
  blob: { hp: 1, speed: 40, color: '#39ff14' },
  stalker: { hp: 2, speed: 78, color: '#ff2d78' },
  spitter: { hp: 1, speed: 0, color: '#ff7a2d' },
};

interface Enemy {
  type: EnemyType;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  hp: number;
  alive: boolean;
  respawn: number;
  dirX: number;
  dirY: number;
  dirTimer: number;
  fireTimer: number;
  kbX: number;
  kbY: number;
}

interface Drop {
  x: number;
  y: number;
  kind: 'coin' | 'heart';
  ttl: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
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

type Facing = 'up' | 'down' | 'left' | 'right';

interface State {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  coins: number;
  facing: Facing;
  attackTimer: number;
  attackCd: number;
  invuln: number;
  kbX: number;
  kbY: number;
  enemies: Enemy[];
  bullets: Bullet[];
  drops: Drop[];
  particles: Particle[];
  message: string;
  messageTtl: number;
  saveTimer: number;
  status: 'ready' | 'playing';
}

const SPAWN_X = 31 * TILE + 16;
const SPAWN_Y = 25 * TILE + 16;

function findWalkable(tx: number, ty: number): { x: number; y: number } {
  for (let radius = 0; radius < 6; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx > 1 && ny > 1 && nx < COLS - 2 && ny < ROWS - 2 && !SOLID.has(GRID[ny][nx])) {
          return { x: nx * TILE + 16, y: ny * TILE + 16 };
        }
      }
    }
  }
  return { x: SPAWN_X, y: SPAWN_Y };
}

function freshEnemies(): Enemy[] {
  return ENEMY_SPAWNS.map((def) => {
    const pos = findWalkable(def.tx, def.ty);
    return {
      type: def.type,
      x: pos.x,
      y: pos.y,
      homeX: pos.x,
      homeY: pos.y,
      hp: ENEMY_STATS[def.type].hp,
      alive: true,
      respawn: 0,
      dirX: 0,
      dirY: 0,
      dirTimer: 0,
      fireTimer: 1,
      kbX: 0,
      kbY: 0,
    };
  });
}

interface SaveData {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  coins: number;
}

function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as SaveData) : null;
  } catch {
    return null;
  }
}

function initialState(save: SaveData | null): State {
  return {
    x: save?.x ?? SPAWN_X,
    y: save?.y ?? SPAWN_Y,
    hp: Math.max(1, save?.hp ?? MAX_HP_START),
    maxHp: save?.maxHp ?? MAX_HP_START,
    coins: save?.coins ?? 0,
    facing: 'up',
    attackTimer: 0,
    attackCd: 0,
    invuln: 0,
    kbX: 0,
    kbY: 0,
    enemies: freshEnemies(),
    bullets: [],
    drops: [],
    particles: [],
    message: '',
    messageTtl: 0,
    saveTimer: 4,
    status: 'ready',
  };
}

export function Quest({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(initialState(loadSave()));
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const [coins, setCoins] = useState(stateRef.current.coins);
  const [hasSave] = useState(() => loadSave() !== null);

  const save = useCallback((st: State) => {
    const data: SaveData = { x: st.x, y: st.y, hp: st.hp, maxHp: st.maxHp, coins: st.coins };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }, []);

  const burst = useCallback((st: State, x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      const life = 0.3 + Math.random() * 0.3;
      const angle = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 160;
      st.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life,
        maxLife: life,
        size: 2 + Math.random() * 2.5,
        color,
      });
    }
  }, []);

  const showMessage = useCallback((st: State, text: string) => {
    st.message = text;
    st.messageTtl = 2.5;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === 'm') {
        save(stateRef.current);
        onExit();
        return;
      }
      const st = stateRef.current;
      const k = keysRef.current;
      if (st.status === 'ready') {
        if (key === 'Enter') {
          e.preventDefault();
          st.status = 'playing';
        } else if (key === 'n') {
          localStorage.removeItem(SAVE_KEY);
          stateRef.current = initialState(null);
          stateRef.current.status = 'playing';
          setCoins(0);
        }
        return;
      }
      if (key === 'ArrowUp' || key === 'w') {
        e.preventDefault();
        k.up = true;
        st.facing = 'up';
      } else if (key === 'ArrowDown' || key === 's') {
        e.preventDefault();
        k.down = true;
        st.facing = 'down';
      } else if (key === 'ArrowLeft' || key === 'a') {
        e.preventDefault();
        k.left = true;
        st.facing = 'left';
      } else if (key === 'ArrowRight' || key === 'd') {
        e.preventDefault();
        k.right = true;
        st.facing = 'right';
      } else if (key === ' ') {
        e.preventDefault();
        if (st.attackCd <= 0) {
          st.attackTimer = ATTACK_TIME;
          st.attackCd = ATTACK_CD;
          sfx.zap();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const k = keysRef.current;
      if (key === 'ArrowUp' || key === 'w') k.up = false;
      else if (key === 'ArrowDown' || key === 's') k.down = false;
      else if (key === 'ArrowLeft' || key === 'a') k.left = false;
      else if (key === 'ArrowRight' || key === 'd') k.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      save(stateRef.current);
    };
  }, [onExit, save]);

  const hurtPlayer = useCallback(
    (st: State, dmg: number, fromX: number, fromY: number) => {
      if (st.invuln > 0) return;
      st.hp -= dmg;
      st.invuln = INVULN_TIME;
      const dx = st.x - fromX;
      const dy = st.y - fromY;
      const d = Math.hypot(dx, dy) || 1;
      st.kbX = (dx / d) * 220;
      st.kbY = (dy / d) * 220;
      sfx.thud();
      burst(st, st.x, st.y, '#ff2d78', 8);
      if (st.hp <= 0) {
        sfx.over();
        showMessage(st, 'YOU FAINTED... BACK TO THE MEADOW');
        st.x = SPAWN_X;
        st.y = SPAWN_Y;
        st.hp = st.maxHp;
        st.invuln = 2;
        st.kbX = 0;
        st.kbY = 0;
        save(st);
      }
    },
    [burst, save, showMessage]
  );

  useGameLoop((dt) => {
    const st = stateRef.current;
    const k = keysRef.current;

    if (st.status === 'playing') {
      st.attackTimer = Math.max(0, st.attackTimer - dt);
      st.attackCd = Math.max(0, st.attackCd - dt);
      st.invuln = Math.max(0, st.invuln - dt);
      st.messageTtl = Math.max(0, st.messageTtl - dt);

      // ---- player movement ----
      let mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      let my = (k.down ? 1 : 0) - (k.up ? 1 : 0);
      if (mx !== 0 && my !== 0) {
        mx *= 0.7071;
        my *= 0.7071;
      }
      tryMove(st, mx * PLAYER_SPEED * dt + st.kbX * dt, my * PLAYER_SPEED * dt + st.kbY * dt, PLAYER_R);
      st.kbX *= Math.max(0, 1 - 8 * dt);
      st.kbY *= Math.max(0, 1 - 8 * dt);

      // dungeon door tease
      const aheadX = st.x + (st.facing === 'left' ? -20 : st.facing === 'right' ? 20 : 0);
      const aheadY = st.y + (st.facing === 'up' ? -20 : st.facing === 'down' ? 20 : 0);
      if (tileAt(aheadX, aheadY) === 'D' && st.messageTtl <= 0) {
        showMessage(st, 'THE DUNGEON IS SEALED... (PHASE II)');
      }

      // ---- sword hitbox ----
      let swordRect: [number, number, number, number] | null = null;
      if (st.attackTimer > 0) {
        const reach = 34;
        const width = 40;
        if (st.facing === 'up') swordRect = [st.x - width / 2, st.y - reach - 8, width, reach];
        else if (st.facing === 'down') swordRect = [st.x - width / 2, st.y + 8, width, reach];
        else if (st.facing === 'left') swordRect = [st.x - reach - 8, st.y - width / 2, reach, width];
        else swordRect = [st.x + 8, st.y - width / 2, reach, width];
      }

      // ---- enemies ----
      for (const en of st.enemies) {
        if (!en.alive) {
          // respawn only when the player is far away
          if (Math.hypot(st.x - en.homeX, st.y - en.homeY) > 400) {
            en.respawn -= dt;
            if (en.respawn <= 0) {
              en.alive = true;
              en.hp = ENEMY_STATS[en.type].hp;
              en.x = en.homeX;
              en.y = en.homeY;
            }
          }
          continue;
        }

        const distToPlayer = Math.hypot(st.x - en.x, st.y - en.y);
        if (distToPlayer > 420) continue; // asleep beyond activation radius

        const stats = ENEMY_STATS[en.type];

        // knockback decay
        en.kbX *= Math.max(0, 1 - 8 * dt);
        en.kbY *= Math.max(0, 1 - 8 * dt);

        if (en.type === 'blob') {
          en.dirTimer -= dt;
          if (en.dirTimer <= 0) {
            en.dirTimer = 0.8 + Math.random() * 1.6;
            const dirs = [
              [0, 0],
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ];
            const d = dirs[Math.floor(Math.random() * dirs.length)];
            en.dirX = d[0];
            en.dirY = d[1];
          }
          tryMove(en, (en.dirX * stats.speed + en.kbX) * dt, (en.dirY * stats.speed + en.kbY) * dt, 10);
        } else if (en.type === 'stalker') {
          if (distToPlayer < 210) {
            const dx = (st.x - en.x) / distToPlayer;
            const dy = (st.y - en.y) / distToPlayer;
            tryMove(en, (dx * stats.speed + en.kbX) * dt, (dy * stats.speed + en.kbY) * dt, 10);
          } else {
            tryMove(en, en.kbX * dt, en.kbY * dt, 10);
          }
        } else {
          tryMove(en, en.kbX * dt, en.kbY * dt, 10);
          en.fireTimer -= dt;
          if (en.fireTimer <= 0 && distToPlayer < 260) {
            en.fireTimer = 1.8 + Math.random();
            const dx = (st.x - en.x) / distToPlayer;
            const dy = (st.y - en.y) / distToPlayer;
            st.bullets.push({ x: en.x, y: en.y, vx: dx * 170, vy: dy * 170 });
            sfx.zap();
          }
        }

        // sword hit
        if (swordRect) {
          const [sx, sy, sw, sh] = swordRect;
          if (en.x > sx - 10 && en.x < sx + sw + 10 && en.y > sy - 10 && en.y < sy + sh + 10) {
            en.hp--;
            const d = Math.hypot(en.x - st.x, en.y - st.y) || 1;
            en.kbX = ((en.x - st.x) / d) * 260;
            en.kbY = ((en.y - st.y) / d) * 260;
            sfx.brick();
            burst(st, en.x, en.y, stats.color, 6);
            if (en.hp <= 0) {
              en.alive = false;
              en.respawn = 25;
              burst(st, en.x, en.y, stats.color, 12);
              const roll = Math.random();
              if (roll < 0.4) st.drops.push({ x: en.x, y: en.y, kind: 'coin', ttl: 10 });
              else if (roll < 0.55) st.drops.push({ x: en.x, y: en.y, kind: 'heart', ttl: 10 });
            }
          }
        }

        // contact damage
        if (en.alive && distToPlayer < 22) {
          hurtPlayer(st, 1, en.x, en.y);
        }
      }

      // ---- bullets ----
      st.bullets = st.bullets.filter((b) => {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (blocked(b.x, b.y)) return false;
        if (Math.hypot(b.x - st.x, b.y - st.y) < 16) {
          hurtPlayer(st, 1, b.x - b.vx, b.y - b.vy);
          return false;
        }
        return Math.abs(b.x - st.x) < 600 && Math.abs(b.y - st.y) < 600;
      });

      // ---- drops ----
      st.drops = st.drops.filter((d) => {
        d.ttl -= dt;
        if (d.ttl <= 0) return false;
        if (Math.hypot(d.x - st.x, d.y - st.y) < 20) {
          if (d.kind === 'coin') {
            st.coins++;
          } else {
            st.hp = Math.min(st.maxHp, st.hp + 2);
          }
          sfx.pickup();
          burst(st, d.x, d.y, d.kind === 'coin' ? '#ffe600' : '#ff2d78', 5);
          save(st);
          return false;
        }
        return true;
      });

      // autosave
      st.saveTimer -= dt;
      if (st.saveTimer <= 0) {
        st.saveTimer = 4;
        save(st);
      }
    }

    for (const p of st.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.max(0, 1 - 3 * dt);
      p.vy *= Math.max(0, 1 - 3 * dt);
      p.life -= dt;
    }
    st.particles = st.particles.filter((p) => p.life > 0);

    setCoins(st.coins);

    // ================= draw =================
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    const t = performance.now() / 1000;
    const camX = Math.max(0, Math.min(WORLD_W - VIEW_W, st.x - VIEW_W / 2));
    const camY = Math.max(0, Math.min(WORLD_H - (VIEW_H - HUD_H), st.y - (VIEW_H - HUD_H) / 2));

    ctx.save();
    ctx.translate(0, HUD_H);
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, VIEW_H - HUD_H);
    ctx.clip();
    ctx.translate(-camX, -camY);

    // tiles
    const tx0 = Math.floor(camX / TILE);
    const ty0 = Math.floor(camY / TILE);
    const tx1 = Math.min(COLS - 1, Math.ceil((camX + VIEW_W) / TILE));
    const ty1 = Math.min(ROWS - 1, Math.ceil((camY + VIEW_H - HUD_H) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const ch = GRID[ty][tx];
        const x = tx * TILE;
        const y = ty * TILE;
        if (ch === ',') {
          ctx.fillStyle = '#191430';
          ctx.fillRect(x, y, TILE, TILE);
        } else if (ch === 'S') {
          ctx.fillStyle = '#231d0e';
          ctx.fillRect(x, y, TILE, TILE);
        } else if (ch === 'W') {
          ctx.fillStyle = '#03202e';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
          ctx.beginPath();
          const wy = y + 16 + Math.sin(t * 2 + tx * 1.3 + ty) * 4;
          ctx.moveTo(x + 4, wy);
          ctx.lineTo(x + TILE - 4, wy);
          ctx.stroke();
        } else if (ch === 'B') {
          ctx.fillStyle = '#241608';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = '#4a2e10';
          for (let i = 1; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(x, y + i * 8);
            ctx.lineTo(x + TILE, y + i * 8);
            ctx.stroke();
          }
        } else {
          // grass base
          ctx.fillStyle = '#07100c';
          ctx.fillRect(x, y, TILE, TILE);
          if ((tx * 7 + ty * 13) % 5 === 0) {
            ctx.fillStyle = 'rgba(57, 255, 20, 0.18)';
            ctx.fillRect(x + ((tx * 11) % 24) + 4, y + ((ty * 17) % 24) + 4, 2, 2);
          }
        }
        if (ch === 'T') {
          ctx.fillStyle = '#0a1f10';
          ctx.beginPath();
          ctx.arc(x + 16, y + 16, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(57, 255, 20, 0.5)';
          ctx.stroke();
        } else if (ch === 'R') {
          ctx.fillStyle = '#171226';
          ctx.beginPath();
          ctx.moveTo(x + 6, y + 26);
          ctx.lineTo(x + 10, y + 8);
          ctx.lineTo(x + 22, y + 6);
          ctx.lineTo(x + 27, y + 24);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(177, 74, 255, 0.45)';
          ctx.stroke();
        } else if (ch === 'D') {
          ctx.fillStyle = '#000';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = '#ff00ff';
          ctx.shadowColor = '#ff00ff';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(x + 16, y + 30, 13, Math.PI, 0);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
    }

    // drops
    for (const d of st.drops) {
      const blink = d.ttl < 3 && Math.floor(t * 6) % 2 === 0;
      if (blink) continue;
      if (d.kind === 'coin') {
        const squish = Math.abs(Math.sin(t * 3 + d.x));
        ctx.fillStyle = '#ffe600';
        ctx.shadowColor = '#ffe600';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, 5 * Math.max(0.25, squish), 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#ff2d78';
        ctx.shadowColor = '#ff2d78';
        ctx.shadowBlur = 8;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♥', d.x, d.y + 4);
        ctx.shadowBlur = 0;
      }
    }

    // enemies
    for (const en of st.enemies) {
      if (!en.alive) continue;
      const stats = ENEMY_STATS[en.type];
      ctx.fillStyle = stats.color;
      ctx.shadowColor = stats.color;
      ctx.shadowBlur = 8;
      if (en.type === 'blob') {
        const pulse = 1 + Math.sin(t * 5 + en.homeX) * 0.12;
        ctx.beginPath();
        ctx.arc(en.x, en.y, 9 * pulse, 0, Math.PI * 2);
        ctx.fill();
      } else if (en.type === 'stalker') {
        ctx.beginPath();
        const ang = Math.atan2(st.y - en.y, st.x - en.x);
        ctx.moveTo(en.x + Math.cos(ang) * 12, en.y + Math.sin(ang) * 12);
        ctx.moveTo(en.x + Math.cos(ang) * 12, en.y + Math.sin(ang) * 12);
        ctx.lineTo(en.x + Math.cos(ang + 2.5) * 10, en.y + Math.sin(ang + 2.5) * 10);
        ctx.lineTo(en.x + Math.cos(ang - 2.5) * 10, en.y + Math.sin(ang - 2.5) * 10);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(en.x, en.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-8, -8, 16, 16);
        ctx.restore();
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(en.x - 2, en.y - 2, 4, 4);
      }
      ctx.shadowBlur = 0;
    }

    // bullets
    ctx.fillStyle = '#ff4444';
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 6;
    for (const b of st.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // sword
    if (st.attackTimer > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 12;
      const reach = 30;
      if (st.facing === 'up') ctx.fillRect(st.x - 2, st.y - reach - 10, 4, reach);
      else if (st.facing === 'down') ctx.fillRect(st.x - 2, st.y + 10, 4, reach);
      else if (st.facing === 'left') ctx.fillRect(st.x - reach - 10, st.y - 2, reach, 4);
      else ctx.fillRect(st.x + 10, st.y - 2, reach, 4);
      ctx.shadowBlur = 0;
    }

    // player
    const blink = st.invuln > 0 && Math.floor(t * 10) % 2 === 0;
    if (!blink) {
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 10;
      ctx.fillRect(st.x - 9, st.y - 9, 18, 18);
      ctx.shadowBlur = 0;
      // facing marker
      ctx.fillStyle = '#0a0a12';
      if (st.facing === 'up') ctx.fillRect(st.x - 3, st.y - 7, 6, 4);
      else if (st.facing === 'down') ctx.fillRect(st.x - 3, st.y + 3, 6, 4);
      else if (st.facing === 'left') ctx.fillRect(st.x - 7, st.y - 3, 4, 6);
      else ctx.fillRect(st.x + 3, st.y - 3, 4, 6);
    }

    // particles
    for (const p of st.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // ---- HUD ----
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, VIEW_W, HUD_H);
    ctx.strokeStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.moveTo(0, HUD_H);
    ctx.lineTo(VIEW_W, HUD_H);
    ctx.stroke();
    // hearts
    const fullHearts = Math.floor(st.hp / 2);
    const halfHeart = st.hp % 2 === 1;
    const totalHearts = Math.ceil(st.maxHp / 2);
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < totalHearts; i++) {
      const x = 12 + i * 22;
      if (i < fullHearts) {
        ctx.fillStyle = '#ff2d78';
        ctx.fillText('♥', x, 27);
      } else if (i === fullHearts && halfHeart) {
        ctx.fillStyle = '#3a1020';
        ctx.fillText('♥', x, 27);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, 8, 9, 24);
        ctx.clip();
        ctx.fillStyle = '#ff2d78';
        ctx.fillText('♥', x, 27);
        ctx.restore();
      } else {
        ctx.fillStyle = '#3a1020';
        ctx.fillText('♥', x, 27);
      }
    }
    // coins
    ctx.fillStyle = '#ffe600';
    ctx.textAlign = 'right';
    ctx.font = 'bold 14px Consolas, monospace';
    ctx.fillText(`● ${st.coins}`, VIEW_W - 14, 26);

    // message
    if (st.messageTtl > 0 && st.status === 'playing') {
      ctx.fillStyle = 'rgba(10, 10, 18, 0.85)';
      ctx.fillRect(40, VIEW_H - 70, VIEW_W - 80, 34);
      ctx.strokeStyle = '#00ffff';
      ctx.strokeRect(40, VIEW_H - 70, VIEW_W - 80, 34);
      ctx.fillStyle = '#00ffff';
      ctx.font = '12px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(st.message, VIEW_W / 2, VIEW_H - 48);
    }

    // ready screen
    if (st.status === 'ready') {
      ctx.fillStyle = 'rgba(5, 5, 8, 0.8)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#39ff14';
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 12;
      ctx.font = 'bold 30px Consolas, monospace';
      ctx.fillText('CACHE QUEST', VIEW_W / 2, VIEW_H / 2 - 50);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#888';
      ctx.font = '13px Consolas, monospace';
      ctx.fillText('A NEON ADVENTURE — PHASE I', VIEW_W / 2, VIEW_H / 2 - 22);
      ctx.fillStyle = '#00ffff';
      ctx.font = '14px Consolas, monospace';
      ctx.fillText(hasSave ? 'ENTER CONTINUE' : 'ENTER START', VIEW_W / 2, VIEW_H / 2 + 16);
      if (hasSave) {
        ctx.fillStyle = '#888';
        ctx.fillText('N NEW GAME', VIEW_W / 2, VIEW_H / 2 + 40);
      }
      ctx.fillStyle = '#555';
      ctx.font = '11px Consolas, monospace';
      ctx.fillText('ARROWS MOVE · SPACE SWORD', VIEW_W / 2, VIEW_H / 2 + 74);
    }
  });

  return (
    <div className={styles.gameWrap}>
      <div className={styles.hud} style={{ width: VIEW_W }}>
        <span>CACHE QUEST</span>
        <span>COINS {coins}</span>
        <span>AUTO-SAVE ON</span>
      </div>
      <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} className={styles.canvas} />
      <div className={styles.gameHint}>
        ARROWS MOVE &middot; SPACE SWORD &middot; M MENU (SAVES) &middot; ESC QUIT
      </div>
    </div>
  );
}
