import { useContext } from 'react';
import { NotesContext } from '../context/NotesContext';

export function useNotes() {
  const context = useContext(NotesContext);
  if (context === undefined) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
}
