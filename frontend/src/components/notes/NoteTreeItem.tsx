import { useState, useRef, useEffect } from 'react';
import { useNotes } from '../../hooks/useNotes';
import type { Note } from '../../types/note.types';
import styles from './NoteTreeItem.module.css';

interface NoteTreeItemProps {
  note: Note;
  depth: number;
}

export function NoteTreeItem({ note, depth }: NoteTreeItemProps) {
  const { selectedNote, selectNote, createNote, deleteNote, toggleExpand } = useNotes();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSelected = selectedNote?.id === note.id;
  const hasChildren = note.children.length > 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClick = () => {
    selectNote(note);
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleExpand(note.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(true);
  };

  const handleAddChild = async () => {
    setShowMenu(false);
    await createNote({ parentId: note.id, title: 'Untitled' });
  };

  const handleDelete = async () => {
    setShowMenu(false);
    if (confirm('Delete this note and all its children?')) {
      await deleteNote(note.id);
    }
  };

  return (
    <div className={styles.container}>
      <div
        className={`${styles.item} ${isSelected ? styles.selected : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <button
          className={`${styles.expandButton} ${!hasChildren ? styles.hidden : ''}`}
          onClick={handleToggleExpand}
        >
          <span className={note.isExpanded ? styles.expanded : ''}>&#9656;</span>
        </button>

        <span className={styles.emoji}>{note.titleEmoji || '📄'}</span>
        <span className={styles.title}>{note.title}</span>

        <button
          className={styles.menuButton}
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
        >
          &#8943;
        </button>
      </div>

      {showMenu && (
        <div
          ref={menuRef}
          className={styles.contextMenu}
          style={{ left: `${depth * 16 + 100}px` }}
        >
          <button className={styles.menuItem} onClick={handleAddChild}>
            Add child note
          </button>
          <button className={`${styles.menuItem} ${styles.danger}`} onClick={handleDelete}>
            Delete
          </button>
        </div>
      )}

      {hasChildren && note.isExpanded && (
        <div className={styles.children}>
          {note.children.map((child) => (
            <NoteTreeItem key={child.id} note={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
