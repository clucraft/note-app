import { api } from './index';
import type { Note, CreateNoteInput, UpdateNoteInput } from '../types/note.types';

export async function getNotesTree(): Promise<Note[]> {
  const response = await api.get<Note[]>('/notes');
  return response.data;
}

export async function getNote(id: number): Promise<Note> {
  const response = await api.get<Note>(`/notes/${id}`);
  return response.data;
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  const response = await api.post<Note>('/notes', input);
  return response.data;
}

export async function updateNote(id: number, input: UpdateNoteInput): Promise<Note> {
  const response = await api.put<Note>(`/notes/${id}`, input);
  return response.data;
}

export async function deleteNote(id: number): Promise<void> {
  await api.delete(`/notes/${id}`);
}

export async function moveNote(id: number, parentId: number | null): Promise<void> {
  await api.put(`/notes/${id}/move`, { parentId });
}

export async function reorderNote(id: number, sortOrder: number): Promise<void> {
  await api.put(`/notes/${id}/reorder`, { sortOrder });
}

export async function toggleExpand(id: number): Promise<{ isExpanded: boolean }> {
  const response = await api.put<{ isExpanded: boolean }>(`/notes/${id}/toggle-expand`);
  return response.data;
}

export interface SearchResult {
  id: number;
  title: string;
  titleEmoji: string | null;
  preview: string;
  updatedAt: string;
}

export async function searchNotes(query: string): Promise<SearchResult[]> {
  const response = await api.get<SearchResult[]>('/notes/search', { params: { q: query } });
  return response.data;
}

export async function duplicateNote(id: number): Promise<Note> {
  const response = await api.post<Note>(`/notes/${id}/duplicate`);
  return response.data;
}
