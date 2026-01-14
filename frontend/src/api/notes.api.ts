import { api } from './index';
import type { Note, CreateNoteInput, UpdateNoteInput, NoteVersionSummary, NoteVersion } from '../types/note.types';

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
  matchType?: 'keyword' | 'semantic';
}

export async function searchNotes(query: string): Promise<SearchResult[]> {
  const response = await api.get<SearchResult[]>('/notes/search', { params: { q: query } });
  return response.data;
}

export async function duplicateNote(id: number): Promise<Note> {
  const response = await api.post<Note>(`/notes/${id}/duplicate`);
  return response.data;
}

// Trash API functions

export interface DeletedNote {
  id: number;
  title: string;
  titleEmoji: string | null;
  createdAt: string;
  deletedAt: string;
}

export async function getDeletedNotes(): Promise<DeletedNote[]> {
  const response = await api.get<DeletedNote[]>('/notes/trash');
  return response.data;
}

export async function restoreNotes(noteIds: number[]): Promise<{ message: string; count: number }> {
  const response = await api.post<{ message: string; count: number }>('/notes/trash/restore', { noteIds });
  return response.data;
}

export async function permanentlyDeleteNotes(noteIds: number[]): Promise<{ message: string; count: number }> {
  const response = await api.post<{ message: string; count: number }>('/notes/trash/permanent-delete', { noteIds });
  return response.data;
}

export async function emptyTrash(): Promise<{ message: string; count: number }> {
  const response = await api.delete<{ message: string; count: number }>('/notes/trash/empty');
  return response.data;
}

export async function getAutoDeleteDays(): Promise<{ autoDeleteDays: number }> {
  const response = await api.get<{ autoDeleteDays: number }>('/notes/trash/settings');
  return response.data;
}

export async function updateAutoDeleteDays(days: number): Promise<{ autoDeleteDays: number }> {
  const response = await api.put<{ autoDeleteDays: number }>('/notes/trash/settings', { days });
  return response.data;
}

// Version History API functions

export async function getNoteVersions(noteId: number): Promise<NoteVersionSummary[]> {
  const response = await api.get<NoteVersionSummary[]>(`/notes/${noteId}/versions`);
  return response.data;
}

export async function getNoteVersion(noteId: number, versionId: number): Promise<NoteVersion> {
  const response = await api.get<NoteVersion>(`/notes/${noteId}/versions/${versionId}`);
  return response.data;
}

export async function restoreNoteVersion(noteId: number, versionId: number): Promise<void> {
  await api.post(`/notes/${noteId}/versions/${versionId}/restore`);
}
