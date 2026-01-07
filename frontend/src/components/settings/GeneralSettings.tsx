import { useState, useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { updatePreferences } from '../../api/auth.api';
import type { ThemeName } from '../../types/theme.types';
import { ThemeCustomization } from './ThemeCustomization';
import styles from './GeneralSettings.module.css';

const LANGUAGES = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'zh-CN', name: '中文 (简体)' },
  { code: 'hi-IN', name: 'हिन्दी' },
  { code: 'es-ES', name: 'Español' },
  { code: 'ar-SA', name: 'العربية' },
];

const THEMES: { id: ThemeName; name: string; preview: string }[] = [
  { id: 'light', name: 'Light', preview: '#ffffff' },
  { id: 'dark', name: 'Dark', preview: '#1e1e1e' },
  { id: 'dracula', name: 'Dracula', preview: '#282a36' },
  { id: 'solarized', name: 'Solarized', preview: '#002b36' },
  { id: 'nord', name: 'Nord', preview: '#2e3440' },
];

// Common timezones list (Intl.supportedValuesOf may not be available in all environments)
const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Vancouver', 'America/Mexico_City', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid',
  'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Stockholm', 'Europe/Moscow',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Seoul',
  'Asia/Mumbai', 'Asia/Dubai', 'Asia/Bangkok', 'Asia/Jakarta',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth',
  'Pacific/Auckland', 'Pacific/Honolulu',
  'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos',
];

export function GeneralSettings() {
  const { theme, setTheme } = useTheme();
  const { user, refreshUser } = useAuth();
  const [language, setLanguage] = useState(user?.language || 'en-US');
  const [timezone, setTimezone] = useState(user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [timezones, setTimezones] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Use common timezones list
    // Add user's current timezone if not in list
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const zones = COMMON_TIMEZONES.includes(userTz)
      ? COMMON_TIMEZONES
      : [userTz, ...COMMON_TIMEZONES];
    setTimezones(zones);
  }, []);

  useEffect(() => {
    if (user) {
      setLanguage(user.language || 'en-US');
      setTimezone(user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [user]);

  const handleLanguageChange = async (newLanguage: string) => {
    setLanguage(newLanguage);
    setIsSaving(true);
    try {
      await updatePreferences({ language: newLanguage });
      refreshUser();
    } catch (error) {
      console.error('Failed to update language:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTimezoneChange = async (newTimezone: string) => {
    setTimezone(newTimezone);
    setIsSaving(true);
    try {
      await updatePreferences({ timezone: newTimezone });
      refreshUser();
    } catch (error) {
      console.error('Failed to update timezone:', error);
    } finally {
      setIsSaving(false);
    }
  };

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

      <div className={styles.section}>
        <h3 className={styles.label}>Language</h3>
        <p className={styles.description}>Select your preferred language</p>
        <select
          className={styles.select}
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          disabled={isSaving}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.section}>
        <h3 className={styles.label}>Timezone</h3>
        <p className={styles.description}>
          Your detected timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </p>
        <select
          className={styles.select}
          value={timezone}
          onChange={(e) => handleTimezoneChange(e.target.value)}
          disabled={isSaving}
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <ThemeCustomization />
    </div>
  );
}
