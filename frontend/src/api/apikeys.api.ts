import { api } from './index';

export interface ApiKeyInfo {
  id: number;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ApiKeyCreateResponse {
  id: number;
  name: string;
  key: string;
  keyPrefix: string;
}

export async function getApiKeys(): Promise<ApiKeyInfo[]> {
  const response = await api.get<ApiKeyInfo[]>('/api-keys');
  return response.data;
}

export async function createApiKey(name: string): Promise<ApiKeyCreateResponse> {
  const response = await api.post<ApiKeyCreateResponse>('/api-keys', { name });
  return response.data;
}

export async function deleteApiKey(id: number): Promise<void> {
  await api.delete(`/api-keys/${id}`);
}
