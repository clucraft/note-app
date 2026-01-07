import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { NoteEditor } from '../notes/NoteEditor';
import { useNotes } from '../../hooks/useNotes';
import { NotesProvider } from '../../context/NotesContext';
import styles from './AppLayout.module.css';

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 500;
const DEFAULT_SIDEBAR_WIDTH = 280;

function AppLayoutContent() {
  const { loadNotes, selectNote, notes } = useNotes();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? parseInt(saved, 10) : DEFAULT_SIDEBAR_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const initialNoteHandled = useRef(false);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Handle ?note= URL parameter
  useEffect(() => {
    if (notes.length > 0 && !initialNoteHandled.current) {
      const noteId = searchParams.get('note');
      if (noteId) {
        const id = parseInt(noteId, 10);
        if (!isNaN(id)) {
          selectNote(id);
          // Clear the URL parameter after selecting
          setSearchParams({}, { replace: true });
        }
      }
      initialNoteHandled.current = true;
    }
  }, [notes, searchParams, selectNote, setSearchParams]);

  // Save sidebar width to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarWidth', String(sidebarWidth));
  }, [sidebarWidth]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startWidth: sidebarWidth,
    };
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return;

      const delta = e.clientX - resizeRef.current.startX;
      const newWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, resizeRef.current.startWidth + delta)
      );
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return (
    <div className={styles.layout}>
      <Header />
      <div className={styles.main}>
        <div style={{ width: sidebarWidth, flexShrink: 0 }}>
          <Sidebar />
        </div>
        <div
          className={`${styles.resizer} ${isResizing ? styles.resizing : ''}`}
          onMouseDown={handleMouseDown}
        />
        <main className={styles.content}>
          <NoteEditor />
        </main>
      </div>
    </div>
  );
}

export function AppLayout() {
  return (
    <NotesProvider>
      <AppLayoutContent />
    </NotesProvider>
  );
}
