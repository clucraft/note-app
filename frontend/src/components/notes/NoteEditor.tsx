import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { useDebouncedCallback } from '../../hooks/useDebounce';
import { TiptapEditor } from '../editor/TiptapEditor';
import { ShareModal } from './ShareModal';
import { ActivityTracker } from '../common/ActivityTracker';
import { recordActivity } from '../../api/activity.api';
import type { Note, EditorWidth } from '../../types/note.types';
import styles from './NoteEditor.module.css';

// Extract title from HTML content (first H1 text)
function extractTitleFromContent(html: string): string {
  const match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (match) {
    // Strip any HTML tags from inside the H1
    return match[1].replace(/<[^>]*>/g, '').trim() || 'Untitled';
  }
  return 'Untitled';
}

export function NoteEditor() {
  const { selectedNote, updateNote, deleteNote, notes, selectNote } = useNotes();
  const [content, setContent] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [activityKey, setActivityKey] = useState(0);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const prevStatsRef = useRef({ charCount: 0, wordCount: 0 });
  const pendingActivityRef = useRef({ charCount: 0, wordCount: 0 });

  // Get editor width from note, default to 'centered'
  const editorWidth: EditorWidth = selectedNote?.editorWidth || 'centered';

  // Compute initial content directly from selectedNote (not via state/effect)
  // This ensures TiptapEditor gets correct content immediately on remount
  const initialContent = useMemo(() => {
    if (!selectedNote) return '';
    if (!selectedNote.content || selectedNote.content === '<p></p>' || selectedNote.content === '') {
      return '<h1>Untitled</h1><p></p>';
    }
    return selectedNote.content;
  }, [selectedNote]);

  const handleWidthChange = useCallback(async (width: EditorWidth) => {
    if (selectedNote) {
      await updateNote(selectedNote.id, { editorWidth: width });
    }
  }, [selectedNote, updateNote]);

  // Sync local content state and reset activity tracking when note changes
  useEffect(() => {
    if (selectedNote) {
      setContent(initialContent);

      // Reset activity tracking baseline for new note
      const textContent = initialContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
      prevStatsRef.current = {
        charCount: textContent.length,
        wordCount: textContent.trim() ? textContent.trim().split(/\s+/).length : 0,
      };
    } else {
      setContent('');
      prevStatsRef.current = { charCount: 0, wordCount: 0 };
    }
  }, [selectedNote, initialContent]);

  // Get display title from content
  const displayTitle = useMemo(() => {
    return extractTitleFromContent(content);
  }, [content]);

  // Update browser tab title
  useEffect(() => {
    if (displayTitle) {
      document.title = `${displayTitle} - Cache`;
    } else {
      document.title = 'Cache';
    }
    return () => {
      document.title = 'Cache';
    };
  }, [displayTitle]);

  // Debounced save for content (also extracts and saves title)
  const debouncedSaveContent = useDebouncedCallback(
    async (id: number, newContent: string) => {
      const newTitle = extractTitleFromContent(newContent);
      await updateNote(id, { content: newContent, title: newTitle });
    },
    1000
  );

  // Debounced activity recording (every 5 seconds)
  const debouncedRecordActivity = useDebouncedCallback(
    async () => {
      const { charCount, wordCount } = pendingActivityRef.current;
      if (charCount > 0 || wordCount > 0) {
        try {
          await recordActivity(charCount, wordCount);
          // Reset pending counts after successful send
          pendingActivityRef.current = { charCount: 0, wordCount: 0 };
          // Force re-render of activity tracker
          setActivityKey(k => k + 1);
        } catch (err) {
          console.error('Failed to record activity:', err);
        }
      }
    },
    5000
  );

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    if (selectedNote) {
      debouncedSaveContent(selectedNote.id, newContent);

      // Calculate activity delta
      const textContent = newContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
      const newCharCount = textContent.length;
      const newWordCount = textContent.trim() ? textContent.trim().split(/\s+/).length : 0;

      const charDelta = Math.max(0, newCharCount - prevStatsRef.current.charCount);
      const wordDelta = Math.max(0, newWordCount - prevStatsRef.current.wordCount);

      prevStatsRef.current = { charCount: newCharCount, wordCount: newWordCount };

      if (charDelta > 0 || wordDelta > 0) {
        // Accumulate deltas
        pendingActivityRef.current.charCount += charDelta;
        pendingActivityRef.current.wordCount += wordDelta;
        debouncedRecordActivity();
      }
    }
  }, [selectedNote, debouncedSaveContent, debouncedRecordActivity]);

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false);
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
    // SQLite stores dates in UTC without timezone indicator
    // Append 'Z' if no timezone info to ensure correct parsing as UTC
    const isoDateStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
    const date = new Date(isoDateStr);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Build breadcrumb path from root to current note
  const breadcrumbPath = useMemo(() => {
    if (!selectedNote) return [];

    const findPath = (nodes: Note[], targetId: number, path: Note[] = []): Note[] | null => {
      for (const node of nodes) {
        if (node.id === targetId) {
          return [...path, node];
        }
        if (node.children && node.children.length > 0) {
          const found = findPath(node.children, targetId, [...path, node]);
          if (found) return found;
        }
      }
      return null;
    };

    return findPath(notes, selectedNote.id) || [selectedNote];
  }, [notes, selectedNote]);

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
    setShowActionsMenu(false);
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
    setShowActionsMenu(false);
  }, [selectedNote, content]);

  const handleCopyLink = useCallback(async () => {
    if (!selectedNote) return;
    const url = `${window.location.origin}/?note=${selectedNote.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setShowActionsMenu(false);
  }, [selectedNote]);

  const handleMoveToTrash = useCallback(async () => {
    if (!selectedNote) return;
    if (confirm('Move this note to trash?')) {
      await deleteNote(selectedNote.id);
    }
    setShowActionsMenu(false);
  }, [selectedNote, deleteNote]);

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
      <div className={styles.toolbar}>
        <div className={styles.breadcrumb}>
          {breadcrumbPath.map((note, index) => (
            <span key={note.id}>
              {index > 0 && <span className={styles.breadcrumbSeparator}>/</span>}
              {index === breadcrumbPath.length - 1 ? (
                <span className={styles.breadcrumbCurrent}>
                  <span className={styles.breadcrumbEmoji}>{note.titleEmoji || '📄'}</span>
                  {displayTitle}
                </span>
              ) : (
                <button
                  className={styles.breadcrumbLink}
                  onClick={() => selectNote(note.id)}
                >
                  <span className={styles.breadcrumbEmoji}>{note.titleEmoji || '📄'}</span>
                  {note.title}
                </button>
              )}
            </span>
          ))}
        </div>

        <div className={styles.actionsContainer} ref={actionsMenuRef}>
          <button
            className={styles.actionsButton}
            onClick={() => setShowActionsMenu(!showActionsMenu)}
            title="Actions"
          >
            <span className={styles.actionsIcon}>⋯</span>
          </button>
          {showActionsMenu && (
            <div className={styles.actionsMenu}>
              <button className={styles.actionItem} onClick={handleExportHTML}>
                <span className={styles.actionIcon}>📄</span>
                Export as HTML
              </button>
              <button className={styles.actionItem} onClick={handleExportPDF}>
                <span className={styles.actionIcon}>📑</span>
                Export as PDF
              </button>
              <div className={styles.actionDivider} />
              <button className={styles.actionItem} onClick={() => { setShowShareModal(true); setShowActionsMenu(false); }}>
                <span className={styles.actionIcon}>🔗</span>
                Share
              </button>
              <button className={styles.actionItem} onClick={handleCopyLink}>
                <span className={styles.actionIcon}>📋</span>
                Copy Link
              </button>
              <div className={styles.actionDivider} />
              <button
                className={styles.actionItem}
                onClick={() => handleWidthChange(editorWidth === 'full' ? 'centered' : 'full')}
              >
                <span className={styles.actionIcon}>↔</span>
                Full Width
                <span className={styles.actionToggle}>
                  <span className={`${styles.toggle} ${editorWidth === 'full' ? styles.toggleOn : ''}`} />
                </span>
              </button>
              <div className={styles.actionDivider} />
              <button className={`${styles.actionItem} ${styles.actionDanger}`} onClick={handleMoveToTrash}>
                <span className={styles.actionIcon}>🗑️</span>
                Move to Trash
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={`${styles.content} ${styles[editorWidth]}`}>
        <TiptapEditor
          key={selectedNote.id}
          content={initialContent}
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
        <span className={styles.statusDivider}>|</span>
        <ActivityTracker key={activityKey} />
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
