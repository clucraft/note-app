import { api, setAccessToken } from './index';
import type { User, AuthResponse, LoginCredentials, RegisterCredentials } from '../types/auth.types';

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/login', credentials);
  setAccessToken(response.data.accessToken);
  return response.data;
}

export async function register(credentials: RegisterCredentials): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/register', credentials);
  setAccessToken(response.data.accessToken);
  return response.data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
  setAccessToken(null);
}

export async function getMe(): Promise<User> {
  const response = await api.get<User>('/auth/me');
  return response.data;
}

export async function refreshToken(): Promise<string> {
  const response = await api.post<{ accessToken: string }>('/auth/refresh');
  setAccessToken(response.data.accessToken);
  return response.data.accessToken;
}

export async function updateTheme(theme: string): Promise<void> {
  await api.put('/auth/theme', { theme });
}

export interface UpdatePreferencesInput {
  language?: string;
  timezone?: string;
}

export async function updatePreferences(preferences: UpdatePreferencesInput): Promise<{ language: string; timezone: string }> {
  const response = await api.put<{ language: string; timezone: string }>('/auth/preferences', preferences);
  return response.data;
}

export interface UpdateProfileInput {
  displayName?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
  profilePicture?: string | null;
}

export async function updateProfile(profile: UpdateProfileInput): Promise<User> {
  const response = await api.put<User>('/auth/profile', profile);
  return response.data;
}

export interface CustomColorsInput {
  editorBg?: string | null;
  textPrimary?: string | null;
  colorPrimary?: string | null;
  bgSurface?: string | null;
}

export async function updateCustomColors(colors: CustomColorsInput | null): Promise<{ customColors: CustomColorsInput | null }> {
  const response = await api.put<{ customColors: CustomColorsInput | null }>('/auth/custom-colors', colors);
  return response.data;
}
