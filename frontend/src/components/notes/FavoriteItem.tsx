import { useNotes } from '../../hooks/useNotes';
import type { Note } from '../../types/note.types';
import styles from './FavoriteItem.module.css';

interface FavoriteItemProps {
  note: Note;
}

export function FavoriteItem({ note }: FavoriteItemProps) {
  const { selectedNote, selectNote } = useNotes();

  const isSelected = selectedNote?.id === note.id;

  const handleClick = () => {
    selectNote(note);
  };

  return (
    <div
      className={`${styles.item} ${isSelected ? styles.selected : ''}`}
      onClick={handleClick}
    >
      <span className={styles.emoji}>{note.titleEmoji || '📄'}</span>
      <span className={styles.title}>{note.title}</span>
    </div>
  );
}
