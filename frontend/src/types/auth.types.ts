export interface CustomColors {
  editorBg?: string | null;
  textPrimary?: string | null;
  colorPrimary?: string | null;
  bgSurface?: string | null;
}

export interface User {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  themePreference?: string;
  language?: string;
  timezone?: string;
  profilePicture?: string | null;
  customColors?: CustomColors | null;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface TwoFactorResponse {
  requiresTwoFactor: true;
  message: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  totpCode?: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}
