import { useState, useRef, useEffect } from 'react';
import { useNotes } from '../../hooks/useNotes';
import type { Note } from '../../types/note.types';
import styles from './NoteTreeItem.module.css';

interface NoteTreeItemProps {
  note: Note;
  depth: number;
}

export function NoteTreeItem({ note, depth }: NoteTreeItemProps) {
  const { selectedNote, selectNote, createNote, deleteNote, toggleExpand, duplicateNote, moveNote, notes } = useNotes();
  const [showMenu, setShowMenu] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSelected = selectedNote?.id === note.id;
  const hasChildren = note.children.length > 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowMoveMenu(false);
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

  const handleCopyLink = () => {
    setShowMenu(false);
    const url = `${window.location.origin}/?note=${note.id}`;
    navigator.clipboard.writeText(url);
  };

  const handleDuplicate = async () => {
    setShowMenu(false);
    await duplicateNote(note.id);
  };

  const handleMoveToRoot = async () => {
    setShowMenu(false);
    setShowMoveMenu(false);
    await moveNote(note.id, null);
  };

  const handleMoveToNote = async (targetId: number) => {
    setShowMenu(false);
    setShowMoveMenu(false);
    await moveNote(note.id, targetId);
  };

  // Get flat list of all notes for move menu (excluding self and descendants)
  const getMoveTargets = (nodes: Note[], exclude: number): Note[] => {
    const result: Note[] = [];
    const collectNotes = (items: Note[], parentExcluded: boolean) => {
      for (const item of items) {
        const isExcluded = parentExcluded || item.id === exclude;
        if (!isExcluded) {
          result.push(item);
        }
        if (item.children.length > 0) {
          collectNotes(item.children, isExcluded);
        }
      }
    };
    collectNotes(nodes, false);
    return result;
  };

  const moveTargets = getMoveTargets(notes, note.id);

  const indent = depth * 16 + 8;

  return (
    <div className={styles.container} style={{ '--tree-indent': `${indent}px` } as React.CSSProperties}>
      <div
        className={`${styles.item} ${isSelected ? styles.selected : ''} ${depth > 0 ? styles.itemWithLine : ''}`}
        style={{ paddingLeft: `${indent}px` }}
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
            <span className={styles.menuIcon}>➕</span>
            Add child note
          </button>
          <button className={styles.menuItem} onClick={handleCopyLink}>
            <span className={styles.menuIcon}>🔗</span>
            Copy link
          </button>
          <button className={styles.menuItem} onClick={handleDuplicate}>
            <span className={styles.menuIcon}>📋</span>
            Duplicate
          </button>
          <button
            className={styles.menuItem}
            onClick={() => setShowMoveMenu(!showMoveMenu)}
          >
            <span className={styles.menuIcon}>📁</span>
            Move to...
            <span className={styles.menuArrow}>▶</span>
          </button>
          {showMoveMenu && (
            <div className={styles.subMenu}>
              <button className={styles.menuItem} onClick={handleMoveToRoot}>
                <span className={styles.menuIcon}>🏠</span>
                Root level
              </button>
              {moveTargets.map(target => (
                <button
                  key={target.id}
                  className={styles.menuItem}
                  onClick={() => handleMoveToNote(target.id)}
                >
                  <span className={styles.menuIcon}>{target.titleEmoji || '📄'}</span>
                  {target.title}
                </button>
              ))}
            </div>
          )}
          <div className={styles.menuDivider} />
          <button className={`${styles.menuItem} ${styles.danger}`} onClick={handleDelete}>
            <span className={styles.menuIcon}>🗑️</span>
            Delete
          </button>
        </div>
      )}

      {hasChildren && note.isExpanded && (
        <div className={styles.children} style={{ '--tree-indent': `${indent}px` } as React.CSSProperties}>
          {note.children.map((child) => (
            <NoteTreeItem key={child.id} note={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
