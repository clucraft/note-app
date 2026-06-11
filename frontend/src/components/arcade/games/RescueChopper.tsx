import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameLoop } from '../useGameLoop';
import { getHighScore, submitHighScore } from '../highScores';
import { sfx } from '../audio';
import styles from '../Arcade.module.css';

const W = 480;
const H = 560;
const WORLD_W = 2880;
const GROUND_Y = 500;
const SKY_TOP = 40;

const BASE_X = 100;
const BASE_PAD_W = 120;
const TANK_NO_GO_X = 280; // tanks never enter the base zone

const CHOPPER_ACCEL = 300;
const CHOPPER_MAX_VX = 230;
const CHOPPER_MAX_VY = 170;
const CHOPPER_Y = GROUND_Y - 12; // resting altitude of the body center
const CRASH_VY = 100;
const CRASH_VX = 90;
const MAX_ABOARD = 16;

const FIRE_COOLDOWN = 0.22;
const BULLET_SPEED = 380;
const BULLET_GRAVITY = 260;
const BOMB_GRAVITY = 400;

const HOSTAGES_PER_BARRACK = 16;
const BARRACK_XS = [760, 1340, 1960, 2560];
const TOTAL_HOSTAGES = BARRACK_XS.length * HOSTAGES_PER_BARRACK;
const BARRACK_HP = 3;
const BARRACK_W = 64;
const BARRACK_H = 36;

const HOSTAGE_RUN = 72;
const HOSTAGE_WALK = 20;
const RUN_TRIGGER_DIST = 210;
const BOARD_DIST = 16;

const TANK_SPEED = 28;
const TANK_HP = 2;
const MAX_TANKS = 4;
const TANK_SPAWN_SECONDS = 18;
const SHELL_SPEED = 160;
const TANK_RANGE = 400;

type Facing = -1 | 0 | 1; // left, hover, right

interface Hostage {
  x: number;
  wanderTarget: number;
  phase: number;
}

interface Barrack {
  x: number;
  hp: number;
  inside: number;
  releaseTimer: number;
}

interface Tank {
  x: number;
  hp: number;
  fireTimer: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Explosion {
  x: number;
  y: number;
  r: number;
  maxR: number;
}

interface Runner {
  x: number;
  ttl: number;
  phase: number;
}

interface State {
  chopper: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    facing: Facing;
    landed: boolean;
    alive: boolean;
  };
  aboard: number;
  saved: number;
  dead: number;
  choppers: number;
  respawnTimer: number;
  invulnTimer: number;
  fireCooldown: number;
  unloadTimer: number;
  camX: number;
  hostages: Hostage[];
  runners: Runner[];
  barracks: Barrack[];
  tanks: Tank[];
  tankSpawnTimer: number;
  bullets: Projectile[];
  bombs: Projectile[];
  shells: Projectile[];
  explosions: Explosion[];
  score: number;
  status: 'ready' | 'playing' | 'over';
  scoreSubmitted: boolean;
}

function initialState(): State {
  return {
    chopper: {
      x: BASE_X,
      y: CHOPPER_Y,
      vx: 0,
      vy: 0,
      facing: 1,
      landed: true,
      alive: true,
    },
    aboard: 0,
    saved: 0,
    dead: 0,
    choppers: 3,
    respawnTimer: 0,
    invulnTimer: 0,
    fireCooldown: 0,
    unloadTimer: 0,
    camX: 0,
    hostages: [],
    runners: [],
    barracks: BARRACK_XS.map((x) => ({
      x,
      hp: BARRACK_HP,
      inside: HOSTAGES_PER_BARRACK,
      releaseTimer: 0,
    })),
    tanks: [
      { x: 980, hp: TANK_HP, fireTimer: 2 },
      { x: 2100, hp: TANK_HP, fireTimer: 3 },
    ],
    tankSpawnTimer: TANK_SPAWN_SECONDS,
    bullets: [],
    bombs: [],
    shells: [],
    explosions: [],
    score: 0,
    status: 'ready',
    scoreSubmitted: false,
  };
}

export function RescueChopper({ onExit, onScore }: { onExit: () => void; onScore?: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(initialState());
  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;
  const keysRef = useRef({ left: false, right: false, up: false, down: false, fire: false });
  const [score, setScore] = useState(0);
  const [aboard, setAboard] = useState(0);
  const [saved, setSaved] = useState(0);
  const [choppers, setChoppers] = useState(3);
  const [highScore, setHighScore] = useState(() => getHighScore('chopper'));

  const restart = useCallback(() => {
    stateRef.current = initialState();
    stateRef.current.status = 'playing';
    setScore(0);
    setAboard(0);
    setSaved(0);
    setChoppers(3);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
      const k = keysRef.current;
      if (key === 'ArrowLeft' || key === 'a') {
        e.preventDefault();
        k.left = true;
      } else if (key === 'ArrowRight' || key === 'd') {
        e.preventDefault();
        k.right = true;
      } else if (key === 'ArrowUp' || key === 'w') {
        e.preventDefault();
        k.up = true;
      } else if (key === 'ArrowDown' || key === 's') {
        e.preventDefault();
        k.down = true;
      } else if (key === ' ') {
        e.preventDefault();
        k.fire = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const k = keysRef.current;
      if (key === 'ArrowLeft' || key === 'a') k.left = false;
      else if (key === 'ArrowRight' || key === 'd') k.right = false;
      else if (key === 'ArrowUp' || key === 'w') k.up = false;
      else if (key === 'ArrowDown' || key === 's') k.down = false;
      else if (key === ' ') k.fire = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onExit, restart]);

  const endGame = useCallback((st: State) => {
    st.status = 'over';
    if (!st.scoreSubmitted) {
      st.scoreSubmitted = true;
      submitHighScore('chopper', st.score);
      setHighScore(getHighScore('chopper'));
      sfx.over();
      onScoreRef.current?.(st.score);
    }
  }, []);

  const crash = useCallback(
    (st: State) => {
      const ch = st.chopper;
      st.explosions.push({ x: ch.x, y: ch.y, r: 4, maxR: 34 });
      sfx.explosion(true);
      st.dead += st.aboard;
      st.aboard = 0;
      st.choppers--;
      ch.alive = false;
      if (st.choppers <= 0) {
        endGame(st);
      } else {
        st.respawnTimer = 2;
      }
    },
    [endGame]
  );

  useGameLoop((dt) => {
    const st = stateRef.current;
    const ch = st.chopper;
    const k = keysRef.current;

    if (st.status === 'playing') {
      st.invulnTimer = Math.max(0, st.invulnTimer - dt);
      st.fireCooldown = Math.max(0, st.fireCooldown - dt);

      // respawn
      if (!ch.alive) {
        st.respawnTimer -= dt;
        if (st.respawnTimer <= 0) {
          st.chopper = {
            x: BASE_X,
            y: CHOPPER_Y,
            vx: 0,
            vy: 0,
            facing: 1,
            landed: true,
            alive: true,
          };
          st.invulnTimer = 2;
        }
      }

      // ---- chopper flight ----
      if (ch.alive) {
        if (k.left) {
          ch.vx -= CHOPPER_ACCEL * dt;
          ch.facing = -1;
        } else if (k.right) {
          ch.vx += CHOPPER_ACCEL * dt;
          ch.facing = 1;
        } else {
          ch.vx *= Math.max(0, 1 - 2.2 * dt);
          if (Math.abs(ch.vx) < 20) ch.facing = 0;
        }
        if (k.up) ch.vy -= CHOPPER_ACCEL * dt;
        else if (k.down) ch.vy += CHOPPER_ACCEL * dt;
        else ch.vy *= Math.max(0, 1 - 2.5 * dt);

        ch.vx = Math.max(-CHOPPER_MAX_VX, Math.min(CHOPPER_MAX_VX, ch.vx));
        ch.vy = Math.max(-CHOPPER_MAX_VY, Math.min(CHOPPER_MAX_VY, ch.vy));

        if (ch.landed) {
          ch.vx = 0;
          if (k.up) ch.landed = false;
          else ch.vy = 0;
        }

        if (!ch.landed) {
          ch.x += ch.vx * dt;
          ch.y += ch.vy * dt;
          ch.x = Math.max(24, Math.min(WORLD_W - 24, ch.x));
          ch.y = Math.max(SKY_TOP, ch.y);

          // touching down
          if (ch.y >= CHOPPER_Y) {
            ch.y = CHOPPER_Y;
            if (ch.vy > CRASH_VY || Math.abs(ch.vx) > CRASH_VX) {
              crash(st);
            } else {
              ch.landed = true;
              ch.vx = 0;
              ch.vy = 0;
            }
          }
        }

        // fire: bullet when facing a side, bomb when hovering
        if (k.fire && st.fireCooldown === 0 && ch.alive) {
          st.fireCooldown = FIRE_COOLDOWN;
          if (ch.facing !== 0) {
            if (st.bullets.length < 4) {
              sfx.zap();
              st.bullets.push({
                x: ch.x + ch.facing * 22,
                y: ch.y - 2,
                vx: ch.facing * BULLET_SPEED + ch.vx * 0.5,
                vy: 30 + ch.vy * 0.3,
              });
            }
          } else if (!ch.landed && st.bombs.length < 2) {
            st.bombs.push({ x: ch.x, y: ch.y + 8, vx: ch.vx, vy: 120 });
          }
        }
      }

      // ---- camera ----
      const lead = ch.facing * 60;
      const camTarget = Math.max(0, Math.min(WORLD_W - W, ch.x - W / 2 + lead));
      st.camX += (camTarget - st.camX) * Math.min(1, 5 * dt);

      // ---- barracks release hostages ----
      for (const b of st.barracks) {
        if (b.hp <= 0 && b.inside > 0) {
          b.releaseTimer -= dt;
          if (b.releaseTimer <= 0) {
            b.releaseTimer = 0.4;
            b.inside--;
            st.hostages.push({
              x: b.x + (Math.random() * 30 - 15),
              wanderTarget: b.x + (Math.random() * 160 - 80),
              phase: Math.random() * 10,
            });
          }
        }
      }

      // ---- hostages ----
      const canBoard = ch.alive && ch.landed && st.aboard < MAX_ABOARD;
      st.hostages = st.hostages.filter((h) => {
        h.phase += dt * 8;
        const distToChopper = Math.abs(h.x - ch.x);
        if (canBoard && distToChopper < RUN_TRIGGER_DIST) {
          const dir = Math.sign(ch.x - h.x);
          h.x += dir * HOSTAGE_RUN * dt;
          if (Math.abs(h.x - ch.x) < BOARD_DIST) {
            st.aboard++;
            sfx.pickup();
            return false; // climbed in
          }
        } else {
          if (Math.abs(h.x - h.wanderTarget) < 4) {
            h.wanderTarget = h.x + (Math.random() * 200 - 100);
          }
          h.x += Math.sign(h.wanderTarget - h.x) * HOSTAGE_WALK * dt;
        }
        h.x = Math.max(TANK_NO_GO_X, Math.min(WORLD_W - 20, h.x));
        return true;
      });

      // ---- unload at base ----
      if (ch.alive && ch.landed && Math.abs(ch.x - BASE_X) < BASE_PAD_W / 2 && st.aboard > 0) {
        st.unloadTimer -= dt;
        if (st.unloadTimer <= 0) {
          st.unloadTimer = 0.3;
          st.aboard--;
          st.saved++;
          st.score += 50;
          sfx.bounce(900);
          st.runners.push({ x: ch.x - 14, ttl: 1.6, phase: Math.random() * 10 });
        }
      } else {
        st.unloadTimer = 0;
      }

      st.runners = st.runners.filter((r) => {
        r.ttl -= dt;
        r.phase += dt * 8;
        r.x -= 60 * dt;
        return r.ttl > 0;
      });

      // ---- tanks ----
      st.tankSpawnTimer -= dt;
      if (st.tankSpawnTimer <= 0 && st.tanks.length < MAX_TANKS) {
        st.tankSpawnTimer = TANK_SPAWN_SECONDS;
        let x = 400 + Math.random() * (WORLD_W - 500);
        if (Math.abs(x - ch.x) < 350) x = ch.x + 500 < WORLD_W - 100 ? ch.x + 500 : ch.x - 500;
        st.tanks.push({ x, hp: TANK_HP, fireTimer: 2 });
      }
      for (const t of st.tanks) {
        const dir = Math.sign(ch.x - t.x);
        t.x += dir * TANK_SPEED * dt;
        t.x = Math.max(TANK_NO_GO_X, Math.min(WORLD_W - 30, t.x));
        t.fireTimer -= dt;
        if (t.fireTimer <= 0 && ch.alive && Math.abs(t.x - ch.x) < TANK_RANGE && !ch.landed) {
          t.fireTimer = 2.5 + Math.random();
          const sx = t.x;
          const sy = GROUND_Y - 16;
          const dx = ch.x - sx;
          const dy = ch.y - sy;
          const dist = Math.hypot(dx, dy) || 1;
          st.shells.push({
            x: sx,
            y: sy,
            vx: (dx / dist) * SHELL_SPEED,
            vy: (dy / dist) * SHELL_SPEED,
          });
        }
      }

      // ---- player bullets ----
      st.bullets = st.bullets.filter((b) => {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vy += BULLET_GRAVITY * dt;

        // barracks
        for (const bar of st.barracks) {
          if (
            bar.hp > 0 &&
            b.x > bar.x - BARRACK_W / 2 &&
            b.x < bar.x + BARRACK_W / 2 &&
            b.y > GROUND_Y - BARRACK_H
          ) {
            bar.hp--;
            if (bar.hp <= 0) {
              st.score += 150;
              sfx.brick();
            } else {
              sfx.thud();
            }
            return false;
          }
        }
        // tanks
        for (const t of st.tanks) {
          if (Math.abs(b.x - t.x) < 15 && b.y > GROUND_Y - 18) {
            t.hp--;
            if (t.hp <= 0) {
              st.score += 100;
              st.explosions.push({ x: t.x, y: GROUND_Y - 8, r: 3, maxR: 20 });
              sfx.explosion();
            }
            return false;
          }
        }
        // hostages (careful with your fire!)
        for (let i = 0; i < st.hostages.length; i++) {
          const hx = st.hostages[i].x;
          if (Math.abs(b.x - hx) < 5 && b.y > GROUND_Y - 12) {
            st.hostages.splice(i, 1);
            st.dead++;
            return false;
          }
        }
        if (b.y >= GROUND_Y) return false;
        return b.x > 0 && b.x < WORLD_W;
      });
      st.tanks = st.tanks.filter((t) => t.hp > 0);

      // ---- bombs ----
      st.bombs = st.bombs.filter((b) => {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vy += BOMB_GRAVITY * dt;
        const hitTank = st.tanks.find(
          (t) => Math.abs(b.x - t.x) < 16 && b.y > GROUND_Y - 20
        );
        if (b.y >= GROUND_Y - 2 || hitTank) {
          const bx = hitTank ? hitTank.x : b.x;
          st.explosions.push({ x: bx, y: GROUND_Y - 4, r: 4, maxR: 28 });
          sfx.explosion();
          for (const t of st.tanks) {
            if (Math.abs(t.x - bx) < 30) {
              t.hp = 0;
              st.score += 100;
            }
          }
          st.tanks = st.tanks.filter((t) => t.hp > 0);
          // blast kills hostages too
          st.hostages = st.hostages.filter((h) => {
            if (Math.abs(h.x - bx) < 26) {
              st.dead++;
              return false;
            }
            return true;
          });
          return false;
        }
        return true;
      });

      // ---- enemy shells ----
      st.shells = st.shells.filter((s) => {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (
          ch.alive &&
          st.invulnTimer === 0 &&
          Math.abs(s.x - ch.x) < 20 &&
          Math.abs(s.y - ch.y) < 14
        ) {
          crash(st);
          return false;
        }
        if (s.y >= GROUND_Y) {
          st.explosions.push({ x: s.x, y: GROUND_Y - 4, r: 3, maxR: 16 });
          sfx.explosion();
          st.hostages = st.hostages.filter((h) => {
            if (Math.abs(h.x - s.x) < 14) {
              st.dead++;
              return false;
            }
            return true;
          });
          return false;
        }
        return s.x > 0 && s.x < WORLD_W && s.y > 0;
      });

      // ---- explosions ----
      for (const ex of st.explosions) ex.r += 70 * dt;
      st.explosions = st.explosions.filter((ex) => ex.r < ex.maxR);

      // ---- end of mission ----
      if (st.status === 'playing' && st.saved + st.dead >= TOTAL_HOSTAGES) {
        endGame(st);
      }
    }

    setScore(st.score);
    setAboard(st.aboard);
    setSaved(st.saved);
    setChoppers(st.choppers);

    // ================= draw =================
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.translate(-st.camX, 0);

    // stars
    const t = performance.now() / 1000;
    for (let i = 0; i < 70; i++) {
      const sx = (i * 173) % WORLD_W;
      const sy = 50 + ((i * 97) % (GROUND_Y - 140));
      ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t * 2 + i);
      ctx.fillStyle = '#8888aa';
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // ground
    ctx.fillStyle = '#101024';
    ctx.fillRect(0, GROUND_Y, WORLD_W, H - GROUND_Y);
    ctx.strokeStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(WORLD_W, GROUND_Y);
    ctx.stroke();

    // base pad + flag
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 8;
    ctx.fillRect(BASE_X - BASE_PAD_W / 2, GROUND_Y - 4, BASE_PAD_W, 4);
    ctx.fillRect(BASE_X - BASE_PAD_W / 2 - 8, GROUND_Y - 40, 3, 40);
    ctx.fillStyle = '#39ff14';
    ctx.shadowColor = '#39ff14';
    ctx.beginPath();
    ctx.moveTo(BASE_X - BASE_PAD_W / 2 - 5, GROUND_Y - 40);
    ctx.lineTo(BASE_X - BASE_PAD_W / 2 + 13, GROUND_Y - 35);
    ctx.lineTo(BASE_X - BASE_PAD_W / 2 - 5, GROUND_Y - 30);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // barracks
    for (const b of st.barracks) {
      const x = b.x - BARRACK_W / 2;
      const y = GROUND_Y - BARRACK_H;
      if (b.hp > 0) {
        ctx.fillStyle = '#ff7a2d';
        ctx.shadowColor = '#ff7a2d';
        ctx.shadowBlur = 6;
        ctx.fillRect(x, y, BARRACK_W, BARRACK_H);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(b.x - 7, GROUND_Y - 18, 14, 18); // door
      } else {
        ctx.fillStyle = '#5a2a10';
        ctx.fillRect(x, GROUND_Y - 10, BARRACK_W, 10); // rubble
        if (b.inside > 0) {
          ctx.fillStyle = '#888';
          ctx.font = '9px Consolas, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(String(b.inside), b.x, GROUND_Y - 14);
        }
      }
    }

    // hostages + saved runners
    const drawPerson = (x: number, phase: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x - 1.5, GROUND_Y - 11, 3, 3); // head
      ctx.fillRect(x - 1, GROUND_Y - 8, 2, 5); // body
      const leg = Math.sin(phase) * 2;
      ctx.fillRect(x - 1 + leg, GROUND_Y - 3, 1.5, 3);
      ctx.fillRect(x - 0.5 - leg, GROUND_Y - 3, 1.5, 3);
    };
    for (const h of st.hostages) drawPerson(h.x, h.phase, '#39ff14');
    for (const r of st.runners) drawPerson(r.x, r.phase, '#00ffff');

    // tanks
    for (const tank of st.tanks) {
      ctx.fillStyle = '#ff2d78';
      ctx.shadowColor = '#ff2d78';
      ctx.shadowBlur = 6;
      ctx.fillRect(tank.x - 14, GROUND_Y - 12, 28, 8);
      ctx.fillRect(tank.x - 10, GROUND_Y - 17, 20, 6);
      // barrel aims at the chopper
      const ang = Math.atan2(ch.y - (GROUND_Y - 16), ch.x - tank.x);
      ctx.strokeStyle = '#ff2d78';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tank.x, GROUND_Y - 16);
      ctx.lineTo(tank.x + Math.cos(ang) * 14, GROUND_Y - 16 + Math.sin(ang) * 14);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // projectiles
    ctx.fillStyle = '#ffffff';
    for (const b of st.bullets) ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
    ctx.fillStyle = '#ffe600';
    for (const b of st.bombs) ctx.fillRect(b.x - 2, b.y - 3, 4, 6);
    ctx.fillStyle = '#ff2d78';
    for (const s of st.shells) ctx.fillRect(s.x - 2, s.y - 2, 4, 4);

    // chopper
    const blink = st.invulnTimer > 0 && Math.floor(performance.now() / 100) % 2 === 0;
    if (ch.alive && !blink) {
      ctx.save();
      ctx.translate(ch.x, ch.y);
      ctx.rotate((ch.vx / CHOPPER_MAX_VX) * 0.12);
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 8;
      if (ch.facing === 0) {
        // head-on
        ctx.fillRect(-8, -7, 16, 12);
      } else {
        ctx.fillRect(-13, -7, 26, 11); // body
        ctx.fillRect(ch.facing * 11, -5, ch.facing * 6, 5); // nose
        ctx.fillRect(-ch.facing * 24, -5, ch.facing * 12, 3); // tail boom
        ctx.fillRect(-ch.facing * 26, -10, 2, 7); // tail rotor
      }
      // skids
      ctx.fillRect(-12, 8, 10, 2);
      ctx.fillRect(2, 8, 10, 2);
      // main rotor
      const rotorHalf = 21 * Math.abs(Math.sin(performance.now() / 40));
      ctx.fillRect(-rotorHalf, -12, rotorHalf * 2, 2);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // explosions
    const flicker = Math.floor(performance.now() / 60) % 2 === 0;
    for (const ex of st.explosions) {
      ctx.fillStyle = flicker ? '#ffffff' : '#ffe600';
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // ---- minimap (screen space) ----
    const mapW = 240;
    const mapX = (W - mapW) / 2;
    const mapY = 14;
    ctx.fillStyle = 'rgba(10, 10, 18, 0.8)';
    ctx.fillRect(mapX - 4, mapY - 6, mapW + 8, 12);
    ctx.strokeStyle = '#1a1a2e';
    ctx.strokeRect(mapX - 4, mapY - 6, mapW + 8, 12);
    const toMap = (wx: number) => mapX + (wx / WORLD_W) * mapW;
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(toMap(BASE_X) - 2, mapY - 2, 4, 4);
    for (const b of st.barracks) {
      if (b.inside > 0 || b.hp > 0) {
        ctx.fillStyle = b.hp > 0 ? '#ff7a2d' : '#5a2a10';
        ctx.fillRect(toMap(b.x) - 1.5, mapY - 1.5, 3, 3);
      }
    }
    ctx.fillStyle = '#ff2d78';
    for (const tank of st.tanks) ctx.fillRect(toMap(tank.x) - 1, mapY - 1, 2, 2);
    if (ch.alive) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(toMap(ch.x) - 1.5, mapY - 1.5, 3, 3);
    }

    if (st.status !== 'playing') {
      ctx.fillStyle = 'rgba(5, 5, 8, 0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      const title =
        st.status === 'over'
          ? st.choppers > 0
            ? 'MISSION COMPLETE'
            : 'GAME OVER'
          : 'RESCUE CHOPPER';
      ctx.fillStyle = st.status === 'over' && st.choppers <= 0 ? '#ff2d78' : '#00ffff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.font = 'bold 26px Consolas, monospace';
      ctx.fillText(title, W / 2, H / 2 - 36);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#888';
      ctx.font = '14px Consolas, monospace';
      if (st.status === 'over') {
        ctx.fillStyle = '#39ff14';
        ctx.fillText(`${st.saved} / ${TOTAL_HOSTAGES} SAVED`, W / 2, H / 2 - 4);
        ctx.fillStyle = '#888';
        ctx.fillText('ENTER TO RETRY', W / 2, H / 2 + 24);
      } else {
        ctx.fillText('SHOOT BARRACKS OPEN. LAND. CARRY 16.', W / 2, H / 2 - 4);
        ctx.fillText('FERRY EVERYONE HOME. ENTER TO START.', W / 2, H / 2 + 16);
      }
    }
  });

  return (
    <div className={styles.gameWrap}>
      <div className={styles.hud} style={{ width: W }}>
        <span>SCORE {score}</span>
        <span>ABOARD {aboard}/{MAX_ABOARD}</span>
        <span>SAVED {saved}/{TOTAL_HOSTAGES}</span>
        <span>{'▲'.repeat(Math.max(0, choppers))}</span>
        <span>HI {highScore}</span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />
      <div className={styles.gameHint}>
        ARROWS FLY &middot; SPACE FIRE (HOVER = BOMB) &middot; LAND GENTLY &middot; M MENU &middot;
        ESC QUIT
      </div>
    </div>
  );
}
