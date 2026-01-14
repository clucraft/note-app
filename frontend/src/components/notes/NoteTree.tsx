import { useMemo } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { NoteTreeItem } from './NoteTreeItem';
import { FavoriteItem } from './FavoriteItem';
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

export function NoteTree() {
  const { notes, isLoading, error } = useNotes();

  const favorites = useMemo(() => collectFavorites(notes), [notes]);

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
