import { useState, useEffect } from 'react';
import { getShareInfo, createShare, deleteShare, ShareInfo } from '../../api/share.api';
import styles from './ShareModal.module.css';

interface ShareModalProps {
  noteId: number;
  noteTitle: string;
  onClose: () => void;
}

export function ShareModal({ noteId, noteTitle, onClose }: ShareModalProps) {
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [expiresIn, setExpiresIn] = useState<'1h' | '1d' | '7d' | '30d' | 'never'>('never');
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadShareInfo();
  }, [noteId]);

  const loadShareInfo = async () => {
    try {
      const info = await getShareInfo(noteId);
      setShareInfo(info);
    } catch (error) {
      console.error('Failed to load share info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateShare = async () => {
    setIsSaving(true);
    try {
      const result = await createShare(noteId, {
        password: password || undefined,
        expiresIn
      });
      setShareInfo({
        isShared: true,
        shareToken: result.shareToken,
        hasPassword: result.hasPassword,
        expiresAt: result.expiresAt
      });
      setPassword('');
    } catch (error) {
      console.error('Failed to create share:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteShare = async () => {
    if (!confirm('Are you sure you want to stop sharing this note?')) return;

    setIsSaving(true);
    try {
      await deleteShare(noteId);
      setShareInfo({ isShared: false });
    } catch (error) {
      console.error('Failed to delete share:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getShareUrl = () => {
    if (!shareInfo?.shareToken) return '';
    return `${window.location.origin}/shared/${shareInfo.shareToken}`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatExpiration = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return 'Never';
    const date = new Date(expiresAt);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Share Note</h2>
          <button className={styles.closeButton} onClick={onClose}>&times;</button>
        </div>

        <div className={styles.noteTitle}>
          {noteTitle}
        </div>

        {isLoading ? (
          <div className={styles.loading}>Loading...</div>
        ) : shareInfo?.isShared ? (
          <div className={styles.content}>
            <div className={styles.shareActive}>
              <span className={styles.shareIcon}>🔗</span>
              <span>This note is being shared</span>
            </div>

            <div className={styles.linkContainer}>
              <input
                type="text"
                readOnly
                value={getShareUrl()}
                className={styles.linkInput}
              />
              <button className={styles.copyButton} onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className={styles.shareDetails}>
              <div className={styles.detailRow}>
                <span>Password protected:</span>
                <span>{shareInfo.hasPassword ? 'Yes' : 'No'}</span>
              </div>
              <div className={styles.detailRow}>
                <span>Expires:</span>
                <span>{formatExpiration(shareInfo.expiresAt)}</span>
              </div>
              {shareInfo.viewCount !== undefined && (
                <div className={styles.detailRow}>
                  <span>Views:</span>
                  <span>{shareInfo.viewCount}</span>
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <button
                className={styles.updateButton}
                onClick={() => setShareInfo({ isShared: false })}
              >
                Update Settings
              </button>
              <button
                className={styles.deleteButton}
                onClick={handleDeleteShare}
                disabled={isSaving}
              >
                Stop Sharing
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.content}>
            <div className={styles.formGroup}>
              <label>Password (optional)</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Leave empty for no password"
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Expires</label>
              <select
                value={expiresIn}
                onChange={e => setExpiresIn(e.target.value as any)}
                className={styles.select}
              >
                <option value="1h">1 hour</option>
                <option value="1d">1 day</option>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="never">Never</option>
              </select>
            </div>

            <div className={styles.actions}>
              <button className={styles.cancelButton} onClick={onClose}>
                Cancel
              </button>
              <button
                className={styles.shareButton}
                onClick={handleCreateShare}
                disabled={isSaving}
              >
                {isSaving ? 'Creating...' : 'Create Share Link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
