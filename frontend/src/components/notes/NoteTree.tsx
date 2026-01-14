import { useMemo, useState, useEffect } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { NoteTreeItem } from './NoteTreeItem';
import { FavoriteItem } from './FavoriteItem';
import { SharedNoteItem } from './SharedNoteItem';
import { getSharedWithMeNotes, type SharedNote } from '../../api/notes.api';
import type { Note } from '../../types/note.types';
import styles from './NoteTree.module.css';

// Recursively collect all favorites from the note tree
function collectFavorites(notes: Note[]): Note[] {
  const favorites: Note[] = [];

  function traverse(nodes: Note[]) {
    for (const node of nodes) {
      if (node.isFavorite) {
        favorites.push(node);
      }
      if (node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(notes);
  return favorites;
}

const SHARED_EXPANDED_KEY = 'note-app-shared-expanded';

export function NoteTree() {
  const { notes, isLoading, error } = useNotes();
  const [sharedNotes, setSharedNotes] = useState<SharedNote[]>([]);
  const [sharedExpanded, setSharedExpanded] = useState(() => {
    const stored = localStorage.getItem(SHARED_EXPANDED_KEY);
    return stored !== 'false'; // Default to expanded
  });

  const favorites = useMemo(() => collectFavorites(notes), [notes]);

  // Load shared notes
  useEffect(() => {
    getSharedWithMeNotes()
      .then(setSharedNotes)
      .catch((err) => console.error('Failed to load shared notes:', err));
  }, []);

  const toggleSharedExpanded = () => {
    const newValue = !sharedExpanded;
    setSharedExpanded(newValue);
    localStorage.setItem(SHARED_EXPANDED_KEY, String(newValue));
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading notes...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  // Show empty state only if user has no notes AND no shared notes
  if (notes.length === 0 && sharedNotes.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No notes yet</p>
        <p className={styles.hint}>Click "+ New" to create one</p>
      </div>
    );
  }

  return (
    <div className={styles.tree}>
      {/* Shared with me section - show first so users see shared content even with no own notes */}
      {sharedNotes.length > 0 && (
        <div className={styles.sharedSection}>
          <div className={styles.sharedHeader} onClick={toggleSharedExpanded}>
            <span className={`${styles.expandButton} ${sharedExpanded ? styles.expanded : ''}`}>
              ▶
            </span>
            <span className={styles.sharedIcon}>👥</span>
            <span>Shared with me</span>
            <span className={styles.count}>({sharedNotes.length})</span>
          </div>
          <div className={`${styles.sharedList} ${sharedExpanded ? styles.expanded : ''}`}>
            <div className={styles.listInner}>
              {sharedNotes.map((note) => (
                <SharedNoteItem key={note.id} note={note} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Favorites section */}
      {favorites.length > 0 && (
        <div className={styles.favoritesSection}>
          <div className={styles.favoritesHeader}>
            <span className={styles.favoritesIcon}>★</span>
            <span>Favorites</span>
          </div>
          <div className={styles.favoritesList}>
            {favorites.map((note) => (
              <FavoriteItem key={note.id} note={note} />
            ))}
          </div>
        </div>
      )}

      {/* Regular notes tree */}
      {notes.map((note, index) => (
        <NoteTreeItem
          key={note.id}
          note={note}
          depth={0}
          index={index}
          parentId={null}
        />
      ))}
    </div>
  );
}
