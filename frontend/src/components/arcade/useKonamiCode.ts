import { useEffect, useRef } from 'react';

const SEQUENCE = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'b', 'a',
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

/**
 * Listens globally for the Konami code and fires the callback when entered.
 * Keystrokes inside inputs and the note editor are ignored so the sequence
 * can never trigger (or advance) while typing.
 */
export function useKonamiCode(onTrigger: () => void) {
  const indexRef = useRef(0);
  const triggerRef = useRef(onTrigger);
  triggerRef.current = onTrigger;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) {
        indexRef.current = 0;
        return;
      }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === SEQUENCE[indexRef.current]) {
        indexRef.current++;
        if (indexRef.current === SEQUENCE.length) {
          indexRef.current = 0;
          triggerRef.current();
        }
      } else {
        indexRef.current = key === SEQUENCE[0] ? 1 : 0;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
