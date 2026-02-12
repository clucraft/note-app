const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

interface ApiClientOptions {
  apiKey: string;
}

interface NoteTreeNode {
  id: number;
  parentId: number | null;
  title: string;
  titleEmoji: string | null;
  content: string;
  sortOrder: number;
  isExpanded: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  children: NoteTreeNode[];
}

interface Note {
  id: number;
  parentId: number | null;
  title: string;
  titleEmoji: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface SearchResult {
  id: number;
  title: string;
  preview: string;
  score: number;
}

interface Task {
  id: number;
  taskId: string;
  noteId: number | null;
  description: string;
  dueDate: string;
  dueTime: string;
  completed: boolean;
}

export class ApiClient {
  private apiKey: string;

  constructor(options: ApiClientOptions) {
    this.apiKey = options.apiKey;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${BACKEND_URL}/api${path}`;
    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`API error ${response.status}: ${(error as any).error || response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async listNotes(): Promise<NoteTreeNode[]> {
    return this.request<NoteTreeNode[]>('GET', '/notes');
  }

  async getNote(id: number): Promise<Note> {
    return this.request<Note>('GET', `/notes/${id}`);
  }

  async searchNotes(query: string): Promise<SearchResult[]> {
    return this.request<SearchResult[]>('GET', `/notes/search?q=${encodeURIComponent(query)}`);
  }

  async createNote(data: { title: string; content?: string; parentId?: number | null }): Promise<Note> {
    return this.request<Note>('POST', '/notes', data);
  }

  async updateNote(id: number, data: { title?: string; content?: string }): Promise<Note> {
    return this.request<Note>('PUT', `/notes/${id}`, data);
  }

  async createTask(data: { noteId?: number | null; description: string; dueDate: string; dueTime: string }): Promise<Task> {
    return this.request<Task>('POST', '/tasks', {
      noteId: data.noteId ?? null,
      description: data.description,
      dueDate: data.dueDate,
      dueTime: data.dueTime,
    });
  }
}
