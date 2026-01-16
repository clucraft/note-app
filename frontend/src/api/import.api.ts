import { api } from './index';

export interface ImportOptions {
  parentId?: number | null;
  preserveStructure?: boolean;
}

export interface ImportResult {
  success: boolean;
  imported: {
    notes: number;
    attachments: number;
  };
  errors: Array<{ file: string; error: string }>;
  rootNoteIds: number[];
}

export async function importDocmost(
  files: File[],
  options: ImportOptions = {},
  onProgress?: (progress: number) => void
): Promise<ImportResult> {
  const formData = new FormData();

  // Add files
  for (const file of files) {
    formData.append('files', file);
  }

  // Add options
  if (options.parentId !== undefined) {
    formData.append('parentId', options.parentId === null ? '' : String(options.parentId));
  }
  formData.append('preserveStructure', String(options.preserveStructure ?? true));

  const response = await api.post<ImportResult>('/import/docmost', formData, {
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    }
  });

  return response.data;
}
