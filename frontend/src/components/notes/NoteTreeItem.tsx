import { useState, useRef, useEffect } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { EmojiPicker } from '../common/EmojiPicker';
import type { Note } from '../../types/note.types';
import styles from './NoteTreeItem.module.css';

interface NoteTreeItemProps {
  note: Note;
  depth: number;
}

export function NoteTreeItem({ note, depth }: NoteTreeItemProps) {
  const { selectedNote, selectNote, createNote, deleteNote, toggleExpand, duplicateNote, moveNote, updateNote, notes } = useNotes();
  const [showMenu, setShowMenu] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLSpanElement>(null);

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

  const handleEmojiClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (emojiRef.current) {
      const rect = emojiRef.current.getBoundingClientRect();
      setEmojiPickerPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
    }
    setShowEmojiPicker(true);
  };

  const handleEmojiSelect = async (emoji: string) => {
    await updateNote(note.id, { titleEmoji: emoji });
    setShowEmojiPicker(false);
  };

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
    await createNote({ parentId: note.id, title: 'Untitled', titleEmoji: '📄' });
  };

  const handleDelete = async () => {
    setShowMenu(false);
    if (confirm('Delete this note and all its children?')) {
      await deleteNote(note.id);
    }
  };

  const handleCopyLink = async () => {
    setShowMenu(false);
    const url = `${window.location.origin}/?note=${note.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch (err) {
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
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
        {hasChildren ? (
          <button
            className={styles.expandButton}
            onClick={handleToggleExpand}
          >
            <span className={note.isExpanded ? styles.expanded : ''}>&#9656;</span>
          </button>
        ) : (
          <span className={styles.leafDot}>•</span>
        )}

        <span
          ref={emojiRef}
          className={styles.emoji}
          onClick={handleEmojiClick}
          title="Change emoji"
        >
          {note.titleEmoji || '📄'}
        </span>
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

      {showEmojiPicker && (
        <EmojiPicker
          onSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
          position={emojiPickerPosition}
        />
      )}

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
