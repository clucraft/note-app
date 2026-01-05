import { useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { NoteEditor } from '../notes/NoteEditor';
import { useNotes } from '../../hooks/useNotes';
import { NotesProvider } from '../../context/NotesContext';
import styles from './AppLayout.module.css';

function AppLayoutContent() {
  const { loadNotes } = useNotes();

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  return (
    <div className={styles.layout}>
      <Header />
      <div className={styles.main}>
        <Sidebar />
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
