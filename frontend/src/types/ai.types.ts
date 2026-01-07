export type AIProvider = 'openai' | 'anthropic' | 'openwebui';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  endpoint?: string | null;
  hasApiKey?: boolean;
}

export interface AISettingsInput {
  provider: AIProvider;
  apiKey: string;
  model: string;
  endpoint?: string | null;
}

export const AI_MODELS: Record<AIProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-20240307'],
  openwebui: [], // User provides custom model name
};

export const AI_PROVIDER_NAMES: Record<AIProvider, string> = {
  openai: 'OpenAI (ChatGPT)',
  anthropic: 'Anthropic (Claude)',
  openwebui: 'OpenWebUI (Custom)',
};
