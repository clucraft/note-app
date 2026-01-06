import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { useDebouncedCallback } from '../../hooks/useDebounce';
import { MonacoWrapper } from '../editor/MonacoWrapper';
import { MarkdownPreview } from './MarkdownPreview';
import { EmojiButton } from '../common/EmojiPicker';
import { ShareModal } from './ShareModal';
import { marked } from 'marked';
import styles from './NoteEditor.module.css';

type ViewMode = 'edit' | 'split' | 'preview';

export function NoteEditor() {
  const { selectedNote, updateNote } = useNotes();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
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

  // Calculate stats
  const stats = useMemo(() => {
    const charCount = content.length;
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
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
    h1 { border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 3px; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 1rem; color: #666; }
    img { max-width: 100%; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
  </style>
</head>
<body>
  <h1>${selectedNote.titleEmoji || ''} ${selectedNote.title}</h1>
  ${marked.parse(content)}
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
    h1 { border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 3px; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 1rem; color: #666; }
  </style>
</head>
<body>
  <h1>${selectedNote.titleEmoji || ''} ${selectedNote.title}</h1>
  ${marked.parse(content)}
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
        <div className={styles.viewModeToggle}>
          <button
            className={`${styles.viewModeBtn} ${viewMode === 'edit' ? styles.active : ''}`}
            onClick={() => setViewMode('edit')}
            title="Edit only"
          >
            Edit
          </button>
          <button
            className={`${styles.viewModeBtn} ${viewMode === 'split' ? styles.active : ''}`}
            onClick={() => setViewMode('split')}
            title="Split view"
          >
            Split
          </button>
          <button
            className={`${styles.viewModeBtn} ${viewMode === 'preview' ? styles.active : ''}`}
            onClick={() => setViewMode('preview')}
            title="Preview only"
          >
            Preview
          </button>
        </div>

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

      <div className={`${styles.content} ${styles[viewMode]}`}>
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={styles.editorPane}>
            <MonacoWrapper
              value={content}
              onChange={handleContentChange}
            />
          </div>
        )}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={styles.previewPane}>
            <MarkdownPreview content={content} />
          </div>
        )}
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
