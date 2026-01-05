export type ThemeName = 'light' | 'dark' | 'dracula' | 'solarized' | 'nord';

export interface ThemeOption {
  name: ThemeName;
  displayName: string;
  icon: string;
}

export const THEMES: ThemeOption[] = [
  { name: 'light', displayName: 'Light', icon: '☀️' },
  { name: 'dark', displayName: 'Dark', icon: '🌙' },
  { name: 'dracula', displayName: 'Dracula', icon: '🧛' },
  { name: 'solarized', displayName: 'Solarized', icon: '🌅' },
  { name: 'nord', displayName: 'Nord', icon: '❄️' }
];
