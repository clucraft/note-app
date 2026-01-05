import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { THEMES, ThemeName } from '../../types/theme.types';
import styles from './ThemeSwitcher.module.css';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentTheme = THEMES.find(t => t.name === theme) || THEMES[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (themeName: ThemeName) => {
    setTheme(themeName);
    setIsOpen(false);
  };

  return (
    <div className={styles.container} ref={menuRef}>
      <button
        className={styles.button}
        onClick={() => setIsOpen(!isOpen)}
        title="Change theme"
      >
        <span className={styles.icon}>{currentTheme.icon}</span>
      </button>

      {isOpen && (
        <div className={styles.menu}>
          {THEMES.map((t) => (
            <button
              key={t.name}
              className={`${styles.menuItem} ${t.name === theme ? styles.active : ''}`}
              onClick={() => handleSelect(t.name)}
            >
              <span className={styles.menuIcon}>{t.icon}</span>
              <span className={styles.menuLabel}>{t.displayName}</span>
              {t.name === theme && <span className={styles.check}>&#10003;</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
