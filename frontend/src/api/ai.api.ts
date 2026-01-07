import { api } from './index';
import type { AISettings, AISettingsInput } from '../types/ai.types';

export async function getAISettings(): Promise<AISettings | null> {
  const response = await api.get<AISettings | null>('/ai/settings');
  return response.data;
}

export async function updateAISettings(settings: AISettingsInput): Promise<AISettings> {
  const response = await api.put<AISettings>('/ai/settings', settings);
  return response.data;
}

export async function testAIConnection(): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ success: boolean; message: string }>('/ai/test');
  return response.data;
}

export async function summarizeSearchResults(
  results: Array<{ title: string; preview: string }>
): Promise<string> {
  const response = await api.post<{ summary: string }>('/ai/summarize', { results });
  return response.data.summary;
}

export async function expandText(text: string, context?: string): Promise<string> {
  const response = await api.post<{ expanded: string }>('/ai/expand', { text, context });
  return response.data.expanded;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function aiChat(
  message: string,
  history: ChatMessage[] = []
): Promise<string> {
  const response = await api.post<{ response: string }>('/ai/chat', { message, history });
  return response.data.response;
}
