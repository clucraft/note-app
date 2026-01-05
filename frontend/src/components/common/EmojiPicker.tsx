import { useRef, useEffect, useState } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useTheme } from '../../hooks/useTheme';
import styles from './EmojiPicker.module.css';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position?: { top: number; left: number };
}

export function EmojiPicker({ onSelect, onClose, position }: EmojiPickerProps) {
  const { theme } = useTheme();
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleEmojiSelect = (emoji: { native: string }) => {
    onSelect(emoji.native);
    onClose();
  };

  const pickerTheme = theme === 'light' ? 'light' : 'dark';

  return (
    <div
      ref={pickerRef}
      className={styles.picker}
      style={position ? { top: position.top, left: position.left } : undefined}
    >
      <Picker
        data={data}
        onEmojiSelect={handleEmojiSelect}
        theme={pickerTheme}
        previewPosition="none"
        skinTonePosition="none"
      />
    </div>
  );
}

interface EmojiButtonProps {
  emoji: string | null;
  onSelect: (emoji: string | null) => void;
}

export function EmojiButton({ emoji, onSelect }: EmojiButtonProps) {
  const [showPicker, setShowPicker] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });

  const handleClick = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPickerPosition({
        top: rect.bottom + 8,
        left: rect.left
      });
    }
    setShowPicker(true);
  };

  const handleSelect = (selectedEmoji: string) => {
    onSelect(selectedEmoji);
    setShowPicker(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.emojiButton}
        onClick={handleClick}
        title="Select emoji"
      >
        {emoji || '📝'}
        {emoji && (
          <span className={styles.clearButton} onClick={handleClear}>
            &times;
          </span>
        )}
      </button>

      {showPicker && (
        <EmojiPicker
          onSelect={handleSelect}
          onClose={() => setShowPicker(false)}
          position={pickerPosition}
        />
      )}
    </>
  );
}
