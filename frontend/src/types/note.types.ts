export type EditorWidth = 'centered' | 'full';

export interface Note {
  id: number;
  parentId: number | null;
  title: string;
  titleEmoji: string | null;
  content: string;
  sortOrder: number;
  isExpanded: boolean;
  editorWidth: EditorWidth;
  createdAt?: string;
  updatedAt?: string;
  children: Note[];
}

export interface CreateNoteInput {
  parentId?: number | null;
  title?: string;
  titleEmoji?: string | null;
  content?: string;
}

export interface UpdateNoteInput {
  title?: string;
  titleEmoji?: string | null;
  content?: string;
  editorWidth?: EditorWidth;
}
