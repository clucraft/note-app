import { api } from './index';

export interface ShareInfo {
  isShared: boolean;
  shareToken?: string;
  hasPassword?: boolean;
  expiresAt?: string | null;
  viewCount?: number;
  createdAt?: string;
}

export interface CreateShareInput {
  password?: string;
  expiresIn?: '1h' | '1d' | '7d' | '30d' | 'never';
}

export interface CreateShareResponse {
  shareToken: string;
  hasPassword: boolean;
  expiresAt: string | null;
}

export interface SharedNote {
  title: string;
  titleEmoji: string | null;
  content: string;
}

export async function getShareInfo(noteId: number): Promise<ShareInfo> {
  const response = await api.get<ShareInfo>(`/share/${noteId}`);
  return response.data;
}

export async function createShare(noteId: number, input: CreateShareInput): Promise<CreateShareResponse> {
  const response = await api.post<CreateShareResponse>(`/share/${noteId}`, input);
  return response.data;
}

export async function deleteShare(noteId: number): Promise<void> {
  await api.delete(`/share/${noteId}`);
}

// Public endpoints (no auth required)
export async function checkShareAccess(token: string): Promise<{ requiresPassword: boolean }> {
  const response = await api.get<{ requiresPassword: boolean }>(`/share/public/${token}`);
  return response.data;
}

export async function getSharedNote(token: string, password?: string): Promise<SharedNote> {
  const response = await api.post<SharedNote>(`/share/public/${token}`, { password });
  return response.data;
}
