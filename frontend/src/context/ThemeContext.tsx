import { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { ThemeName } from '../types/theme.types';
import type { CustomColors } from '../types/auth.types';
import { updateTheme as apiUpdateTheme } from '../api/auth.api';

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  customColors: CustomColors | null;
  setCustomColors: (colors: CustomColors | null) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: ThemeName;
  initialCustomColors?: CustomColors | null;
}

// Map of camelCase keys to CSS variable names
const colorVarMap: Record<keyof CustomColors, string> = {
  editorBg: '--editor-bg',
  textPrimary: '--text-primary',
  colorPrimary: '--color-primary',
  bgSurface: '--bg-surface'
};

export function ThemeProvider({ children, initialTheme, initialCustomColors }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (initialTheme) return initialTheme;

    const saved = localStorage.getItem('theme') as ThemeName;
    if (saved) return saved;

    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const [customColors, setCustomColorsState] = useState<CustomColors | null>(initialCustomColors || null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Apply custom colors as CSS variables
  useEffect(() => {
    const root = document.documentElement;

    // Clear all custom color properties first
    Object.values(colorVarMap).forEach(varName => {
      root.style.removeProperty(varName);
    });

    // Apply custom colors if set
    if (customColors) {
      (Object.keys(colorVarMap) as Array<keyof CustomColors>).forEach(key => {
        const value = customColors[key];
        if (value) {
          root.style.setProperty(colorVarMap[key], value);
        }
      });
    }
  }, [customColors]);

  const setTheme = useCallback((newTheme: ThemeName) => {
    setThemeState(newTheme);
    // Try to update on server, but don't block on it
    apiUpdateTheme(newTheme).catch(() => {
      // Ignore errors - theme is saved locally anyway
    });
  }, []);

  const setCustomColors = useCallback((colors: CustomColors | null) => {
    setCustomColorsState(colors);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, customColors, setCustomColors }}>
      {children}
    </ThemeContext.Provider>
  );
}
