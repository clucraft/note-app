import { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { ThemeName } from '../types/theme.types';
import { updateTheme as apiUpdateTheme } from '../api/auth.api';

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: ThemeName;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (initialTheme) return initialTheme;

    const saved = localStorage.getItem('theme') as ThemeName;
    if (saved) return saved;

    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const setTheme = useCallback((newTheme: ThemeName) => {
    setThemeState(newTheme);
    // Try to update on server, but don't block on it
    apiUpdateTheme(newTheme).catch(() => {
      // Ignore errors - theme is saved locally anyway
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
