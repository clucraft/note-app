import { api } from './index';

export interface SystemSettings {
  registration_enabled: string;
}

/**
 * Get registration status (public - no auth required)
 */
export async function getRegistrationStatus(): Promise<{ registrationEnabled: boolean }> {
  const response = await api.get<{ registrationEnabled: boolean }>('/settings/registration-status');
  return response.data;
}

/**
 * Get all system settings (admin only)
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  const response = await api.get<SystemSettings>('/settings');
  return response.data;
}

/**
 * Update a system setting (admin only)
 */
export async function updateSystemSetting(key: string, value: string): Promise<void> {
  await api.put('/settings', { key, value });
}
