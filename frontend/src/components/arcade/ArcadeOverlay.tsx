import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Snake } from './games/Snake';
import { BrickBreaker } from './games/BrickBreaker';
import { Shooter } from './games/Shooter';
import { Stacker } from './games/Stacker';
import { CacheCommand } from './games/CacheCommand';
import { getHighScore, GameId } from './highScores';
import styles from './Arcade.module.css';

interface GameDef {
  id: GameId;
  name: string;
  color: string;
}

const GAMES: GameDef[] = [
  { id: 'snake', name: 'SNAKE', color: '#39ff14' },
  { id: 'breaker', name: 'BRICK BREAKER', color: '#ffe600' },
  { id: 'shooter', name: 'CACHE INVADERS', color: '#ff2d78' },
  { id: 'stacker', name: 'STACKER', color: '#b14aff' },
  { id: 'missile', name: 'CACHE COMMAND', color: '#ff7a2d' },
];

export default function ArcadeOverlay({ onClose }: { onClose: () => void }) {
  const [game, setGame] = useState<GameId | null>(null);
  const [selected, setSelected] = useState(0);

  // Boss key: Esc instantly closes the whole overlay, no matter what's running.
  // Capture phase so it beats every game-level key handler.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Menu keyboard navigation (only while no game is active)
  useEffect(() => {
    if (game) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => (s + GAMES.length - 1) % GAMES.length);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => (s + 1) % GAMES.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setSelected((s) => {
          setGame(GAMES[s].id);
          return s;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game]);

  return createPortal(
    <div className={styles.overlay}>
      {game === 'snake' && <Snake onExit={() => setGame(null)} />}
      {game === 'breaker' && <BrickBreaker onExit={() => setGame(null)} />}
      {game === 'shooter' && <Shooter onExit={() => setGame(null)} />}
      {game === 'stacker' && <Stacker onExit={() => setGame(null)} />}
      {game === 'missile' && <CacheCommand onExit={() => setGame(null)} />}
      {!game && (
        <>
          <div className={styles.title}>ARCADE</div>
          <div className={styles.subtitle}>INSERT COIN</div>
          <div className={styles.menu}>
            {GAMES.map((g, i) => (
              <button
                key={g.id}
                className={`${styles.menuItem} ${i === selected ? styles.menuItemActive : ''}`}
                style={{ '--arcade-accent': g.color } as React.CSSProperties}
                onMouseEnter={() => setSelected(i)}
                onClick={() => setGame(g.id)}
              >
                <span>{g.name}</span>
                <span className={styles.menuScore}>HI {getHighScore(g.id)}</span>
              </button>
            ))}
          </div>
          <div className={styles.hint}>&uarr;&darr; SELECT &middot; ENTER PLAY &middot; ESC QUIT</div>
        </>
      )}
    </div>,
    document.body
  );
}
