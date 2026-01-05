import { useNotes } from '../../hooks/useNotes';
import { NoteTree } from '../notes/NoteTree';
import { Button } from '../common/Button';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const { createNote, isLoading } = useNotes();

  const handleNewNote = async () => {
    await createNote({ title: 'Untitled' });
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <h2 className={styles.title}>Notes</h2>
        <Button
          size="sm"
          onClick={handleNewNote}
          disabled={isLoading}
          title="New note"
        >
          + New
        </Button>
      </div>
      <div className={styles.tree}>
        <NoteTree />
      </div>
    </aside>
  );
}
