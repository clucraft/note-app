import { useEffect, useRef, useState } from 'react';
import styles from './Arcade.module.css';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const INITIALS_KEY = 'arcade.initials';

interface NameEntryProps {
  score: number;
  onSubmit: (initials: string) => void;
}

/**
 * Classic arcade three-letter initials entry. Blocks all game input
 * (capture-phase) while open; Escape still reaches the boss key because the
 * overlay's capture listener was registered first.
 */
export function NameEntry({ score, onSubmit }: NameEntryProps) {
  const [letters, setLetters] = useState<string[]>(() => {
    const saved = localStorage.getItem(INITIALS_KEY) || 'AAA';
    return [saved[0] || 'A', saved[1] || 'A', saved[2] || 'A'];
  });
  const [slot, setSlot] = useState(0);
  const submittedRef = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return; // boss key passes through
      e.stopPropagation();
      e.preventDefault();

      if (e.key === 'Enter') {
        if (submittedRef.current) return;
        submittedRef.current = true;
        setLetters((ls) => {
          const initials = ls.join('');
          localStorage.setItem(INITIALS_KEY, initials);
          onSubmit(initials);
          return ls;
        });
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        setSlot((s) => Math.max(0, s - 1));
        return;
      }
      if (e.key === 'ArrowRight') {
        setSlot((s) => Math.min(2, s + 1));
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const delta = e.key === 'ArrowUp' ? 1 : -1;
        setSlot((s) => {
          setLetters((ls) => {
            const next = [...ls];
            const idx = (CHARS.indexOf(next[s]) + delta + CHARS.length) % CHARS.length;
            next[s] = CHARS[idx];
            return next;
          });
          return s;
        });
        return;
      }
      const ch = e.key.toUpperCase();
      if (ch.length === 1 && CHARS.includes(ch)) {
        setSlot((s) => {
          setLetters((ls) => {
            const next = [...ls];
            next[s] = ch;
            return next;
          });
          return Math.min(2, s + 1);
        });
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onSubmit]);

  return (
    <div className={styles.nameEntryBackdrop}>
      <div className={styles.nameEntry}>
        <div className={styles.nameEntryTitle}>HIGH SCORE</div>
        <div className={styles.nameEntryScore}>{score}</div>
        <div className={styles.nameEntrySub}>ENTER YOUR INITIALS</div>
        <div className={styles.nameEntrySlots}>
          {letters.map((ch, i) => (
            <span
              key={i}
              className={`${styles.nameEntrySlot} ${i === slot ? styles.nameEntrySlotActive : ''}`}
            >
              {ch}
            </span>
          ))}
        </div>
        <div className={styles.nameEntryHint}>
          &uarr;&darr; OR TYPE &middot; &larr;&rarr; SLOT &middot; ENTER CONFIRM
        </div>
      </div>
    </div>
  );
}
