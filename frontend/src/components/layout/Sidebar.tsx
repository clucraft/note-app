import { useState } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { NoteTree } from '../notes/NoteTree';
import { Button } from '../common/Button';
import { AIChatModal } from '../common/AIChatModal';
import { Calendar } from '../common/Calendar';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const { createNote, isLoading, selectNote } = useNotes();
  const [showAIChat, setShowAIChat] = useState(false);
  const [showCalendar, setShowCalendar] = useState(() => {
    const stored = localStorage.getItem('showCalendar');
    return stored !== null ? stored === 'true' : true;
  });

  const handleNewNote = async () => {
    await createNote({ title: 'Untitled', titleEmoji: '📄' });
  };

  const toggleCalendar = () => {
    const newValue = !showCalendar;
    setShowCalendar(newValue);
    localStorage.setItem('showCalendar', String(newValue));
  };

  const handleTaskClick = (task: { noteId: number | null }) => {
    if (task.noteId) {
      selectNote(task.noteId);
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <h2 className={styles.title}>Notes</h2>
        <div className={styles.headerButtons}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowAIChat(true)}
            title="AI Chat"
          >
            AI Chat
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleNewNote}
            disabled={isLoading}
            title="New note"
          >
            +
          </Button>
        </div>
      </div>
      <div className={styles.tree}>
        <NoteTree />
      </div>

      {/* Calendar Section */}
      <div className={styles.calendarSection}>
        <button className={styles.calendarToggle} onClick={toggleCalendar}>
          <span className={`${styles.calendarExpandIcon} ${showCalendar ? styles.expanded : ''}`}>
            ▶
          </span>
          <span className={styles.calendarIcon}>📅</span>
          <span className={styles.calendarToggleText}>Calendar</span>
        </button>
        <div className={`${styles.calendarContent} ${showCalendar ? styles.expanded : ''}`}>
          <div className={styles.calendarInner}>
            <Calendar onTaskClick={handleTaskClick} />
          </div>
        </div>
      </div>

      <AIChatModal isOpen={showAIChat} onClose={() => setShowAIChat(false)} />
    </aside>
  );
}
