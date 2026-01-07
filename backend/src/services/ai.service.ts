export type AIProvider = 'openai' | 'anthropic' | 'openwebui';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  endpoint?: string | null;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  content: string;
  error?: string;
}

const DEFAULT_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
};

async function callOpenAI(
  settings: AISettings,
  messages: ChatMessage[]
): Promise<AIResponse> {
  const endpoint = settings.endpoint || DEFAULT_ENDPOINTS.openai;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Only add Authorization header if API key is provided (Ollama doesn't need it)
    if (settings.apiKey) {
      headers['Authorization'] = `Bearer ${settings.apiKey}`;
    }

    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: settings.model,
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { content: '', error: `OpenAI API error: ${response.status} - ${error}` };
    }

    const data = await response.json() as { choices: Array<{ message?: { content?: string } }> };
    return { content: data.choices[0]?.message?.content || '' };
  } catch (error: any) {
    return { content: '', error: `OpenAI request failed: ${error.message}` };
  }
}

async function callAnthropic(
  settings: AISettings,
  messages: ChatMessage[]
): Promise<AIResponse> {
  try {
    // Extract system message if present
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch(`${DEFAULT_ENDPOINTS.anthropic}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: 1024,
        system: systemMessage?.content,
        messages: userMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { content: '', error: `Anthropic API error: ${response.status} - ${error}` };
    }

    const data = await response.json() as { content: Array<{ text?: string }> };
    return { content: data.content[0]?.text || '' };
  } catch (error: any) {
    return { content: '', error: `Anthropic request failed: ${error.message}` };
  }
}

export async function callAI(
  settings: AISettings,
  messages: ChatMessage[]
): Promise<AIResponse> {
  switch (settings.provider) {
    case 'openai':
    case 'openwebui':
      return callOpenAI(settings, messages);
    case 'anthropic':
      return callAnthropic(settings, messages);
    default:
      return { content: '', error: `Unknown provider: ${settings.provider}` };
  }
}

export async function summarizeSearchResults(
  settings: AISettings,
  results: Array<{ title: string; preview: string }>
): Promise<AIResponse> {
  const resultsText = results
    .map((r, i) => `${i + 1}. "${r.title}": ${r.preview}`)
    .join('\n');

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are a helpful assistant that summarizes search results concisely. Provide a brief 2-3 sentence summary of what the search results contain.',
    },
    {
      role: 'user',
      content: `Summarize these search results from a note-taking app:\n\n${resultsText}`,
    },
  ];

  return callAI(settings, messages);
}

export async function expandText(
  settings: AISettings,
  text: string,
  context?: string
): Promise<AIResponse> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are a helpful writing assistant. Expand on the given text by adding more detail, examples, and explanation while maintaining the same tone and style. Return only the expanded text without any preamble or explanation.',
    },
    {
      role: 'user',
      content: context
        ? `Expand on the following text:\n\n"${text}"\n\nContext from the note:\n${context}`
        : `Expand on the following text:\n\n"${text}"`,
    },
  ];

  return callAI(settings, messages);
}

export async function testConnection(settings: AISettings): Promise<AIResponse> {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: 'Say "Connection successful!" and nothing else.',
    },
  ];

  return callAI(settings, messages);
}
