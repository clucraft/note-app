import { createContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { Note, CreateNoteInput, UpdateNoteInput } from '../types/note.types';
import * as notesApi from '../api/notes.api';

const SELECTED_NOTE_KEY = 'selectedNoteId';

interface NotesContextType {
  notes: Note[];
  selectedNote: Note | null;
  isLoading: boolean;
  error: string | null;
  loadNotes: () => Promise<void>;
  selectNote: (noteOrId: Note | number | null) => void;
  createNote: (input: CreateNoteInput) => Promise<Note>;
  updateNote: (id: number, input: UpdateNoteInput) => Promise<void>;
  deleteNote: (id: number) => Promise<void>;
  moveNote: (id: number, parentId: number | null) => Promise<void>;
  reorderNote: (id: number, parentId: number | null, newIndex: number) => Promise<void>;
  toggleExpand: (id: number) => Promise<void>;
  duplicateNote: (id: number) => Promise<Note>;
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

  // Restore selected note from localStorage after notes load
  useEffect(() => {
    if (notes.length > 0 && !selectedNote) {
      const savedNoteId = localStorage.getItem(SELECTED_NOTE_KEY);
      if (savedNoteId) {
        const noteId = parseInt(savedNoteId, 10);
        if (!isNaN(noteId)) {
          // Fetch and select the saved note
          notesApi.getNote(noteId)
            .then(note => setSelectedNote(note))
            .catch(() => localStorage.removeItem(SELECTED_NOTE_KEY));
        }
      }
    }
  }, [notes, selectedNote]);

  const selectNote = useCallback(async (noteOrId: Note | number | null) => {
    if (noteOrId === null) {
      setSelectedNote(null);
      localStorage.removeItem(SELECTED_NOTE_KEY);
      return;
    }

    if (typeof noteOrId === 'number') {
      // Fetch the note by ID
      try {
        const note = await notesApi.getNote(noteOrId);
        setSelectedNote(note);
        localStorage.setItem(SELECTED_NOTE_KEY, String(noteOrId));
      } catch (err) {
        console.error('Failed to select note:', err);
        localStorage.removeItem(SELECTED_NOTE_KEY);
      }
    } else {
      setSelectedNote(noteOrId);
      localStorage.setItem(SELECTED_NOTE_KEY, String(noteOrId.id));
    }
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
    // Check if the note to delete is the selected note or an ancestor of it
    const isSelectedOrAncestor = (noteId: number, nodes: Note[]): boolean => {
      for (const node of nodes) {
        if (node.id === noteId) {
          // Found the note being deleted - check if selected note is this or a descendant
          const isDescendant = (n: Note): boolean => {
            if (n.id === selectedNote?.id) return true;
            return n.children.some(isDescendant);
          };
          return node.id === selectedNote?.id || isDescendant(node);
        }
        if (node.children.length > 0 && isSelectedOrAncestor(noteId, node.children)) {
          return true;
        }
      }
      return false;
    };

    const shouldClearSelection = selectedNote && isSelectedOrAncestor(id, notes);

    await notesApi.deleteNote(id);

    if (shouldClearSelection) {
      setSelectedNote(null);
      localStorage.removeItem(SELECTED_NOTE_KEY);
    }

    await loadNotes();
  }, [loadNotes, selectedNote, notes]);

  const moveNote = useCallback(async (id: number, parentId: number | null) => {
    await notesApi.moveNote(id, parentId);
    await loadNotes();
  }, [loadNotes]);

  const reorderNote = useCallback(async (id: number, parentId: number | null, newIndex: number) => {
    // First move to new parent if different
    await notesApi.moveNote(id, parentId);
    // Then set sort order
    await notesApi.reorderNote(id, newIndex);
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

  const duplicateNote = useCallback(async (id: number): Promise<Note> => {
    const newNote = await notesApi.duplicateNote(id);
    await loadNotes();
    return newNote;
  }, [loadNotes]);

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
        reorderNote,
        toggleExpand,
        duplicateNote
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}
