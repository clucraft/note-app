import { api } from './index';

export interface TwoFAStatus {
  enabled: boolean;
}

export interface TwoFASetup {
  secret: string;
  qrCode: string;
  otpauthUrl: string;
}

export async function getTwoFAStatus(): Promise<TwoFAStatus> {
  const response = await api.get<TwoFAStatus>('/2fa/status');
  return response.data;
}

export async function setupTwoFA(): Promise<TwoFASetup> {
  const response = await api.post<TwoFASetup>('/2fa/setup');
  return response.data;
}

export async function enableTwoFA(code: string): Promise<void> {
  await api.post('/2fa/enable', { code });
}

export async function disableTwoFA(code: string): Promise<void> {
  await api.post('/2fa/disable', { code });
}
