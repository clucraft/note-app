import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { useDebouncedCallback } from '../../hooks/useDebounce';
import { TiptapEditor } from '../editor/TiptapEditor';
import { EmojiButton } from '../common/EmojiPicker';
import { ShareModal } from './ShareModal';
import styles from './NoteEditor.module.css';

export function NoteEditor() {
  const { selectedNote, updateNote } = useNotes();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Sync local state with selected note
  useEffect(() => {
    if (selectedNote) {
      setTitle(selectedNote.title);
      setContent(selectedNote.content);
    } else {
      setTitle('');
      setContent('');
    }
  }, [selectedNote]);

  // Debounced save for content
  const debouncedSaveContent = useDebouncedCallback(
    async (id: number, newContent: string) => {
      await updateNote(id, { content: newContent });
    },
    1000
  );

  // Debounced save for title
  const debouncedSaveTitle = useDebouncedCallback(
    async (id: number, newTitle: string) => {
      await updateNote(id, { title: newTitle });
    },
    500
  );

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (selectedNote) {
      debouncedSaveTitle(selectedNote.id, newTitle);
    }
  }, [selectedNote, debouncedSaveTitle]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    if (selectedNote) {
      debouncedSaveContent(selectedNote.id, newContent);
    }
  }, [selectedNote, debouncedSaveContent]);

  const handleEmojiChange = useCallback(async (emoji: string | null) => {
    if (selectedNote) {
      await updateNote(selectedNote.id, { titleEmoji: emoji });
    }
  }, [selectedNote, updateNote]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate stats - strip HTML tags for accurate count
  const stats = useMemo(() => {
    const textContent = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
    const charCount = textContent.length;
    const wordCount = textContent.trim() ? textContent.trim().split(/\s+/).length : 0;
    return { charCount, wordCount };
  }, [content]);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleExportHTML = useCallback(() => {
    if (!selectedNote) return;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${selectedNote.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1, h2, h3, h4 { margin-top: 1.5rem; margin-bottom: 0.5rem; }
    h1 { font-size: 2rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
    h2 { font-size: 1.5rem; }
    h3 { font-size: 1.25rem; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 3px; font-family: monospace; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #ddd; margin: 1rem 0; padding-left: 1rem; color: #666; font-style: italic; }
    img { max-width: 100%; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background-color: #f5f5f5; }
    ul[data-type="taskList"] { list-style: none; padding-left: 0; }
    ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
    ul[data-type="taskList"] input { margin-top: 0.25rem; }
    hr { border: none; border-top: 2px solid #eee; margin: 1.5rem 0; }
  </style>
</head>
<body>
  <h1>${selectedNote.titleEmoji || ''} ${selectedNote.title}</h1>
  ${content}
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedNote.title.replace(/[^a-z0-9]/gi, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [selectedNote, content]);

  const handleExportPDF = useCallback(() => {
    if (!selectedNote) return;
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>${selectedNote.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1, h2, h3, h4 { margin-top: 1.5rem; margin-bottom: 0.5rem; }
    h1 { font-size: 2rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 3px; font-family: monospace; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #ddd; margin: 1rem 0; padding-left: 1rem; color: #666; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
  </style>
</head>
<body>
  <h1>${selectedNote.titleEmoji || ''} ${selectedNote.title}</h1>
  ${content}
</body>
</html>`;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    setShowExportMenu(false);
  }, [selectedNote, content]);

  if (!selectedNote) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyContent}>
          <span className={styles.emptyIcon}>📝</span>
          <h2>Select a note</h2>
          <p>Choose a note from the sidebar or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.editor}>
      <div className={styles.header}>
        <EmojiButton
          emoji={selectedNote.titleEmoji}
          onSelect={handleEmojiChange}
        />
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          className={styles.titleInput}
          placeholder="Untitled"
        />

        <div className={styles.exportContainer} ref={exportMenuRef}>
          <button
            className={styles.exportButton}
            onClick={() => setShowExportMenu(!showExportMenu)}
            title="Export note"
          >
            Export ▾
          </button>
          {showExportMenu && (
            <div className={styles.exportMenu}>
              <button className={styles.exportMenuItem} onClick={handleExportHTML}>
                Export as HTML
              </button>
              <button className={styles.exportMenuItem} onClick={handleExportPDF}>
                Export as PDF
              </button>
            </div>
          )}
        </div>

        <button
          className={styles.shareButton}
          onClick={() => setShowShareModal(true)}
          title="Share note"
        >
          Share
        </button>
      </div>

      <div className={styles.content}>
        <TiptapEditor
          content={content}
          onChange={handleContentChange}
        />
      </div>

      <div className={styles.statusBar}>
        <span className={styles.statusItem}>
          {stats.charCount.toLocaleString()} characters
        </span>
        <span className={styles.statusDivider}>|</span>
        <span className={styles.statusItem}>
          {stats.wordCount.toLocaleString()} words
        </span>
        <span className={styles.statusDivider}>|</span>
        <span className={styles.statusItem}>
          Created: {formatDate(selectedNote.createdAt)}
        </span>
      </div>

      {showShareModal && (
        <ShareModal
          noteId={selectedNote.id}
          noteTitle={selectedNote.title}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
