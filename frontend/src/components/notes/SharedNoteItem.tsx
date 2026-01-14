import { useNotes } from '../../hooks/useNotes';
import type { SharedNote } from '../../api/notes.api';
import styles from './SharedNoteItem.module.css';

interface SharedNoteItemProps {
  note: SharedNote;
}

export function SharedNoteItem({ note }: SharedNoteItemProps) {
  const { selectedNote, selectNote } = useNotes();

  const isSelected = selectedNote?.id === note.id;

  const handleClick = () => {
    // Select the shared note by ID - it will be fetched from the server
    selectNote(note.id);
  };

  return (
    <div
      className={`${styles.item} ${isSelected ? styles.selected : ''}`}
      onClick={handleClick}
      title={`Shared by ${note.ownerDisplayName || note.ownerUsername} (${note.permission})`}
    >
      <span className={styles.emoji}>{note.titleEmoji || '📄'}</span>
      <div className={styles.content}>
        <span className={styles.title}>{note.title}</span>
        <span className={styles.owner}>
          from {note.ownerDisplayName || note.ownerUsername}
        </span>
      </div>
      <span className={styles.permission} title={note.permission === 'edit' ? 'Can edit' : 'View only'}>
        {note.permission === 'edit' ? '✏️' : '👁️'}
      </span>
    </div>
  );
}
