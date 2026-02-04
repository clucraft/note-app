import { useState, useEffect, useCallback, useRef } from 'react';
import { getRecentlyEditedNotes, RecentlyEditedNote } from '../../api/notes.api';
import { useNotes } from '../../hooks/useNotes';
import styles from './RecentlyEditedModal.module.css';

interface RecentlyEditedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GroupedNotes {
  today: RecentlyEditedNote[];
  yesterday: RecentlyEditedNote[];
  thisWeek: RecentlyEditedNote[];
  older: RecentlyEditedNote[];
}

export function RecentlyEditedModal({ isOpen, onClose }: RecentlyEditedModalProps) {
  const { selectNote } = useNotes();
  const [notes, setNotes] = useState<RecentlyEditedNote[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<GroupedNotes>({
    today: [],
    yesterday: [],
    thisWeek: [],
    older: []
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load notes when modal opens
  useEffect(() => {
    if (isOpen) {
      loadNotes();
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const allNotes = getAllNotesFlat();

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, allNotes.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < allNotes.length) {
            handleNoteClick(allNotes[selectedIndex]);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredNotes, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const loadNotes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getRecentlyEditedNotes(100);
      setNotes(data);
      groupAndFilterNotes(data, searchQuery);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load recently edited notes');
    } finally {
      setIsLoading(false);
    }
  };

  const groupAndFilterNotes = useCallback((notesList: RecentlyEditedNote[], query: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const filtered = query
      ? notesList.filter(note =>
          note.title.toLowerCase().includes(query.toLowerCase()) ||
          note.preview.toLowerCase().includes(query.toLowerCase())
        )
      : notesList;

    const grouped: GroupedNotes = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    };

    filtered.forEach(note => {
      const noteDate = new Date(note.updatedAt);
      if (noteDate >= today) {
        grouped.today.push(note);
      } else if (noteDate >= yesterday) {
        grouped.yesterday.push(note);
      } else if (noteDate >= weekAgo) {
        grouped.thisWeek.push(note);
      } else {
        grouped.older.push(note);
      }
    });

    setFilteredNotes(grouped);
    setSelectedIndex(filtered.length > 0 ? 0 : -1);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    groupAndFilterNotes(notes, query);
  };

  const handleNoteClick = (note: RecentlyEditedNote) => {
    selectNote(note.id);
    onClose();
  };

  const getAllNotesFlat = (): RecentlyEditedNote[] => {
    return [
      ...filteredNotes.today,
      ...filteredNotes.yesterday,
      ...filteredNotes.thisWeek,
      ...filteredNotes.older
    ];
  };

  const getRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getEditTypeLabel = (editType: string): string => {
    switch (editType) {
      case 'created': return 'Created';
      case 'title_changed': return 'Renamed';
      case 'content_edited': return 'Edited';
      default: return 'Edited';
    }
  };

  const renderNoteItem = (note: RecentlyEditedNote, globalIndex: number) => {
    const isSelected = selectedIndex === globalIndex;

    return (
      <div
        key={note.id}
        data-index={globalIndex}
        className={`${styles.noteItem} ${isSelected ? styles.selected : ''}`}
        onClick={() => handleNoteClick(note)}
      >
        <div className={styles.noteHeader}>
          <span className={styles.noteEmoji}>{note.titleEmoji || '📄'}</span>
          <span className={styles.noteTitle}>{note.title}</span>
          <span className={styles.noteTime}>{getRelativeTime(note.updatedAt)}</span>
        </div>
        <div className={styles.notePreview}>{note.preview}</div>
        <div className={styles.noteMeta}>
          <span className={`${styles.editType} ${styles[note.editType]}`}>
            {getEditTypeLabel(note.editType)}
          </span>
          {note.editsToday > 0 && (
            <span className={styles.editsToday}>
              {note.editsToday} edit{note.editsToday !== 1 ? 's' : ''} today
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderGroup = (title: string, groupNotes: RecentlyEditedNote[], startIndex: number) => {
    if (groupNotes.length === 0) return null;

    return (
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{title}</h3>
        {groupNotes.map((note, idx) => renderNoteItem(note, startIndex + idx))}
      </div>
    );
  };

  if (!isOpen) return null;

  const todayStart = 0;
  const yesterdayStart = filteredNotes.today.length;
  const thisWeekStart = yesterdayStart + filteredNotes.yesterday.length;
  const olderStart = thisWeekStart + filteredNotes.thisWeek.length;

  const totalNotes = getAllNotesFlat().length;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Recently Edited</h2>
          <button className={styles.closeButton} onClick={onClose} title="Close (Esc)">
            &times;
          </button>
        </div>

        <div className={styles.searchContainer}>
          <input
            ref={searchInputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Filter notes..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
          {searchQuery && (
            <button
              className={styles.clearSearch}
              onClick={() => {
                setSearchQuery('');
                groupAndFilterNotes(notes, '');
              }}
            >
              &times;
            </button>
          )}
        </div>

        <div className={styles.content} ref={listRef}>
          {isLoading ? (
            <div className={styles.loading}>Loading...</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : totalNotes === 0 ? (
            <div className={styles.emptyState}>
              {searchQuery ? (
                <p>No notes matching "{searchQuery}"</p>
              ) : (
                <p>No recently edited notes</p>
              )}
            </div>
          ) : (
            <>
              {renderGroup('Today', filteredNotes.today, todayStart)}
              {renderGroup('Yesterday', filteredNotes.yesterday, yesterdayStart)}
              {renderGroup('This Week', filteredNotes.thisWeek, thisWeekStart)}
              {renderGroup('Older', filteredNotes.older, olderStart)}
            </>
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.footerHint}>
            <kbd>↑</kbd> <kbd>↓</kbd> Navigate &nbsp;&nbsp;
            <kbd>Enter</kbd> Open &nbsp;&nbsp;
            <kbd>Esc</kbd> Close
          </span>
          <span className={styles.noteCount}>{totalNotes} notes</span>
        </div>
      </div>
    </div>
  );
}
