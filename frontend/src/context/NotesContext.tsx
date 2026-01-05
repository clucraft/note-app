import { createContext, useState, useCallback, ReactNode } from 'react';
import type { Note, CreateNoteInput, UpdateNoteInput } from '../types/note.types';
import * as notesApi from '../api/notes.api';

interface NotesContextType {
  notes: Note[];
  selectedNote: Note | null;
  isLoading: boolean;
  error: string | null;
  loadNotes: () => Promise<void>;
  selectNote: (note: Note | null) => void;
  createNote: (input: CreateNoteInput) => Promise<Note>;
  updateNote: (id: number, input: UpdateNoteInput) => Promise<void>;
  deleteNote: (id: number) => Promise<void>;
  moveNote: (id: number, parentId: number | null) => Promise<void>;
  toggleExpand: (id: number) => Promise<void>;
}

export const NotesContext = createContext<NotesContextType | undefined>(undefined);

interface NotesProviderProps {
  children: ReactNode;
}

export function NotesProvider({ children }: NotesProviderProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const tree = await notesApi.getNotesTree();
      setNotes(tree);
    } catch (err) {
      setError('Failed to load notes');
      console.error('Load notes error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectNote = useCallback((note: Note | null) => {
    setSelectedNote(note);
  }, []);

  const createNote = useCallback(async (input: CreateNoteInput): Promise<Note> => {
    const newNote = await notesApi.createNote(input);
    await loadNotes(); // Reload tree
    return newNote;
  }, [loadNotes]);

  const updateNote = useCallback(async (id: number, input: UpdateNoteInput) => {
    const updated = await notesApi.updateNote(id, input);

    // Update local state
    const updateInTree = (nodes: Note[]): Note[] => {
      return nodes.map(node => {
        if (node.id === id) {
          return { ...node, ...updated };
        }
        if (node.children.length > 0) {
          return { ...node, children: updateInTree(node.children) };
        }
        return node;
      });
    };

    setNotes(prev => updateInTree(prev));

    if (selectedNote?.id === id) {
      setSelectedNote(prev => prev ? { ...prev, ...updated } : null);
    }
  }, [selectedNote]);

  const deleteNote = useCallback(async (id: number) => {
    await notesApi.deleteNote(id);

    if (selectedNote?.id === id) {
      setSelectedNote(null);
    }

    await loadNotes();
  }, [loadNotes, selectedNote]);

  const moveNote = useCallback(async (id: number, parentId: number | null) => {
    await notesApi.moveNote(id, parentId);
    await loadNotes();
  }, [loadNotes]);

  const toggleExpand = useCallback(async (id: number) => {
    const result = await notesApi.toggleExpand(id);

    const updateInTree = (nodes: Note[]): Note[] => {
      return nodes.map(node => {
        if (node.id === id) {
          return { ...node, isExpanded: result.isExpanded };
        }
        if (node.children.length > 0) {
          return { ...node, children: updateInTree(node.children) };
        }
        return node;
      });
    };

    setNotes(prev => updateInTree(prev));
  }, []);

  return (
    <NotesContext.Provider
      value={{
        notes,
        selectedNote,
        isLoading,
        error,
        loadNotes,
        selectNote,
        createNote,
        updateNote,
        deleteNote,
        moveNote,
        toggleExpand
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}
