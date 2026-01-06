import { api } from './index';

export interface UploadResponse {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
}

export async function uploadImage(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await api.post<UploadResponse>('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

export async function uploadImageFromBlob(blob: Blob, filename?: string): Promise<UploadResponse> {
  const file = new File([blob], filename || 'pasted-image.png', { type: blob.type });
  return uploadImage(file);
}
