import { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import styles from './FindReplace.module.css';

interface FindReplaceProps {
  editor: Editor;
  isOpen: boolean;
  onClose: () => void;
}

export function FindReplace({ editor, isOpen, onClose }: FindReplaceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const results = editor.storage.findReplace?.results || [];
  const currentIndex = editor.storage.findReplace?.currentIndex || 0;

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  // Update search when term changes
  useEffect(() => {
    editor.commands.setSearchTerm(searchTerm);
  }, [editor, searchTerm]);

  // Update case sensitivity
  useEffect(() => {
    editor.commands.setCaseSensitive(caseSensitive);
  }, [editor, caseSensitive]);

  // Clear search when closing
  useEffect(() => {
    if (!isOpen) {
      editor.commands.clearSearch();
      setSearchTerm('');
      setReplaceTerm('');
    }
  }, [editor, isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          editor.commands.findPrevious();
        } else {
          editor.commands.findNext();
        }
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) {
          editor.commands.findPrevious();
        } else {
          editor.commands.findNext();
        }
      }
    },
    [editor, onClose]
  );

  const handleReplace = () => {
    editor.commands.setReplaceTerm(replaceTerm);
    editor.commands.replaceCurrent();
  };

  const handleReplaceAll = () => {
    editor.commands.setReplaceTerm(replaceTerm);
    editor.commands.replaceAll();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.container} onKeyDown={handleKeyDown}>
      <div className={styles.searchRow}>
        <input
          ref={searchInputRef}
          type="text"
          className={styles.input}
          placeholder="Find..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span className={styles.resultCount}>
          {results.length > 0 ? `${currentIndex + 1}/${results.length}` : '0/0'}
        </span>
        <button
          className={styles.button}
          onClick={() => editor.commands.findPrevious()}
          disabled={results.length === 0}
          title="Previous (Shift+Enter)"
        >
          ▲
        </button>
        <button
          className={styles.button}
          onClick={() => editor.commands.findNext()}
          disabled={results.length === 0}
          title="Next (Enter)"
        >
          ▼
        </button>
        <button
          className={`${styles.button} ${caseSensitive ? styles.active : ''}`}
          onClick={() => setCaseSensitive(!caseSensitive)}
          title="Match case"
        >
          Aa
        </button>
        <button
          className={`${styles.button} ${showReplace ? styles.active : ''}`}
          onClick={() => setShowReplace(!showReplace)}
          title="Toggle replace"
        >
          ↔
        </button>
        <button className={styles.closeButton} onClick={onClose} title="Close (Esc)">
          ×
        </button>
      </div>

      {showReplace && (
        <div className={styles.replaceRow}>
          <input
            type="text"
            className={styles.input}
            placeholder="Replace with..."
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
          />
          <button
            className={styles.button}
            onClick={handleReplace}
            disabled={results.length === 0}
            title="Replace current"
          >
            Replace
          </button>
          <button
            className={styles.button}
            onClick={handleReplaceAll}
            disabled={results.length === 0}
            title="Replace all"
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}
