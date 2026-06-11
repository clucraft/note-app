import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameLoop } from '../useGameLoop';
import { sfx } from '../audio';
import styles from '../Arcade.module.css';

const VIEW_W = 480;
const VIEW_H = 560;
const HUD_H = 40;
const TILE = 32;

const PLAYER_SPEED = 150;
const PLAYER_R = 11;
const ATTACK_TIME = 0.18;
const ATTACK_CD = 0.35;
const INVULN_TIME = 1.0;
const MAX_HP_START = 6; // half-hearts
const SAVE_KEY = 'arcade.quest.save';
const BOMB_FUSE = 1.2;
const BOMB_RADIUS = 46;
const MAX_BOMBS = 8;

type MapId = 'over' | 'dun' | 'dun2';

// ---- maps -------------------------------------------------------------------
// . grass/floor  , path  S sand  T tree  R rock  W water  B bridge
// D dungeon entrance  C cracked rock (bombable)  # wall  L locked door
// G gated door (bars during room fights)  E dungeon exit
const RAW_OVER = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTRRRRRRRRRRRRRRRRRRRRRRRRRDDRRRRRRRRRRRRRRRRRRRRRRRRRRTTTT',
  'TT.....R..................R,,R..................R.......TTTT',
  'TT..RC.................RRRR,,RRRR.....................RRTTTT',
  'TT.........TT..............,,...........TT.............TTTT',
  'TT..T.......................,,..........................TTT',
  'TTT.....RR..................,,......WWWWWWWWWW..........TTT',
  'TT..........................,,....WWWWWWWWWWWWWW........TTT',
  'TT...TT.....................,,...WWWWWWWWWWWWWWWW.......TTT',
  'TT..TTTT..T.................,,...WWWWWWWWWWWWWWWWW......TTT',
  'TT.TTTT.....................,,..SSWWWWWWWWWWWWWWWW......TTT',
  'TT.TT...T..O................,,..SSSWWWWWWWWWWWWWW.......TTT',
  'TT.TT..T....................,,...SSSWWWWWWWWWWWW........TTT',
  'TT.TT...T..........,,,,,,,,,,,...BBBBBBBBWWWWW..........TTT',
  'TT.TTT..T..........,........SS...SSSSSSSS...............TTT',
  'TT.TTTT............,.......SSS......................R...TTT',
  'TT..TTTT..T........,........................CR..........TTT',
  'TT...TTTTT.........,....................................TTT',
  'TT.....TTT.........,..........RR........................TTT',
  'TT.T....T..........,....................TT..............TTT',
  'TT.................,......................TT............TTT',
  'TT.....R...........,,,,,,,,,,,..........................TTT',
  'TT.............................,...........R...........TTT',
  'TT....TT.......................,........................TTT',
  'TT...TTTT......................,.....TT.........CR......TTT',
  'TT....TT.......................,........................TTT',
  'TT.............................,.........TT............TTT',
  'TT......................................................TTT',
  'TTT....................................................TTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

const RAW_DUN = [
  '########################',
  '####................####',
  '####................####',
  '####................####',
  '#########GG#############',
  '####................####',
  '###..................###',
  '###..................###',
  '###..................###',
  '###..................###',
  '####................####',
  '##########LL############',
  '####................####',
  '####................####',
  '####................####',
  '##########LL############',
  '##########....##########',
  '##......##....##......##',
  '##......G......G......##',
  '##......##....##......##',
  '##......##....##......##',
  '##########....##########',
  '##########....##########',
  '#########..EE..#########',
  '########################',
];

interface WorldMap {
  grid: string[][];
  cols: number;
  rows: number;
  solid: Set<string>;
}

const SOLID_TILES = new Set(['T', 'R', 'W', 'D', 'C', '#', 'L', 'O', 'V']);

// Dungeon 2 — the Drowned Keep, hidden under a cracked rock
const RAW_DUN2 = [
  '########################',
  '####................####',
  '####................####',
  '####................####',
  '#########GG#############',
  '####................####',
  '###...WW......WW.....###',
  '###...WW......WW.....###',
  '###..................###',
  '###..................###',
  '####................####',
  '##########LL############',
  '####.....WWWW.......####',
  '####.....W..W.......####',
  '####.....W..W.......####',
  '####.....WWWW.......####',
  '##########....##########',
  '##......##....##......##',
  '##......G......G......##',
  '##......##....##......##',
  '##......##....##......##',
  '##########....##########',
  '#########..EE..#########',
  '########################',
];

function buildMap(raw: string[], cols: number, border: string): WorldMap {
  const rows = raw.length;
  const grid: string[][] = [];
  for (let y = 0; y < rows; y++) {
    grid.push((raw[y] || '').padEnd(cols, '.').slice(0, cols).split(''));
  }
  for (let x = 0; x < cols; x++) {
    grid[0][x] = border;
    grid[rows - 1][x] = border;
  }
  for (let y = 0; y < rows; y++) {
    grid[y][0] = border;
    grid[y][cols - 1] = border;
  }
  return { grid, cols, rows, solid: SOLID_TILES };
}

/** If an entity is inside solid tiles (bad spawn, stale save), move it to the nearest walkable tile. */
function unstick(e: { x: number; y: number }, m: WorldMap) {
  const solidAt = (px: number, py: number) => {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= m.cols || ty >= m.rows) return true;
    return SOLID_TILES.has(m.grid[ty][tx]);
  };
  const r = PLAYER_R;
  const stuck =
    solidAt(e.x - r, e.y - r) ||
    solidAt(e.x + r, e.y - r) ||
    solidAt(e.x - r, e.y + r) ||
    solidAt(e.x + r, e.y + r);
  if (!stuck) return;
  const ctx0 = Math.floor(e.x / TILE);
  const cty0 = Math.floor(e.y / TILE);
  for (let radius = 1; radius < 12; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = ctx0 + dx;
        const ty = cty0 + dy;
        if (tx < 1 || ty < 1 || tx >= m.cols - 1 || ty >= m.rows - 1) continue;
        if (!SOLID_TILES.has(m.grid[ty][tx])) {
          e.x = tx * TILE + 16;
          e.y = ty * TILE + 16;
          return;
        }
      }
    }
  }
}

// ---- structure: rooms, doors, cracks, pickups --------------------------------

interface Room {
  id: string;
  map: MapId;
  x0: number;
  y0: number;
  x1: number;
  y1: number; // tile rect, inclusive
  gates: [number, number][];
}

const ROOMS: Room[] = [
  { id: 'room-w', map: 'dun', x0: 2, y0: 17, x1: 8, y1: 20, gates: [[8, 18]] },
  { id: 'room-e', map: 'dun', x0: 15, y0: 17, x1: 21, y1: 20, gates: [[15, 18]] },
  { id: 'boss', map: 'dun', x0: 3, y0: 5, x1: 20, y1: 10, gates: [[9, 4], [10, 4]] },
  { id: 'room-bow', map: 'dun2', x0: 2, y0: 17, x1: 8, y1: 20, gates: [[8, 18]] },
  { id: 'room-k2', map: 'dun2', x0: 15, y0: 17, x1: 21, y1: 20, gates: [[15, 18]] },
  { id: 'boss2', map: 'dun2', x0: 3, y0: 5, x1: 20, y1: 10, gates: [[9, 4], [10, 4]] },
];

// locked door pairs — bumping either tile with a key opens both
const DOORS: { id: string; map: MapId; tiles: [number, number][] }[] = [
  { id: 'door-1', map: 'dun', tiles: [[10, 15], [11, 15]] },
  { id: 'door-2', map: 'dun', tiles: [[10, 11], [11, 11]] },
  { id: 'door-3', map: 'dun2', tiles: [[10, 11], [11, 11]] },
];

const CRACKS: { tx: number; ty: number; flag: string; loot: 'coins' | 'heart' | 'stairs' }[] = [
  { tx: 5, ty: 3, flag: 'crack-1', loot: 'coins' },
  { tx: 44, ty: 16, flag: 'crack-2', loot: 'heart' },
  { tx: 48, ty: 24, flag: 'crack-3', loot: 'stairs' },
];

type PickupKind =
  | 'key'
  | 'heartContainer'
  | 'fragment'
  | 'bombBag'
  | 'bow'
  | 'coin'
  | 'heart'
  | 'bomb';

interface PickupDef {
  kind: PickupKind;
  map: MapId;
  tx: number;
  ty: number;
  flag: string;
  requires?: string; // flag that must be set before this spawns
}

const PICKUP_DEFS: PickupDef[] = [
  { kind: 'key', map: 'dun', tx: 4, ty: 19, flag: 'key-w' },
  { kind: 'key', map: 'dun', tx: 19, ty: 19, flag: 'key-e' },
  { kind: 'heartContainer', map: 'dun', tx: 8, ty: 2, flag: 'hc-dungeon' },
  { kind: 'fragment', map: 'dun', tx: 14, ty: 2, flag: 'frag' },
  { kind: 'heartContainer', map: 'over', tx: 44, ty: 16, flag: 'hc-secret', requires: 'crack-2' },
  { kind: 'bow', map: 'dun2', tx: 4, ty: 19, flag: 'bow' },
  { kind: 'key', map: 'dun2', tx: 19, ty: 19, flag: 'key-d2' },
  { kind: 'heartContainer', map: 'dun2', tx: 8, ty: 2, flag: 'hc-dun2' },
  { kind: 'fragment', map: 'dun2', tx: 14, ty: 2, flag: 'frag2' },
];

// ---- enemies ------------------------------------------------------------------

type EnemyType =
  | 'blob'
  | 'stalker'
  | 'spitter'
  | 'bat'
  | 'knight'
  | 'guardian'
  | 'shade'
  | 'warden';

interface EnemyDef {
  type: EnemyType;
  map: MapId;
  tx: number;
  ty: number;
  roomId?: string;
}

const ENEMY_SPAWNS: EnemyDef[] = [
  // overworld
  { type: 'blob', map: 'over', tx: 8, ty: 5 },
  { type: 'blob', map: 'over', tx: 20, ty: 17 },
  { type: 'blob', map: 'over', tx: 36, ty: 17 },
  { type: 'blob', map: 'over', tx: 45, ty: 20 },
  { type: 'blob', map: 'over', tx: 15, ty: 22 },
  { type: 'blob', map: 'over', tx: 40, ty: 4 },
  { type: 'blob', map: 'over', tx: 50, ty: 8 },
  { type: 'blob', map: 'over', tx: 24, ty: 24 },
  { type: 'stalker', map: 'over', tx: 12, ty: 12 },
  { type: 'stalker', map: 'over', tx: 33, ty: 20 },
  { type: 'stalker', map: 'over', tx: 48, ty: 15 },
  { type: 'stalker', map: 'over', tx: 22, ty: 6 },
  { type: 'stalker', map: 'over', tx: 44, ty: 25 },
  { type: 'spitter', map: 'over', tx: 10, ty: 19 },
  { type: 'spitter', map: 'over', tx: 38, ty: 22 },
  { type: 'spitter', map: 'over', tx: 50, ty: 5 },
  { type: 'spitter', map: 'over', tx: 26, ty: 15 },
  // dungeon
  { type: 'knight', map: 'dun', tx: 4, ty: 18, roomId: 'room-w' },
  { type: 'knight', map: 'dun', tx: 6, ty: 20, roomId: 'room-w' },
  { type: 'bat', map: 'dun', tx: 17, ty: 18, roomId: 'room-e' },
  { type: 'bat', map: 'dun', tx: 19, ty: 20, roomId: 'room-e' },
  { type: 'knight', map: 'dun', tx: 18, ty: 17, roomId: 'room-e' },
  { type: 'spitter', map: 'dun', tx: 6, ty: 13 },
  { type: 'spitter', map: 'dun', tx: 17, ty: 13 },
  { type: 'bat', map: 'dun', tx: 12, ty: 21 },
  { type: 'guardian', map: 'dun', tx: 11, ty: 7, roomId: 'boss' },
  // drowned keep
  { type: 'knight', map: 'dun2', tx: 4, ty: 18, roomId: 'room-bow' },
  { type: 'shade', map: 'dun2', tx: 6, ty: 20, roomId: 'room-bow' },
  { type: 'shade', map: 'dun2', tx: 17, ty: 18, roomId: 'room-k2' },
  { type: 'bat', map: 'dun2', tx: 19, ty: 20, roomId: 'room-k2' },
  { type: 'bat', map: 'dun2', tx: 18, ty: 17, roomId: 'room-k2' },
  { type: 'spitter', map: 'dun2', tx: 5, ty: 13 },
  { type: 'spitter', map: 'dun2', tx: 18, ty: 13 },
  { type: 'bat', map: 'dun2', tx: 12, ty: 21 },
  { type: 'shade', map: 'dun2', tx: 12, ty: 13 },
  { type: 'warden', map: 'dun2', tx: 11, ty: 8, roomId: 'boss2' },
];

const ENEMY_STATS: Record<
  EnemyType,
  { hp: number; speed: number; color: string; dmg: number; size: number }
> = {
  blob: { hp: 1, speed: 40, color: '#39ff14', dmg: 1, size: 9 },
  stalker: { hp: 2, speed: 78, color: '#ff2d78', dmg: 1, size: 10 },
  spitter: { hp: 1, speed: 0, color: '#ff7a2d', dmg: 1, size: 9 },
  bat: { hp: 1, speed: 115, color: '#b14aff', dmg: 1, size: 8 },
  knight: { hp: 3, speed: 45, color: '#4a9bff', dmg: 2, size: 12 },
  guardian: { hp: 14, speed: 0, color: '#ff00ff', dmg: 2, size: 22 },
  shade: { hp: 2, speed: 0, color: '#9d8aff', dmg: 1, size: 10 },
  warden: { hp: 18, speed: 0, color: '#00ff99', dmg: 2, size: 22 },
};

interface Enemy {
  type: EnemyType;
  map: MapId;
  roomId?: string;
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
  chargeTimer: number;
  charging: boolean;
}

interface Drop {
  x: number;
  y: number;
  kind: PickupKind;
  flag?: string;
  ttl: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  friendly: boolean;
  dmg: number;
  arrow?: boolean;
}

interface Bomb {
  x: number;
  y: number;
  fuse: number;
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
  map: MapId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  coins: number;
  keys: number;
  bombs: number;
  hasBombBag: boolean;
  hasBow: boolean;
  fragments: number;
  flags: Set<string>;
  facing: Facing;
  attackTimer: number;
  attackCd: number;
  bowCd: number;
  invuln: number;
  kbX: number;
  kbY: number;
  enemies: Enemy[];
  bullets: Bullet[];
  bombsLive: Bomb[];
  drops: Drop[];
  particles: Particle[];
  message: string;
  messageTtl: number;
  saveTimer: number;
  status: 'ready' | 'playing';
}

const OVER_SPAWN = { x: 31 * TILE + 16, y: 25 * TILE + 16 };
const DUN_SPAWN = { x: 11.5 * TILE + 16, y: 21 * TILE };
const DUN_EXIT_OVER = { x: 28 * TILE, y: 3 * TILE }; // on the path below the door
const DUN2_EXIT_OVER = { x: 48 * TILE + 16, y: 25 * TILE + 16 }; // below the bombed rock

interface SaveData {
  v: number;
  map: MapId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  coins: number;
  keys: number;
  bombs: number;
  hasBombBag: boolean;
  hasBow: boolean;
  fragments: number;
  flags: string[];
}

function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      v: 3,
      map: data.map === 'dun' ? 'dun' : data.map === 'dun2' ? 'dun2' : 'over',
      x: data.x ?? OVER_SPAWN.x,
      y: data.y ?? OVER_SPAWN.y,
      hp: data.hp ?? MAX_HP_START,
      maxHp: data.maxHp ?? MAX_HP_START,
      coins: data.coins ?? 0,
      keys: data.keys ?? 0,
      bombs: data.bombs ?? 0,
      hasBombBag: !!data.hasBombBag,
      hasBow: !!data.hasBow,
      fragments: data.fragments ?? (data.hasFragment ? 1 : 0),
      flags: Array.isArray(data.flags) ? data.flags : [],
    };
  } catch {
    return null;
  }
}

export function Quest({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapsRef = useRef<{ over: WorldMap; dun: WorldMap; dun2: WorldMap }>({
    over: buildMap(RAW_OVER, 60, 'T'),
    dun: buildMap(RAW_DUN, 24, '#'),
    dun2: buildMap(RAW_DUN2, 24, '#'),
  });

  const buildState = useCallback((save: SaveData | null): State => {
    const flags = new Set(save?.flags ?? []);
    // re-apply persistent world changes
    const maps = {
      over: buildMap(RAW_OVER, 60, 'T'),
      dun: buildMap(RAW_DUN, 24, '#'),
      dun2: buildMap(RAW_DUN2, 24, '#'),
    };
    for (const door of DOORS) {
      if (flags.has(door.id)) {
        for (const [tx, ty] of door.tiles) maps[door.map === 'dun2' ? 'dun2' : 'dun'].grid[ty][tx] = '.';
      }
    }
    for (const crack of CRACKS) {
      if (flags.has(crack.flag)) {
        maps.over.grid[crack.ty][crack.tx] = crack.loot === 'stairs' ? 'V' : '.';
      }
    }
    mapsRef.current = maps;

    const enemies: Enemy[] = ENEMY_SPAWNS.filter(
      (def) => !(def.roomId && flags.has(def.roomId))
    ).map((def) => ({
      type: def.type,
      map: def.map,
      roomId: def.roomId,
      x: def.tx * TILE + 16,
      y: def.ty * TILE + 16,
      homeX: def.tx * TILE + 16,
      homeY: def.ty * TILE + 16,
      hp: ENEMY_STATS[def.type].hp,
      alive: true,
      respawn: 0,
      dirX: 0,
      dirY: 0,
      dirTimer: 0,
      fireTimer: 1,
      kbX: 0,
      kbY: 0,
      chargeTimer: 2,
      charging: false,
    }));

    const drops: Drop[] = PICKUP_DEFS.filter(
      (p) => !flags.has(p.flag) && (!p.requires || flags.has(p.requires))
    ).map((p) => ({
      x: p.tx * TILE + 16,
      y: p.ty * TILE + 16,
      kind: p.kind,
      flag: p.flag,
      ttl: Infinity,
    }));

    const st: State = {
      map: save?.map ?? 'over',
      x: save?.x ?? OVER_SPAWN.x,
      y: save?.y ?? OVER_SPAWN.y,
      hp: Math.max(1, save?.hp ?? MAX_HP_START),
      maxHp: save?.maxHp ?? MAX_HP_START,
      coins: save?.coins ?? 0,
      keys: save?.keys ?? 0,
      bombs: save?.bombs ?? 0,
      hasBombBag: save?.hasBombBag ?? false,
      hasBow: save?.hasBow ?? false,
      fragments: save?.fragments ?? 0,
      flags,
      facing: 'up',
      attackTimer: 0,
      attackCd: 0,
      bowCd: 0,
      invuln: 0,
      kbX: 0,
      kbY: 0,
      enemies,
      bullets: [],
      bombsLive: [],
      drops,
      particles: [],
      message: '',
      messageTtl: 0,
      saveTimer: 4,
      status: 'ready',
    };
    unstick(st, maps[st.map]);
    return st;
  }, []);

  const stateRef = useRef<State>(null as unknown as State);
  if (stateRef.current === null) stateRef.current = buildState(loadSave());
  const keysHeldRef = useRef({ up: false, down: false, left: false, right: false });
  const [coins, setCoins] = useState(stateRef.current.coins);
  const [hasSave] = useState(() => loadSave() !== null);

  const curMap = useCallback((st: State): WorldMap => mapsRef.current[st.map], []);

  const tileAt = useCallback((m: WorldMap, px: number, py: number): string => {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= m.cols || ty >= m.rows) return '#';
    return m.grid[ty][tx];
  }, []);

  const gateRoom = useCallback((map: MapId, tx: number, ty: number): Room | null => {
    for (const room of ROOMS) {
      if (room.map === map && room.gates.some(([gx, gy]) => gx === tx && gy === ty)) return room;
    }
    return null;
  }, []);

  const playerInRoom = useCallback((st: State, room: Room): boolean => {
    const tx = st.x / TILE;
    const ty = st.y / TILE;
    return tx >= room.x0 && tx <= room.x1 + 1 && ty >= room.y0 && ty <= room.y1 + 1;
  }, []);

  const isSolidFor = useCallback(
    (st: State, m: WorldMap, px: number, py: number): boolean => {
      const ch = tileAt(m, px, py);
      if (ch === 'G') {
        const room = gateRoom(st.map, Math.floor(px / TILE), Math.floor(py / TILE));
        if (!room) return false;
        return !st.flags.has(room.id) && playerInRoom(st, room);
      }
      return m.solid.has(ch);
    },
    [tileAt, gateRoom, playerInRoom]
  );

  const boxBlocked = useCallback(
    (st: State, x: number, y: number, r: number): boolean => {
      const m = curMap(st);
      return (
        isSolidFor(st, m, x - r, y - r) ||
        isSolidFor(st, m, x + r, y - r) ||
        isSolidFor(st, m, x - r, y + r) ||
        isSolidFor(st, m, x + r, y + r)
      );
    },
    [curMap, isSolidFor]
  );

  const tryMove = useCallback(
    (st: State, e: { x: number; y: number }, dx: number, dy: number, r: number) => {
      if (dx !== 0 && !boxBlocked(st, e.x + dx, e.y, r)) e.x += dx;
      if (dy !== 0 && !boxBlocked(st, e.x, e.y + dy, r)) e.y += dy;
    },
    [boxBlocked]
  );

  const save = useCallback((st: State) => {
    const data: SaveData = {
      v: 3,
      map: st.map,
      x: st.x,
      y: st.y,
      hp: st.hp,
      maxHp: st.maxHp,
      coins: st.coins,
      keys: st.keys,
      bombs: st.bombs,
      hasBombBag: st.hasBombBag,
      hasBow: st.hasBow,
      fragments: st.fragments,
      flags: [...st.flags],
    };
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
    st.messageTtl = 2.8;
  }, []);

  const switchMap = useCallback(
    (st: State, to: MapId) => {
      const from = st.map;
      st.map = to;
      if (to === 'dun') {
        st.x = DUN_SPAWN.x;
        st.y = DUN_SPAWN.y;
        showMessage(st, 'DUNGEON OF THE GUARDIAN');
      } else if (to === 'dun2') {
        st.x = DUN_SPAWN.x;
        st.y = DUN_SPAWN.y;
        showMessage(st, 'THE DROWNED KEEP');
      } else {
        const exit = from === 'dun2' ? DUN2_EXIT_OVER : DUN_EXIT_OVER;
        st.x = exit.x;
        st.y = exit.y;
        showMessage(st, 'THE OVERWORLD');
      }
      unstick(st, mapsRef.current[st.map]);
      st.bullets = [];
      st.bombsLive = [];
      st.kbX = 0;
      st.kbY = 0;
      st.invuln = 1;
      save(st);
      sfx.sweep();
    },
    [save, showMessage]
  );

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
        showMessage(st, 'YOU FAINTED...');
        const spawn = st.map === 'dun' ? DUN_SPAWN : OVER_SPAWN;
        st.x = spawn.x;
        st.y = spawn.y;
        st.hp = st.maxHp;
        st.invuln = 2;
        st.kbX = 0;
        st.kbY = 0;
        save(st);
      }
    },
    [burst, save, showMessage]
  );

  const collectPickup = useCallback(
    (st: State, d: Drop) => {
      switch (d.kind) {
        case 'coin':
          st.coins++;
          break;
        case 'heart':
          st.hp = Math.min(st.maxHp, st.hp + 2);
          break;
        case 'bomb':
          st.bombs = Math.min(MAX_BOMBS, st.bombs + 1);
          break;
        case 'key':
          st.keys++;
          showMessage(st, 'YOU FOUND A KEY');
          break;
        case 'heartContainer':
          st.maxHp += 2;
          st.hp = st.maxHp;
          showMessage(st, 'HEART CONTAINER! MAX HEARTS +1');
          break;
        case 'bombBag':
          st.hasBombBag = true;
          st.bombs = MAX_BOMBS;
          showMessage(st, 'BOMB BAG! PRESS X TO DROP BOMBS');
          break;
        case 'bow':
          st.hasBow = true;
          showMessage(st, 'THE BOW! PRESS Z TO LOOSE ARROWS');
          break;
        case 'fragment':
          st.fragments++;
          if (st.fragments >= 2) {
            st.flags.add('complete');
            showMessage(st, 'THE CACHE IS RESTORED — QUEST COMPLETE!');
            sfx.sweep();
            burst(st, st.x, st.y, '#ffe600', 40);
            burst(st, st.x, st.y, '#00ffff', 30);
          } else {
            showMessage(st, 'A CACHE FRAGMENT... ANOTHER LIES HIDDEN');
          }
          break;
      }
      if (d.flag) st.flags.add(d.flag);
      sfx.pickup();
      burst(st, d.x, d.y, d.kind === 'coin' ? '#ffe600' : '#00ffff', 6);
      save(st);
    },
    [burst, save, showMessage]
  );

  const explodeBomb = useCallback(
    (st: State, b: Bomb) => {
      sfx.explosion(true);
      burst(st, b.x, b.y, '#ffe600', 18);
      burst(st, b.x, b.y, '#ff7a2d', 12);
      // damage enemies
      for (const en of st.enemies) {
        if (!en.alive || en.map !== st.map) continue;
        if (Math.hypot(en.x - b.x, en.y - b.y) < BOMB_RADIUS + ENEMY_STATS[en.type].size) {
          en.hp -= 2;
          if (en.hp <= 0) killEnemyRef.current(st, en);
        }
      }
      // self-damage, as tradition demands
      if (Math.hypot(st.x - b.x, st.y - b.y) < BOMB_RADIUS) {
        hurtPlayer(st, 1, b.x, b.y);
      }
      // cracked walls
      if (st.map === 'over') {
        for (const crack of CRACKS) {
          if (st.flags.has(crack.flag)) continue;
          const cx = crack.tx * TILE + 16;
          const cy = crack.ty * TILE + 16;
          if (Math.hypot(cx - b.x, cy - b.y) < BOMB_RADIUS + 24) {
            st.flags.add(crack.flag);
            mapsRef.current.over.grid[crack.ty][crack.tx] = crack.loot === 'stairs' ? 'V' : '.';
            burst(st, cx, cy, '#b14aff', 16);
            showMessage(
              st,
              crack.loot === 'stairs' ? 'A HIDDEN STAIRWAY IS REVEALED!' : 'THE ROCK CRUMBLES!'
            );
            if (crack.loot === 'stairs') {
              // nothing else — the stairway itself is the prize
            } else if (crack.loot === 'coins') {
              for (let i = 0; i < 5; i++) {
                st.drops.push({
                  x: cx + (Math.random() - 0.5) * 24,
                  y: cy + (Math.random() - 0.5) * 24,
                  kind: 'coin',
                  ttl: 30,
                });
              }
            } else {
              // reveal the hidden heart container pickup
              const def = PICKUP_DEFS.find((p) => p.requires === crack.flag);
              if (def && !st.flags.has(def.flag)) {
                st.drops.push({
                  x: def.tx * TILE + 16,
                  y: def.ty * TILE + 16,
                  kind: def.kind,
                  flag: def.flag,
                  ttl: Infinity,
                });
              }
            }
            save(st);
          }
        }
      }
    },
    [burst, hurtPlayer, save, showMessage]
  );

  const killEnemy = useCallback(
    (st: State, en: Enemy) => {
      en.alive = false;
      en.respawn = 25;
      const stats = ENEMY_STATS[en.type];
      burst(st, en.x, en.y, stats.color, 14);
      sfx.brick();
      if (en.type === 'guardian') {
        st.flags.add('boss');
        sfx.explosion(true);
        burst(st, en.x, en.y, '#ff00ff', 30);
        showMessage(st, 'THE GUARDIAN FALLS!');
        st.drops.push({ x: en.x, y: en.y, kind: 'bombBag', flag: 'bombbag', ttl: Infinity });
        save(st);
        return;
      }
      if (en.type === 'warden') {
        st.flags.add('boss2');
        sfx.explosion(true);
        burst(st, en.x, en.y, '#00ff99', 30);
        showMessage(st, 'THE WARDEN FALLS!');
        save(st);
        return;
      }
      // room clear check
      if (en.roomId) {
        const others = st.enemies.some(
          (o) => o !== en && o.roomId === en.roomId && o.alive
        );
        if (!others && !st.flags.has(en.roomId)) {
          st.flags.add(en.roomId);
          sfx.sweep();
          showMessage(st, 'THE WAY OPENS');
          save(st);
        }
      }
      const roll = Math.random();
      if (roll < 0.35) st.drops.push({ x: en.x, y: en.y, kind: 'coin', ttl: 10 });
      else if (roll < 0.5) st.drops.push({ x: en.x, y: en.y, kind: 'heart', ttl: 10 });
      else if (roll < 0.62 && st.hasBombBag)
        st.drops.push({ x: en.x, y: en.y, kind: 'bomb', ttl: 10 });
    },
    [burst, save, showMessage]
  );
  const killEnemyRef = useRef(killEnemy);
  killEnemyRef.current = killEnemy;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === 'm') {
        save(stateRef.current);
        onExit();
        return;
      }
      const st = stateRef.current;
      const k = keysHeldRef.current;
      if (st.status === 'ready') {
        if (key === 'Enter') {
          e.preventDefault();
          st.status = 'playing';
        } else if (key === 'n') {
          localStorage.removeItem(SAVE_KEY);
          stateRef.current = buildState(null);
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
          // full hearts: sword beam
          if (st.hp === st.maxHp) {
            const dir =
              st.facing === 'up'
                ? [0, -1]
                : st.facing === 'down'
                  ? [0, 1]
                  : st.facing === 'left'
                    ? [-1, 0]
                    : [1, 0];
            st.bullets.push({
              x: st.x + dir[0] * 16,
              y: st.y + dir[1] * 16,
              vx: dir[0] * 330,
              vy: dir[1] * 330,
              friendly: true,
              dmg: 1,
            });
          }
        }
      } else if (key === 'x') {
        e.preventDefault();
        if (st.hasBombBag && st.bombs > 0 && st.bombsLive.length < 2) {
          st.bombs--;
          st.bombsLive.push({ x: st.x, y: st.y, fuse: BOMB_FUSE });
          sfx.thud();
        }
      } else if (key === 'z') {
        e.preventDefault();
        if (st.hasBow && st.bowCd <= 0) {
          st.bowCd = 0.5;
          const dir =
            st.facing === 'up'
              ? [0, -1]
              : st.facing === 'down'
                ? [0, 1]
                : st.facing === 'left'
                  ? [-1, 0]
                  : [1, 0];
          st.bullets.push({
            x: st.x + dir[0] * 16,
            y: st.y + dir[1] * 16,
            vx: dir[0] * 430,
            vy: dir[1] * 430,
            friendly: true,
            dmg: 2,
            arrow: true,
          });
          sfx.zap();
        }
      } else if (key === 'Enter') {
        e.preventDefault();
        // merchant trade when facing the cave
        const m2 = mapsRef.current[st.map];
        const ax = st.x + (st.facing === 'left' ? -20 : st.facing === 'right' ? 20 : 0);
        const ay = st.y + (st.facing === 'up' ? -20 : st.facing === 'down' ? 20 : 0);
        const tx = Math.floor(ax / TILE);
        const ty = Math.floor(ay / TILE);
        if (tx >= 0 && ty >= 0 && tx < m2.cols && ty < m2.rows && m2.grid[ty][tx] === 'O') {
          if (st.coins >= 15) {
            st.coins -= 15;
            st.hp = st.maxHp;
            if (st.hasBombBag) st.bombs = MAX_BOMBS;
            sfx.pickup();
            showMessage(st, 'MERCHANT: STOCKED UP! SAFE TRAVELS');
            save(st);
          } else {
            sfx.thud();
            showMessage(st, 'MERCHANT: COME BACK WITH 15 COINS');
          }
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const k = keysHeldRef.current;
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
  }, [onExit, save, buildState]);

  useGameLoop((dt) => {
    const st = stateRef.current;
    const k = keysHeldRef.current;
    const m = curMap(st);

    if (st.status === 'playing') {
      st.attackTimer = Math.max(0, st.attackTimer - dt);
      st.attackCd = Math.max(0, st.attackCd - dt);
      st.bowCd = Math.max(0, st.bowCd - dt);
      st.invuln = Math.max(0, st.invuln - dt);
      st.messageTtl = Math.max(0, st.messageTtl - dt);

      // movement
      let mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      let my = (k.down ? 1 : 0) - (k.up ? 1 : 0);
      if (mx !== 0 && my !== 0) {
        mx *= 0.7071;
        my *= 0.7071;
      }
      tryMove(
        st,
        st,
        mx * PLAYER_SPEED * dt + st.kbX * dt,
        my * PLAYER_SPEED * dt + st.kbY * dt,
        PLAYER_R
      );
      st.kbX *= Math.max(0, 1 - 8 * dt);
      st.kbY *= Math.max(0, 1 - 8 * dt);

      // interactions with the tile ahead
      const aheadX = st.x + (st.facing === 'left' ? -20 : st.facing === 'right' ? 20 : 0);
      const aheadY = st.y + (st.facing === 'up' ? -20 : st.facing === 'down' ? 20 : 0);
      const ahead = tileAt(m, aheadX, aheadY);
      if (ahead === 'D' && st.map === 'over') {
        switchMap(st, 'dun');
      } else if (ahead === 'V' && st.map === 'over') {
        switchMap(st, 'dun2');
      } else if (ahead === 'E' && st.map !== 'over') {
        switchMap(st, 'over');
      } else if (ahead === 'L') {
        const tx = Math.floor(aheadX / TILE);
        const ty = Math.floor(aheadY / TILE);
        const door = DOORS.find(
          (d) => d.map === st.map && d.tiles.some(([dx2, dy2]) => dx2 === tx && dy2 === ty)
        );
        if (door && !st.flags.has(door.id)) {
          if (st.keys > 0) {
            st.keys--;
            st.flags.add(door.id);
            for (const [dx2, dy2] of door.tiles) m.grid[dy2][dx2] = '.';
            sfx.sweep();
            showMessage(st, 'THE DOOR UNLOCKS');
            save(st);
          } else if (st.messageTtl <= 0) {
            showMessage(st, 'LOCKED... A KEY IS NEEDED');
          }
        }
      } else if (ahead === 'C' && st.messageTtl <= 0) {
        showMessage(st, st.hasBombBag ? 'THIS ROCK LOOKS WEAK...' : 'CRACKED ROCK... IF ONLY IT COULD BE BROKEN');
      } else if (ahead === 'O' && st.messageTtl <= 0) {
        showMessage(st, 'MERCHANT: 15 COINS FILLS HEARTS & BOMBS — PRESS ENTER');
      }

      // sword hitbox
      let swordRect: [number, number, number, number] | null = null;
      if (st.attackTimer > 0) {
        const reach = 34;
        const width = 40;
        if (st.facing === 'up') swordRect = [st.x - width / 2, st.y - reach - 8, width, reach];
        else if (st.facing === 'down') swordRect = [st.x - width / 2, st.y + 8, width, reach];
        else if (st.facing === 'left') swordRect = [st.x - reach - 8, st.y - width / 2, reach, width];
        else swordRect = [st.x + 8, st.y - width / 2, reach, width];
      }

      // enemies
      for (const en of st.enemies) {
        if (en.map !== st.map) continue;
        if (!en.alive) {
          if (en.roomId) continue; // room enemies stay dead (flag handles respawn rules)
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
        if (distToPlayer > 440) continue;

        const stats = ENEMY_STATS[en.type];
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
          tryMove(st, en, (en.dirX * stats.speed + en.kbX) * dt, (en.dirY * stats.speed + en.kbY) * dt, 10);
        } else if (en.type === 'stalker' || en.type === 'knight') {
          if (distToPlayer < 230) {
            const dx = (st.x - en.x) / distToPlayer;
            const dy = (st.y - en.y) / distToPlayer;
            tryMove(st, en, (dx * stats.speed + en.kbX) * dt, (dy * stats.speed + en.kbY) * dt, 10);
          } else {
            tryMove(st, en, en.kbX * dt, en.kbY * dt, 10);
          }
        } else if (en.type === 'bat') {
          en.dirTimer -= dt;
          if (en.dirTimer <= 0) {
            en.dirTimer = 0.4 + Math.random() * 0.4;
            const toward = Math.random() < 0.65;
            const ang = toward
              ? Math.atan2(st.y - en.y, st.x - en.x) + (Math.random() - 0.5) * 1.6
              : Math.random() * Math.PI * 2;
            en.dirX = Math.cos(ang);
            en.dirY = Math.sin(ang);
          }
          tryMove(st, en, (en.dirX * stats.speed + en.kbX) * dt, (en.dirY * stats.speed + en.kbY) * dt, 8);
        } else if (en.type === 'spitter') {
          tryMove(st, en, en.kbX * dt, en.kbY * dt, 10);
          en.fireTimer -= dt;
          if (en.fireTimer <= 0 && distToPlayer < 260) {
            en.fireTimer = 1.8 + Math.random();
            const dx = (st.x - en.x) / distToPlayer;
            const dy = (st.y - en.y) / distToPlayer;
            st.bullets.push({
              x: en.x,
              y: en.y,
              vx: dx * 170,
              vy: dy * 170,
              friendly: false,
              dmg: 1,
            });
            sfx.zap();
          }
        } else if (en.type === 'shade') {
          // teleports near the player, fires, repeats
          en.dirTimer -= dt;
          if (en.dirTimer <= 0) {
            en.dirTimer = 2.4 + Math.random();
            for (let attempt = 0; attempt < 6; attempt++) {
              const ang = Math.random() * Math.PI * 2;
              const d2 = 90 + Math.random() * 80;
              const nx = st.x + Math.cos(ang) * d2;
              const ny = st.y + Math.sin(ang) * d2;
              if (!boxBlocked(st, nx, ny, 10)) {
                burst(st, en.x, en.y, '#9d8aff', 6);
                en.x = nx;
                en.y = ny;
                burst(st, en.x, en.y, '#9d8aff', 6);
                const dist2 = Math.hypot(st.x - en.x, st.y - en.y) || 1;
                st.bullets.push({
                  x: en.x,
                  y: en.y,
                  vx: ((st.x - en.x) / dist2) * 190,
                  vy: ((st.y - en.y) / dist2) * 190,
                  friendly: false,
                  dmg: 1,
                });
                sfx.zap();
                break;
              }
            }
          }
          tryMove(st, en, en.kbX * dt, en.kbY * dt, 10);
        } else if (en.type === 'warden') {
          en.chargeTimer -= dt;
          if (en.charging) {
            tryMove(st, en, en.dirX * 200 * dt, en.dirY * 200 * dt, 18);
            if (en.chargeTimer <= 0) {
              en.charging = false;
              en.chargeTimer = 1.6 + Math.random() * 0.8;
            }
          } else {
            tryMove(st, en, en.kbX * dt, en.kbY * dt, 18);
            if (en.chargeTimer <= 0 && distToPlayer < 320) {
              en.charging = true;
              en.chargeTimer = 0.8;
              const d = distToPlayer || 1;
              en.dirX = (st.x - en.x) / d;
              en.dirY = (st.y - en.y) / d;
              sfx.thud();
            }
          }
          // radial bullet ring
          en.fireTimer -= dt;
          if (en.fireTimer <= 0) {
            en.fireTimer = 3.5;
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2;
              st.bullets.push({
                x: en.x,
                y: en.y,
                vx: Math.cos(a) * 150,
                vy: Math.sin(a) * 150,
                friendly: false,
                dmg: 1,
              });
            }
            sfx.zap();
          }
        } else if (en.type === 'guardian') {
          en.chargeTimer -= dt;
          if (en.charging) {
            tryMove(st, en, en.dirX * 230 * dt, en.dirY * 230 * dt, 18);
            if (en.chargeTimer <= 0) {
              en.charging = false;
              en.chargeTimer = 1.4 + Math.random() * 0.8;
            }
          } else {
            tryMove(st, en, en.kbX * dt, en.kbY * dt, 18);
            if (en.chargeTimer <= 0 && distToPlayer < 320) {
              en.charging = true;
              en.chargeTimer = 0.8;
              const d = distToPlayer || 1;
              en.dirX = (st.x - en.x) / d;
              en.dirY = (st.y - en.y) / d;
              sfx.thud();
            }
          }
          // summon adds
          en.fireTimer -= dt;
          if (en.fireTimer <= 0) {
            en.fireTimer = 6;
            const adds = st.enemies.filter(
              (o) => o.type === 'blob' && o.map === 'dun' && o.alive
            ).length;
            if (adds < 2) {
              st.enemies.push({
                type: 'blob',
                map: 'dun',
                roomId: 'boss',
                x: en.x,
                y: en.y,
                homeX: en.x,
                homeY: en.y,
                hp: 1,
                alive: true,
                respawn: 0,
                dirX: 0,
                dirY: 0,
                dirTimer: 0,
                fireTimer: 1,
                kbX: 0,
                kbY: 0,
                chargeTimer: 0,
                charging: false,
              });
              burst(st, en.x, en.y, '#39ff14', 8);
            }
          }
        }

        // sword hit
        if (swordRect) {
          const [sx, sy, sw, sh] = swordRect;
          const pad = stats.size;
          if (en.x > sx - pad && en.x < sx + sw + pad && en.y > sy - pad && en.y < sy + sh + pad) {
            if (st.attackTimer > ATTACK_TIME - 0.05 || en.type === 'guardian') {
              // only register early in the swing so one swing = one hit
            }
            en.hp--;
            const d = Math.hypot(en.x - st.x, en.y - st.y) || 1;
            en.kbX = ((en.x - st.x) / d) * 260;
            en.kbY = ((en.y - st.y) / d) * 260;
            st.attackTimer = 0; // swing connects once
            sfx.brick();
            burst(st, en.x, en.y, stats.color, 6);
            if (en.hp <= 0) killEnemy(st, en);
          }
        }

        // contact damage
        if (en.alive && distToPlayer < 14 + stats.size) {
          hurtPlayer(st, stats.dmg, en.x, en.y);
        }
      }

      // bullets (enemy shots and friendly sword beams)
      st.bullets = st.bullets.filter((b) => {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (isSolidFor(st, m, b.x, b.y)) return false;
        if (b.friendly) {
          for (const en of st.enemies) {
            if (!en.alive || en.map !== st.map) continue;
            if (Math.hypot(b.x - en.x, b.y - en.y) < ENEMY_STATS[en.type].size + 6) {
              en.hp -= b.dmg;
              burst(st, en.x, en.y, ENEMY_STATS[en.type].color, 6);
              sfx.brick();
              if (en.hp <= 0) killEnemy(st, en);
              return false;
            }
          }
        } else if (Math.hypot(b.x - st.x, b.y - st.y) < 16) {
          hurtPlayer(st, 1, b.x - b.vx, b.y - b.vy);
          return false;
        }
        return Math.abs(b.x - st.x) < 640 && Math.abs(b.y - st.y) < 640;
      });

      // bombs
      st.bombsLive = st.bombsLive.filter((b) => {
        b.fuse -= dt;
        if (b.fuse <= 0) {
          explodeBomb(st, b);
          return false;
        }
        return true;
      });

      // drops
      st.drops = st.drops.filter((d) => {
        if (d.ttl !== Infinity) {
          d.ttl -= dt;
          if (d.ttl <= 0) return false;
        }
        if (Math.hypot(d.x - st.x, d.y - st.y) < 20) {
          collectPickup(st, d);
          return false;
        }
        return true;
      });

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
    const worldW = m.cols * TILE;
    const worldH = m.rows * TILE;
    const camX = Math.max(0, Math.min(worldW - VIEW_W, st.x - VIEW_W / 2));
    const camY = Math.max(0, Math.min(worldH - (VIEW_H - HUD_H), st.y - (VIEW_H - HUD_H) / 2));

    ctx.save();
    ctx.translate(0, HUD_H);
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, VIEW_H - HUD_H);
    ctx.clip();
    ctx.translate(-camX, -camY);

    const tx0 = Math.floor(camX / TILE);
    const ty0 = Math.floor(camY / TILE);
    const tx1 = Math.min(m.cols - 1, Math.ceil((camX + VIEW_W) / TILE));
    const ty1 = Math.min(m.rows - 1, Math.ceil((camY + VIEW_H - HUD_H) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const ch = m.grid[ty][tx];
        const x = tx * TILE;
        const y = ty * TILE;
        if (st.map !== 'over') {
          const wallEdge =
            st.map === 'dun2' ? 'rgba(0, 255, 153, 0.25)' : 'rgba(177, 74, 255, 0.25)';
          if (ch === '#') {
            ctx.fillStyle = st.map === 'dun2' ? '#0e1420' : '#12101f';
            ctx.fillRect(x, y, TILE, TILE);
            ctx.strokeStyle = wallEdge;
            ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
          } else if (ch === 'W') {
            ctx.fillStyle = '#03202e';
            ctx.fillRect(x, y, TILE, TILE);
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
            ctx.beginPath();
            const wy = y + 16 + Math.sin(t * 2 + tx * 1.3 + ty) * 4;
            ctx.moveTo(x + 4, wy);
            ctx.lineTo(x + TILE - 4, wy);
            ctx.stroke();
          } else {
            ctx.fillStyle = '#0b0b14';
            ctx.fillRect(x, y, TILE, TILE);
            if ((tx + ty) % 2 === 0) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
              ctx.fillRect(x, y, TILE, TILE);
            }
          }
          if (ch === 'L') {
            ctx.fillStyle = '#1a1408';
            ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
            ctx.strokeStyle = '#ffe600';
            ctx.shadowColor = '#ffe600';
            ctx.shadowBlur = 6;
            ctx.strokeRect(x + 6, y + 6, TILE - 12, TILE - 12);
            ctx.beginPath();
            ctx.arc(x + 16, y + 14, 4, 0, Math.PI * 2);
            ctx.moveTo(x + 16, y + 16);
            ctx.lineTo(x + 16, y + 23);
            ctx.stroke();
            ctx.shadowBlur = 0;
          } else if (ch === 'G') {
            const room = gateRoom(st.map, tx, ty);
            const closed = room && !st.flags.has(room.id) && playerInRoom(st, room);
            if (closed) {
              ctx.strokeStyle = '#00ffff';
              ctx.shadowColor = '#00ffff';
              ctx.shadowBlur = 6;
              for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(x + 5 + i * 8, y + 2);
                ctx.lineTo(x + 5 + i * 8, y + TILE - 2);
                ctx.stroke();
              }
              ctx.shadowBlur = 0;
            }
          } else if (ch === 'E') {
            ctx.fillStyle = '#050508';
            ctx.fillRect(x, y, TILE, TILE);
            ctx.strokeStyle = '#39ff14';
            for (let i = 0; i < 3; i++) {
              ctx.beginPath();
              ctx.moveTo(x + 4, y + 8 + i * 8);
              ctx.lineTo(x + TILE - 4, y + 8 + i * 8);
              ctx.stroke();
            }
          }
          continue;
        }
        // overworld tiles
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
        } else if (ch === 'R' || ch === 'C') {
          ctx.fillStyle = '#171226';
          ctx.beginPath();
          ctx.moveTo(x + 6, y + 26);
          ctx.lineTo(x + 10, y + 8);
          ctx.lineTo(x + 22, y + 6);
          ctx.lineTo(x + 27, y + 24);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = ch === 'C' ? 'rgba(255, 230, 0, 0.6)' : 'rgba(177, 74, 255, 0.45)';
          ctx.stroke();
          if (ch === 'C') {
            ctx.strokeStyle = 'rgba(255, 230, 0, 0.7)';
            ctx.beginPath();
            ctx.moveTo(x + 13, y + 10);
            ctx.lineTo(x + 16, y + 16);
            ctx.lineTo(x + 13, y + 22);
            ctx.stroke();
          }
        } else if (ch === 'D' || ch === 'V') {
          ctx.fillStyle = '#000';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = ch === 'D' ? '#ff00ff' : '#00ff99';
          ctx.shadowColor = ctx.strokeStyle;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(x + 16, y + 30, 13, Math.PI, 0);
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else if (ch === 'O') {
          ctx.fillStyle = '#171226';
          ctx.beginPath();
          ctx.moveTo(x + 2, y + 28);
          ctx.lineTo(x + 6, y + 6);
          ctx.lineTo(x + 26, y + 6);
          ctx.lineTo(x + 30, y + 28);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.arc(x + 16, y + 28, 9, Math.PI, 0);
          ctx.fill();
          // lantern
          ctx.fillStyle = '#ffe600';
          ctx.shadowColor = '#ffe600';
          ctx.shadowBlur = 8 + Math.sin(t * 4) * 3;
          ctx.fillRect(x + 14, y + 8, 4, 4);
          ctx.shadowBlur = 0;
        }
      }
    }

    // drops & pickups
    for (const d of st.drops) {
      const blink = d.ttl !== Infinity && d.ttl < 3 && Math.floor(t * 6) % 2 === 0;
      if (blink) continue;
      const bob = Math.sin(t * 3 + d.x * 0.1) * 2;
      if (d.kind === 'coin') {
        const squish = Math.abs(Math.sin(t * 3 + d.x));
        ctx.fillStyle = '#ffe600';
        ctx.shadowColor = '#ffe600';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y + bob, 5 * Math.max(0.25, squish), 5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.kind === 'heart') {
        ctx.fillStyle = '#ff2d78';
        ctx.shadowColor = '#ff2d78';
        ctx.shadowBlur = 8;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♥', d.x, d.y + 4 + bob);
      } else if (d.kind === 'heartContainer') {
        ctx.fillStyle = '#ff2d78';
        ctx.shadowColor = '#ff2d78';
        ctx.shadowBlur = 14;
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♥', d.x, d.y + 7 + bob);
      } else if (d.kind === 'key') {
        ctx.strokeStyle = '#ffe600';
        ctx.shadowColor = '#ffe600';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(d.x, d.y - 4 + bob, 4, 0, Math.PI * 2);
        ctx.moveTo(d.x, d.y + bob);
        ctx.lineTo(d.x, d.y + 8 + bob);
        ctx.moveTo(d.x, d.y + 5 + bob);
        ctx.lineTo(d.x + 4, d.y + 5 + bob);
        ctx.stroke();
      } else if (d.kind === 'bomb') {
        ctx.fillStyle = '#4a9bff';
        ctx.shadowColor = '#4a9bff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(d.x, d.y + bob, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.kind === 'bombBag') {
        ctx.fillStyle = '#4a9bff';
        ctx.shadowColor = '#4a9bff';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(d.x, d.y + bob, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0a0a12';
        ctx.font = 'bold 10px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('B', d.x, d.y + 3 + bob);
      } else if (d.kind === 'bow') {
        ctx.strokeStyle = '#39ff14';
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(d.x - 2, d.y + bob, 9, -Math.PI / 2.6, Math.PI / 2.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(d.x + 1, d.y - 8 + bob);
        ctx.lineTo(d.x + 1, d.y + 8 + bob);
        ctx.stroke();
      } else if (d.kind === 'fragment') {
        ctx.save();
        ctx.translate(d.x, d.y + bob);
        ctx.rotate(t);
        ctx.strokeStyle = '#ffe600';
        ctx.shadowColor = '#ffe600';
        ctx.shadowBlur = 16;
        ctx.strokeRect(-7, -7, 14, 14);
        ctx.strokeRect(-3, -3, 6, 6);
        ctx.restore();
      }
      ctx.shadowBlur = 0;
    }

    // bombs
    for (const b of st.bombsLive) {
      const flash = b.fuse < 0.4 && Math.floor(t * 10) % 2 === 0;
      ctx.fillStyle = flash ? '#ffffff' : '#4a9bff';
      ctx.shadowColor = '#4a9bff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ff7a2d';
      ctx.beginPath();
      ctx.moveTo(b.x + 2, b.y - 7);
      ctx.lineTo(b.x + 6, b.y - 12);
      ctx.stroke();
    }

    // enemies
    for (const en of st.enemies) {
      if (!en.alive || en.map !== st.map) continue;
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
        const ang = Math.atan2(st.y - en.y, st.x - en.x);
        ctx.beginPath();
        ctx.moveTo(en.x + Math.cos(ang) * 12, en.y + Math.sin(ang) * 12);
        ctx.lineTo(en.x + Math.cos(ang + 2.5) * 10, en.y + Math.sin(ang + 2.5) * 10);
        ctx.lineTo(en.x + Math.cos(ang - 2.5) * 10, en.y + Math.sin(ang - 2.5) * 10);
        ctx.closePath();
        ctx.fill();
      } else if (en.type === 'spitter') {
        ctx.save();
        ctx.translate(en.x, en.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-8, -8, 16, 16);
        ctx.restore();
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(en.x - 2, en.y - 2, 4, 4);
      } else if (en.type === 'bat') {
        const flap = Math.sin(t * 14 + en.homeX) * 5;
        ctx.beginPath();
        ctx.ellipse(en.x, en.y, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(en.x - 6, en.y);
        ctx.lineTo(en.x - 13, en.y - flap);
        ctx.moveTo(en.x + 6, en.y);
        ctx.lineTo(en.x + 13, en.y - flap);
        ctx.strokeStyle = stats.color;
        ctx.stroke();
      } else if (en.type === 'knight') {
        ctx.fillRect(en.x - 10, en.y - 12, 20, 24);
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(en.x - 6, en.y - 7, 12, 4);
      } else if (en.type === 'shade') {
        ctx.globalAlpha = 0.55 + Math.sin(t * 4 + en.homeX) * 0.2;
        ctx.beginPath();
        ctx.arc(en.x, en.y - 2, 9, Math.PI, 0);
        for (let i = 0; i < 3; i++) {
          ctx.arc(en.x + 9 - i * 6 - 3, en.y + 7 + Math.sin(t * 6 + i) * 2, 3, 0, Math.PI);
        }
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(en.x - 5, en.y - 4, 3, 3);
        ctx.fillRect(en.x + 2, en.y - 4, 3, 3);
      } else if (en.type === 'guardian' || en.type === 'warden') {
        const r = 22 + (en.charging ? Math.sin(t * 30) * 2 : Math.sin(t * 3) * 3);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + t * 0.5;
          const px2 = en.x + Math.cos(a) * r;
          const py2 = en.y + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px2, py2);
          else ctx.lineTo(px2, py2);
        }
        ctx.closePath();
        ctx.fill();
        // eye tracks the player
        const ang = Math.atan2(st.y - en.y, st.x - en.x);
        ctx.fillStyle = '#0a0a12';
        ctx.beginPath();
        ctx.arc(en.x + Math.cos(ang) * 6, en.y + Math.sin(ang) * 6, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(en.x + Math.cos(ang) * 8, en.y + Math.sin(ang) * 8, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    // bullets
    for (const b of st.bullets) {
      if (b.arrow) {
        const len = 12;
        const d = Math.hypot(b.vx, b.vy) || 1;
        ctx.strokeStyle = '#ffe600';
        ctx.shadowColor = '#ffe600';
        ctx.shadowBlur = 6;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x - (b.vx / d) * len, b.y - (b.vy / d) * len);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.lineWidth = 1;
        continue;
      }
      ctx.fillStyle = b.friendly ? '#00ffff' : '#ff4444';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.friendly ? 5 : 4, 0, Math.PI * 2);
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
    // inventory readout
    ctx.textAlign = 'right';
    ctx.font = 'bold 14px Consolas, monospace';
    let invX = VIEW_W - 14;
    ctx.fillStyle = '#ffe600';
    ctx.fillText(`● ${st.coins}`, invX, 26);
    invX -= 64;
    if (st.keys > 0) {
      ctx.fillStyle = '#ffe600';
      ctx.fillText(`⚷ ${st.keys}`, invX, 26);
      invX -= 56;
    }
    if (st.hasBombBag) {
      ctx.fillStyle = '#4a9bff';
      ctx.fillText(`◉ ${st.bombs}`, invX, 26);
      invX -= 56;
    }
    if (st.hasBow) {
      ctx.fillStyle = '#39ff14';
      ctx.fillText('➳', invX, 26);
      invX -= 36;
    }
    if (st.fragments > 0) {
      ctx.fillStyle = '#ffe600';
      ctx.fillText(`◈ ${st.fragments}`, invX, 26);
    }

    // boss HP bar
    const boss = st.enemies.find(
      (e) => (e.type === 'guardian' || e.type === 'warden') && e.alive && e.map === st.map
    );
    if (boss && Math.hypot(boss.x - st.x, boss.y - st.y) < 420) {
      const w = 200;
      const color = ENEMY_STATS[boss.type].color;
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(VIEW_W / 2 - w / 2, HUD_H + 10, w, 8);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillRect(VIEW_W / 2 - w / 2, HUD_H + 10, (w * boss.hp) / ENEMY_STATS[boss.type].hp, 8);
      ctx.shadowBlur = 0;
    }

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
      ctx.fillText(
        stateRef.current.flags.has('complete')
          ? '★ QUEST COMPLETE ★'
          : 'A NEON ADVENTURE — PHASE III',
        VIEW_W / 2,
        VIEW_H / 2 - 22
      );
      ctx.fillStyle = '#00ffff';
      ctx.font = '14px Consolas, monospace';
      ctx.fillText(hasSave ? 'ENTER CONTINUE' : 'ENTER START', VIEW_W / 2, VIEW_H / 2 + 16);
      if (hasSave) {
        ctx.fillStyle = '#888';
        ctx.fillText('N NEW GAME', VIEW_W / 2, VIEW_H / 2 + 40);
      }
      ctx.fillStyle = '#555';
      ctx.font = '11px Consolas, monospace';
      ctx.fillText('ARROWS MOVE · SPACE SWORD · X BOMB · Z BOW', VIEW_W / 2, VIEW_H / 2 + 74);
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
        ARROWS MOVE &middot; SPACE SWORD &middot; X BOMB &middot; M MENU (SAVES) &middot; ESC QUIT
      </div>
    </div>
  );
}
