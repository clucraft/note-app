import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getNoteVersions, getNoteVersion, restoreNoteVersion } from '../../api/notes.api';
import type { NoteVersionSummary, NoteVersion } from '../../types/note.types';
import styles from './VersionHistoryModal.module.css';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: number;
  currentTitle: string;
  currentContent: string;
  onRestore: () => void;
}

export function VersionHistoryModal({
  isOpen,
  onClose,
  noteId,
  currentTitle,
  currentContent,
  onRestore
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<NoteVersionSummary[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | 'current'>('current');
  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingVersion, setIsLoadingVersion] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load versions when modal opens
  useEffect(() => {
    if (isOpen && noteId) {
      setIsLoading(true);
      setError(null);
      setSelectedVersionId('current');
      setSelectedVersion(null);

      getNoteVersions(noteId)
        .then(setVersions)
        .catch((err) => {
          setError('Failed to load version history');
          console.error(err);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, noteId]);

  // Load selected version content
  useEffect(() => {
    if (selectedVersionId !== 'current' && noteId) {
      setIsLoadingVersion(true);
      getNoteVersion(noteId, selectedVersionId)
        .then(setSelectedVersion)
        .catch((err) => {
          setError('Failed to load version');
          console.error(err);
        })
        .finally(() => setIsLoadingVersion(false));
    } else {
      setSelectedVersion(null);
    }
  }, [selectedVersionId, noteId]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleRestore = useCallback(async () => {
    if (selectedVersionId === 'current' || isRestoring) return;

    setIsRestoring(true);
    setError(null);

    try {
      await restoreNoteVersion(noteId, selectedVersionId);
      onRestore();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to restore version');
    } finally {
      setIsRestoring(false);
    }
  }, [noteId, selectedVersionId, isRestoring, onRestore, onClose]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (isToday) {
      return `Today, ${timeStr}`;
    } else if (isYesterday) {
      return `Yesterday, ${timeStr}`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + `, ${timeStr}`;
    }
  };

  // Get the content to preview
  const previewContent = selectedVersionId === 'current' ? currentContent : selectedVersion?.content || '';
  const previewTitle = selectedVersionId === 'current' ? currentTitle : selectedVersion?.title || '';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className={styles.overlay} onClick={onClose}>
        <motion.div
          className={styles.modal}
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
        >
          <div className={styles.header}>
            <h2 className={styles.title}>Version History</h2>
            <button className={styles.closeButton} onClick={onClose} title="Close">
              &times;
            </button>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.content}>
            {/* Left panel - Version list */}
            <div className={styles.versionList}>
              {isLoading ? (
                <div className={styles.loading}>Loading versions...</div>
              ) : (
                <>
                  {/* Current version */}
                  <button
                    className={`${styles.versionItem} ${selectedVersionId === 'current' ? styles.selected : ''}`}
                    onClick={() => setSelectedVersionId('current')}
                  >
                    <span className={styles.versionIndicator}>
                      {selectedVersionId === 'current' ? '●' : '○'}
                    </span>
                    <div className={styles.versionInfo}>
                      <span className={styles.versionLabel}>Current</span>
                      <span className={styles.versionDate}>Just now</span>
                    </div>
                  </button>

                  {/* Past versions */}
                  {versions.length === 0 ? (
                    <div className={styles.emptyVersions}>
                      No previous versions yet. Versions are created automatically when you edit.
                    </div>
                  ) : (
                    versions.map((version) => (
                      <button
                        key={version.id}
                        className={`${styles.versionItem} ${selectedVersionId === version.id ? styles.selected : ''}`}
                        onClick={() => setSelectedVersionId(version.id)}
                      >
                        <span className={styles.versionIndicator}>
                          {selectedVersionId === version.id ? '●' : '○'}
                        </span>
                        <div className={styles.versionInfo}>
                          <span className={styles.versionLabel}>Version {version.versionNumber}</span>
                          <span className={styles.versionDate}>{formatDate(version.createdAt)}</span>
                        </div>
                      </button>
                    ))
                  )}
                </>
              )}
            </div>

            {/* Right panel - Preview */}
            <div className={styles.preview}>
              {isLoadingVersion ? (
                <div className={styles.loading}>Loading preview...</div>
              ) : (
                <>
                  <div className={styles.previewTitle}>{previewTitle}</div>
                  <div
                    className={styles.previewContent}
                    dangerouslySetInnerHTML={{ __html: previewContent }}
                  />
                </>
              )}
            </div>
          </div>

          <div className={styles.footer}>
            <button
              className={styles.restoreButton}
              onClick={handleRestore}
              disabled={selectedVersionId === 'current' || isRestoring}
            >
              {isRestoring ? 'Restoring...' : 'Restore Version'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
