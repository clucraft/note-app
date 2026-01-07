import { useState, useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { updateCustomColors } from '../../api/auth.api';
import type { CustomColors } from '../../types/auth.types';
import styles from './ThemeCustomization.module.css';

interface ColorConfig {
  key: keyof CustomColors;
  label: string;
  cssVar: string;
}

const COLOR_CONFIGS: ColorConfig[] = [
  { key: 'editorBg', label: 'Editor Background', cssVar: '--editor-bg' },
  { key: 'textPrimary', label: 'Text Color', cssVar: '--text-primary' },
  { key: 'colorPrimary', label: 'Accent Color', cssVar: '--color-primary' },
  { key: 'bgSurface', label: 'Code Block Background', cssVar: '--bg-surface' }
];

function getComputedColor(cssVar: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || '#000000';
}

export function ThemeCustomization() {
  const { customColors, setCustomColors } = useTheme();
  const { refreshUser } = useAuth();
  const [localColors, setLocalColors] = useState<CustomColors>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize local colors from customColors
  useEffect(() => {
    const initial: CustomColors = {};
    COLOR_CONFIGS.forEach(({ key }) => {
      initial[key] = customColors?.[key] || null;
    });
    setLocalColors(initial);
  }, [customColors]);

  const getDisplayColor = (key: keyof CustomColors, cssVar: string): string => {
    return localColors[key] || getComputedColor(cssVar);
  };

  const handleColorChange = async (key: keyof CustomColors, value: string) => {
    const newColors = { ...localColors, [key]: value };
    setLocalColors(newColors);
    setCustomColors(newColors);

    setIsSaving(true);
    try {
      await updateCustomColors(newColors);
      refreshUser();
    } catch (error) {
      console.error('Failed to save custom color:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async (key: keyof CustomColors) => {
    const newColors = { ...localColors, [key]: null };
    setLocalColors(newColors);
    setCustomColors(newColors);

    setIsSaving(true);
    try {
      await updateCustomColors(newColors);
      refreshUser();
    } catch (error) {
      console.error('Failed to reset color:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetAll = async () => {
    setLocalColors({});
    setCustomColors(null);

    setIsSaving(true);
    try {
      await updateCustomColors(null);
      refreshUser();
    } catch (error) {
      console.error('Failed to reset all colors:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const hasAnyCustomColor = Object.values(localColors).some(v => v != null);

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Customize Editor Colors</h3>
      <p className={styles.description}>
        Override your theme with custom editor colors
      </p>

      <div className={styles.colorList}>
        {COLOR_CONFIGS.map(({ key, label, cssVar }) => (
          <div key={key} className={styles.colorRow}>
            <span className={styles.colorLabel}>{label}</span>
            <div className={styles.colorInputWrapper}>
              <div
                className={styles.colorSwatch}
                style={{ backgroundColor: getDisplayColor(key, cssVar) }}
              />
              <input
                type="color"
                className={styles.colorInput}
                value={getDisplayColor(key, cssVar)}
                onChange={(e) => handleColorChange(key, e.target.value)}
              />
              <input
                type="text"
                className={styles.hexInput}
                value={getDisplayColor(key, cssVar)}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                    handleColorChange(key, val);
                  }
                }}
                placeholder="#000000"
              />
              <button
                className={styles.resetButton}
                onClick={() => handleReset(key)}
                disabled={!localColors[key] || isSaving}
              >
                Reset
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <button
          className={styles.resetAllButton}
          onClick={handleResetAll}
          disabled={!hasAnyCustomColor || isSaving}
        >
          Reset All to Theme Defaults
        </button>
        {isSaving && (
          <span className={styles.saving}>Saving...</span>
        )}
      </div>
    </div>
  );
}
