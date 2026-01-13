import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Store selection before opening dropdown
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    // Use mousedown to catch clicks before they bubble
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Restore selection and apply color
  const applyColor = useCallback((type: 'text' | 'highlight', color: string) => {
    // Restore the selection first
    if (savedSelectionRef.current) {
      const { from, to } = savedSelectionRef.current;
      editor.chain().setTextSelection({ from, to }).run();
    }

    if (type === 'text') {
      if (color === '') {
        editor.chain().focus().unsetColor().run();
      } else {
        editor.chain().focus().setColor(color).run();
      }
    } else {
      if (color === '') {
        editor.chain().focus().unsetHighlight().run();
      } else {
        editor.chain().focus().setHighlight({ color }).run();
      }
    }
  }, [editor]);

  const handleRemoveColors = useCallback(() => {
    if (savedSelectionRef.current) {
      const { from, to } = savedSelectionRef.current;
      editor.chain().setTextSelection({ from, to }).run();
    }
    editor.chain().focus().unsetColor().unsetHighlight().run();
    setIsOpen(false);
  }, [editor]);

  // Toggle dropdown
  const toggleDropdown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isOpen) {
      // Save current selection before doing anything
      const { from, to } = editor.state.selection;
      savedSelectionRef.current = { from, to };

      // Calculate dropdown position based on button
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom + 8,
          left: rect.left + rect.width / 2,
        });
      }
    }

    setIsOpen(prev => !prev);
  }, [editor, isOpen]);

  // Handle color button click
  const onColorSelect = useCallback((e: React.MouseEvent, type: 'text' | 'highlight', color: string) => {
    e.preventDefault();
    e.stopPropagation();
    applyColor(type, color);
  }, [applyColor]);

  return (
    <div className={styles.container}>
      <button
        ref={buttonRef}
        type="button"
        onMouseDown={toggleDropdown}
        className={styles.triggerButton}
        title="Text color"
      >
        A
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className={styles.dropdown}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            transform: 'translateX(-50%)',
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {/* Text Color Section */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Text color</div>
            <div className={styles.colorGrid}>
              {colors.map((color) => (
                <button
                  type="button"
                  key={`text-${color.name}`}
                  className={styles.colorButton}
                  style={{
                    color: color.textColor || 'var(--text-primary)',
                  }}
                  onMouseDown={(e) => onColorSelect(e, 'text', color.textColor)}
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
                  type="button"
                  key={`highlight-${color.name}`}
                  className={styles.colorButton}
                  style={{
                    backgroundColor: color.highlightColor || 'transparent',
                  }}
                  onMouseDown={(e) => onColorSelect(e, 'highlight', color.highlightColor)}
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
            type="button"
            className={styles.removeButton}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleRemoveColors();
            }}
          >
            <span className={styles.removeIcon}>✕</span>
            Remove colors
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
