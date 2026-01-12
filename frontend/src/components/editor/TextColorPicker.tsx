import { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import styles from './TextColorPicker.module.css';

interface TextColorPickerProps {
  editor: Editor;
}

interface ColorOption {
  name: string;
  textColor: string;
  highlightColor: string;
}

const colors: ColorOption[] = [
  { name: 'Default', textColor: '', highlightColor: '' },
  { name: 'Blue', textColor: '#1e40af', highlightColor: '#dbeafe' },
  { name: 'Green', textColor: '#166534', highlightColor: '#dcfce7' },
  { name: 'Purple', textColor: '#7c3aed', highlightColor: '#ede9fe' },
  { name: 'Red', textColor: '#dc2626', highlightColor: '#fee2e2' },
  { name: 'Yellow', textColor: '#a16207', highlightColor: '#fef9c3' },
  { name: 'Orange', textColor: '#c2410c', highlightColor: '#ffedd5' },
  { name: 'Pink', textColor: '#be185d', highlightColor: '#fce7f3' },
  { name: 'Gray', textColor: '#4b5563', highlightColor: '#e5e7eb' },
  { name: 'Brown', textColor: '#78350f', highlightColor: '#fef3c7' },
];

export function TextColorPicker({ editor }: TextColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleTextColor = (color: string) => {
    if (color === '') {
      editor.chain().focus().unsetColor().run();
    } else {
      editor.chain().focus().setColor(color).run();
    }
  };

  const handleHighlightColor = (color: string) => {
    if (color === '') {
      editor.chain().focus().unsetHighlight().run();
    } else {
      editor.chain().focus().setHighlight({ color }).run();
    }
  };

  const handleRemoveColors = () => {
    editor.chain().focus().unsetColor().unsetHighlight().run();
    setIsOpen(false);
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleColorClick = (e: React.MouseEvent, handler: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    handler();
  };

  return (
    <div ref={containerRef} className={styles.container}>
      <button
        onMouseDown={handleTriggerClick}
        className={styles.triggerButton}
        title="Text color"
      >
        A
      </button>

      {isOpen && (
        <div className={styles.dropdown} onMouseDown={(e) => e.stopPropagation()}>
          {/* Text Color Section */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Text color</div>
            <div className={styles.colorGrid}>
              {colors.map((color) => (
                <button
                  key={`text-${color.name}`}
                  className={styles.colorButton}
                  style={{
                    color: color.textColor || 'var(--text-primary)',
                  }}
                  onMouseDown={(e) => handleColorClick(e, () => handleTextColor(color.textColor))}
                  title={color.name}
                >
                  A
                </button>
              ))}
            </div>
          </div>

          {/* Highlight Color Section */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Highlight</div>
            <div className={styles.colorGrid}>
              {colors.map((color) => (
                <button
                  key={`highlight-${color.name}`}
                  className={styles.colorButton}
                  style={{
                    backgroundColor: color.highlightColor || 'transparent',
                    color: color.highlightColor ? 'var(--text-primary)' : 'var(--text-primary)',
                  }}
                  onMouseDown={(e) => handleColorClick(e, () => handleHighlightColor(color.highlightColor))}
                  title={color.name}
                >
                  A
                </button>
              ))}
            </div>
          </div>

          {/* Remove Colors */}
          <div className={styles.divider} />
          <button
            className={styles.removeButton}
            onMouseDown={(e) => handleColorClick(e, handleRemoveColors)}
          >
            <span className={styles.removeIcon}>✕</span>
            Remove colors
          </button>
        </div>
      )}
    </div>
  );
}
