import { useNotes } from '../../hooks/useNotes';
import { NoteTreeItem } from './NoteTreeItem';
import styles from './NoteTree.module.css';

interface NoteTreeProps {
  onNoteSelect?: () => void;
}

export function NoteTree({ onNoteSelect }: NoteTreeProps) {
  const { notes, isLoading, error } = useNotes();

  if (isLoading) {
    return <div className={styles.loading}>Loading notes...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (notes.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No notes yet</p>
        <p className={styles.hint}>Click "+ New" to create one</p>
      </div>
    );
  }

  return (
    <div className={styles.tree}>
      {notes.map((note, index) => (
        <NoteTreeItem
          key={note.id}
          note={note}
          depth={0}
          index={index}
          parentId={null}
          onNoteSelect={onNoteSelect}
        />
      ))}
    </div>
  );
}
