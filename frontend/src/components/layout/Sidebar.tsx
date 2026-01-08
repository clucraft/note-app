import { useState } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { NoteTree } from '../notes/NoteTree';
import { Button } from '../common/Button';
import { AIChatModal } from '../common/AIChatModal';
import styles from './Sidebar.module.css';

interface SidebarProps {
  onNoteSelect?: () => void;
}

export function Sidebar({ onNoteSelect }: SidebarProps) {
  const { createNote, isLoading } = useNotes();
  const [showAIChat, setShowAIChat] = useState(false);

  const handleNewNote = async () => {
    await createNote({ title: 'Untitled', titleEmoji: '📄' });
    onNoteSelect?.();
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <h2 className={styles.title}>Notes</h2>
        <div className={styles.headerButtons}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowAIChat(true)}
            title="AI Chat"
          >
            AI Chat
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleNewNote}
            disabled={isLoading}
            title="New note"
          >
            +
          </Button>
        </div>
      </div>
      <div className={styles.tree}>
        <NoteTree onNoteSelect={onNoteSelect} />
      </div>

      <AIChatModal isOpen={showAIChat} onClose={() => setShowAIChat(false)} />
    </aside>
  );
}
