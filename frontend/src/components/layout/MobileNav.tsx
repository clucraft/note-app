import { useState } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { AIChatModal } from '../common/AIChatModal';
import styles from './MobileNav.module.css';

interface MobileNavProps {
  onMenuClick: () => void;
  isDrawerOpen: boolean;
}

export function MobileNav({ onMenuClick, isDrawerOpen }: MobileNavProps) {
  const { createNote, isLoading } = useNotes();
  const [showAIChat, setShowAIChat] = useState(false);

  const handleNewNote = async () => {
    await createNote({ title: 'Untitled', titleEmoji: '📄' });
  };

  return (
    <>
      <nav className={styles.nav}>
        <button
          className={`${styles.navItem} ${isDrawerOpen ? styles.active : ''}`}
          onClick={onMenuClick}
          aria-label="Toggle menu"
        >
          <span className={styles.icon}>☰</span>
          <span className={styles.label}>Notes</span>
        </button>

        <button
          className={styles.navItem}
          onClick={handleNewNote}
          disabled={isLoading}
          aria-label="New note"
        >
          <span className={styles.icon}>+</span>
          <span className={styles.label}>New</span>
        </button>

        <button
          className={styles.navItem}
          onClick={() => setShowAIChat(true)}
          aria-label="AI Chat"
        >
          <span className={styles.icon}>✨</span>
          <span className={styles.label}>AI</span>
        </button>
      </nav>

      <AIChatModal isOpen={showAIChat} onClose={() => setShowAIChat(false)} />
    </>
  );
}
