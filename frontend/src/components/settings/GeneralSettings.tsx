import { useTheme } from '../../hooks/useTheme';
import type { ThemeName } from '../../types/theme.types';
import { ThemeCustomization } from './ThemeCustomization';
import styles from './GeneralSettings.module.css';

const THEMES: { id: ThemeName; name: string; preview: string }[] = [
  { id: 'light', name: 'Light', preview: '#ffffff' },
  { id: 'dark', name: 'Dark', preview: '#1e1e1e' },
  { id: 'dracula', name: 'Dracula', preview: '#282a36' },
  { id: 'solarized', name: 'Solarized', preview: '#002b36' },
  { id: 'nord', name: 'Nord', preview: '#2e3440' },
];

export function GeneralSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className={styles.container}>
      <h2 className={styles.sectionTitle}>General Settings</h2>

      <div className={styles.section}>
        <h3 className={styles.label}>Theme</h3>
        <p className={styles.description}>Choose your preferred color theme</p>
        <div className={styles.themeGrid}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`${styles.themeOption} ${theme === t.id ? styles.active : ''}`}
              onClick={() => setTheme(t.id)}
            >
              <div
                className={styles.themePreview}
                style={{ backgroundColor: t.preview }}
              />
              <span className={styles.themeName}>{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <ThemeCustomization />
    </div>
  );
}
