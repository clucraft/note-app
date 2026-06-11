import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Snake } from './games/Snake';
import { BrickBreaker } from './games/BrickBreaker';
import { Shooter } from './games/Shooter';
import { Stacker } from './games/Stacker';
import { CacheCommand } from './games/CacheCommand';
import { RescueChopper } from './games/RescueChopper';
import { Runner } from './games/Runner';
import { NameEntry } from './NameEntry';
import { getHighScore, GameId } from './highScores';
import {
  ArcadeScore,
  getArcadeScores,
  postArcadeScore,
  getArcadeShare,
  enableArcadeShare,
  disableArcadeShare,
} from '../../api/arcade.api';
import {
  unlockAudio,
  stopAllAudio,
  toggleMusic,
  toggleSfx,
  isMusicOn,
  isSfxOn,
} from './audio';
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
  { id: 'chopper', name: 'RESCUE CHOPPER', color: '#4a9bff' },
  { id: 'runner', name: 'NIGHT RUN', color: '#ff6ec7' },
];

type Boards = Record<string, ArcadeScore[] | 'error'>;

interface ArcadeOverlayProps {
  onClose: () => void;
  shareToken?: string;
  standalone?: boolean;
}

export default function ArcadeOverlay({ onClose, shareToken, standalone }: ArcadeOverlayProps) {
  const [game, setGame] = useState<GameId | null>(null);
  const [selected, setSelected] = useState(0);
  const [boards, setBoards] = useState<Boards>({});
  const [pending, setPending] = useState<{ game: GameId; score: number } | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [share, setShare] = useState<{ enabled: boolean; token: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [musicOn, setMusicOn] = useState(isMusicOn());
  const [sfxOn, setSfxOn] = useState(isSfxOn());

  // Audio lifecycle: resume/start on any gesture (browsers require one),
  // toggle music with B and sound effects with N anywhere in the arcade,
  // and silence everything the instant the overlay unmounts.
  useEffect(() => {
    unlockAudio();
    const onGesture = () => unlockAudio();
    const onToggleKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'b') setMusicOn(toggleMusic());
      else if (key === 'n') setSfxOn(toggleSfx());
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    window.addEventListener('keydown', onToggleKey);
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      window.removeEventListener('keydown', onToggleKey);
      stopAllAudio();
    };
  }, []);

  // Boss key: Esc instantly closes the whole overlay (in-app), or backs out
  // to the menu (standalone page, where there is nothing to close into).
  // Capture phase so it beats every game-level key handler.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        if (standalone) {
          setGame(null);
          setPending(null);
          setShowShare(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = '';
    };
  }, [onClose, standalone]);

  // Fetch the leaderboard for the highlighted game while the menu is visible
  useEffect(() => {
    if (game || showShare) return;
    const id = GAMES[selected].id;
    if (boards[id]) return;
    let cancelled = false;
    getArcadeScores(id, shareToken)
      .then((scores) => {
        if (!cancelled) setBoards((b) => ({ ...b, [id]: scores }));
      })
      .catch(() => {
        if (!cancelled) setBoards((b) => ({ ...b, [id]: 'error' }));
      });
    return () => {
      cancelled = true;
    };
  }, [game, showShare, selected, boards, shareToken]);

  // Menu keyboard navigation (only while no game is active)
  useEffect(() => {
    if (game || pending || showShare) return;
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
      } else if (!standalone && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setShowShare(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, pending, showShare, standalone]);

  // Load share status when the share screen opens
  useEffect(() => {
    if (!showShare) return;
    setShare(null);
    getArcadeShare()
      .then(setShare)
      .catch(() => setShare({ enabled: false, token: null }));
  }, [showShare]);

  // Game-over hook: check whether the score cracks the top 10
  const handleScore = useCallback(
    (gameId: GameId) => async (score: number) => {
      if (score <= 0) return;
      try {
        const scores = await getArcadeScores(gameId, shareToken);
        const qualifies = scores.length < 10 || score > scores[scores.length - 1].score;
        if (qualifies) setPending({ game: gameId, score });
      } catch {
        // leaderboard unreachable — local high score still recorded
      }
    },
    [shareToken]
  );

  const submitInitials = useCallback(
    async (initials: string) => {
      if (!pending) return;
      const { game: gameId, score } = pending;
      setPending(null);
      try {
        const result = await postArcadeScore(gameId, initials, score, shareToken);
        setBoards((b) => ({ ...b, [gameId]: result.scores }));
      } catch {
        // ignore — score stays local
      }
    },
    [pending, shareToken]
  );

  const shareLink = share?.token ? `${window.location.origin}/arcade/${share.token}` : null;

  const board = boards[GAMES[selected].id];

  return createPortal(
    <div className={styles.overlay}>
      {game === 'snake' && <Snake onExit={() => setGame(null)} onScore={handleScore('snake')} />}
      {game === 'breaker' && (
        <BrickBreaker onExit={() => setGame(null)} onScore={handleScore('breaker')} />
      )}
      {game === 'shooter' && (
        <Shooter onExit={() => setGame(null)} onScore={handleScore('shooter')} />
      )}
      {game === 'stacker' && (
        <Stacker onExit={() => setGame(null)} onScore={handleScore('stacker')} />
      )}
      {game === 'missile' && (
        <CacheCommand onExit={() => setGame(null)} onScore={handleScore('missile')} />
      )}
      {game === 'chopper' && (
        <RescueChopper onExit={() => setGame(null)} onScore={handleScore('chopper')} />
      )}
      {game === 'runner' && <Runner onExit={() => setGame(null)} onScore={handleScore('runner')} />}

      {!game && showShare && (
        <div className={styles.sharePanel}>
          <div className={styles.title}>SHARE</div>
          {!share && <div className={styles.shareStatus}>LOADING&hellip;</div>}
          {share && !share.enabled && (
            <>
              <div className={styles.shareStatus}>
                SHARING IS OFF. ENABLE TO GET A LINK YOUR FRIENDS CAN PLAY ON &mdash; THEIR SCORES
                LAND ON THE SAME LEADERBOARD.
              </div>
              <button
                className={styles.menuItem}
                onClick={async () => {
                  const token = await enableArcadeShare();
                  setShare({ enabled: true, token });
                }}
              >
                ENABLE SHARING
              </button>
            </>
          )}
          {share && share.enabled && shareLink && (
            <>
              <div className={styles.shareStatus}>ANYONE WITH THIS LINK CAN PLAY AND POST SCORES:</div>
              <div className={styles.shareLink}>{shareLink}</div>
              <button
                className={styles.menuItem}
                onClick={() => {
                  navigator.clipboard.writeText(shareLink);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? 'COPIED!' : 'COPY LINK'}
              </button>
              <button
                className={styles.menuItem}
                onClick={async () => {
                  await disableArcadeShare();
                  setShare({ enabled: false, token: null });
                }}
              >
                DISABLE SHARING
              </button>
            </>
          )}
          <button className={styles.menuItem} onClick={() => setShowShare(false)}>
            BACK
          </button>
        </div>
      )}

      {!game && !showShare && (
        <>
          <div className={styles.title}>ARCADE</div>
          <div className={styles.subtitle}>INSERT COIN</div>
          <div className={styles.menuLayout}>
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
            <div className={styles.board}>
              <div className={styles.boardTitle} style={{ color: GAMES[selected].color }}>
                TOP 10
              </div>
              {!board && <div className={styles.boardEmpty}>LOADING&hellip;</div>}
              {board === 'error' && <div className={styles.boardEmpty}>LEADERBOARD OFFLINE</div>}
              {Array.isArray(board) && board.length === 0 && (
                <div className={styles.boardEmpty}>NO SCORES YET</div>
              )}
              {Array.isArray(board) &&
                board.map((s, i) => (
                  <div key={i} className={styles.boardRow}>
                    <span className={styles.boardRank}>{i + 1}</span>
                    <span>{s.initials}</span>
                    <span className={styles.boardScore}>{s.score}</span>
                  </div>
                ))}
            </div>
          </div>
          <div className={styles.hint}>
            &uarr;&darr; SELECT &middot; ENTER PLAY &middot; B &#9834;{musicOn ? 'ON' : 'OFF'} &middot;
            N FX {sfxOn ? 'ON' : 'OFF'}
            {!standalone && (
              <>
                {' '}
                &middot; S SHARE &middot; ESC QUIT
              </>
            )}
          </div>
        </>
      )}

      {pending && <NameEntry score={pending.score} onSubmit={submitInitials} />}
    </div>,
    document.body
  );
}
