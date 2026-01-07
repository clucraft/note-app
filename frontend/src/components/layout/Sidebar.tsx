import { useState } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { NoteTree } from '../notes/NoteTree';
import { Button } from '../common/Button';
import { AIChatModal } from '../common/AIChatModal';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const { createNote, isLoading } = useNotes();
  const [showAIChat, setShowAIChat] = useState(false);

  const handleNewNote = async () => {
    await createNote({ title: 'Untitled' });
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
            onClick={handleNewNote}
            disabled={isLoading}
            title="New note"
          >
            +
          </Button>
        </div>
      </div>
      <div className={styles.tree}>
        <NoteTree />
      </div>

      <AIChatModal isOpen={showAIChat} onClose={() => setShowAIChat(false)} />
    </aside>
  );
}
