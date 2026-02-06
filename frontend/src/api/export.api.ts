import { api } from './index';

export async function exportNotes(format: 'markdown' | 'html'): Promise<void> {
  const response = await api.get('/export/notes', {
    params: { format },
    responseType: 'blob',
  });

  // Trigger browser download
  const blob = new Blob([response.data], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const timestamp = new Date().toISOString().slice(0, 10);
  a.download = `Cache_Notes_Export_${timestamp}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
