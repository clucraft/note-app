import { useState, useCallback, useEffect } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { useDebouncedCallback } from '../../hooks/useDebounce';
import { MonacoWrapper } from '../editor/MonacoWrapper';
import { MarkdownPreview } from './MarkdownPreview';
import { EmojiButton } from '../common/EmojiPicker';
import { ShareModal } from './ShareModal';
import styles from './NoteEditor.module.css';

type ViewMode = 'edit' | 'split' | 'preview';

export function NoteEditor() {
  const { selectedNote, updateNote } = useNotes();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [showShareModal, setShowShareModal] = useState(false);

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
