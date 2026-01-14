import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { listUsers } from '../../api/users.api';
import {
  getNoteShares,
  shareNoteWithUser,
  updateSharePermission,
  removeNoteShare,
  type NoteShare,
  type SharePermission
} from '../../api/notes.api';
import type { User } from '../../types/auth.types';
import styles from './UserSharingModal.module.css';

interface UserSharingModalProps {
  isOpen: boolean;
  noteId: number;
  noteTitle: string;
  onClose: () => void;
}

export function UserSharingModal({ isOpen, noteId, noteTitle, onClose }: UserSharingModalProps) {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [shares, setShares] = useState<NoteShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Load users and shares when modal opens
  useEffect(() => {
    if (isOpen && noteId) {
      setIsLoading(true);
      setError(null);

      // Get current user ID from localStorage token
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setCurrentUserId(payload.userId);
        } catch (e) {
          console.error('Failed to parse token:', e);
        }
      }

      Promise.all([listUsers(), getNoteShares(noteId)])
        .then(([users, noteShares]) => {
          setAllUsers(users);
          setShares(noteShares);
        })
        .catch((err) => {
          setError('Failed to load data');
          console.error(err);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, noteId]);

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

  // Get available users (not shared with, not current user)
  const availableUsers = allUsers.filter(
    (user) =>
      user.id !== currentUserId &&
      !shares.some((share) => share.userId === user.id)
  );

  const handleAddUser = useCallback(async (userId: number) => {
    setIsSaving(true);
    setError(null);
    try {
      const newShare = await shareNoteWithUser(noteId, userId, 'view');
      setShares((prev) => [...prev, newShare]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to share note');
    } finally {
      setIsSaving(false);
    }
  }, [noteId]);

  const handleRemoveUser = useCallback(async (userId: number) => {
    setIsSaving(true);
    setError(null);
    try {
      await removeNoteShare(noteId, userId);
      setShares((prev) => prev.filter((share) => share.userId !== userId));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove share');
    } finally {
      setIsSaving(false);
    }
  }, [noteId]);

  const handlePermissionChange = useCallback(async (userId: number, permission: SharePermission) => {
    setError(null);
    try {
      await updateSharePermission(noteId, userId, permission);
      setShares((prev) =>
        prev.map((share) =>
          share.userId === userId ? { ...share, permission } : share
        )
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update permission');
    }
  }, [noteId]);

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
            <h2 className={styles.title}>Share with Users</h2>
            <button className={styles.closeButton} onClick={onClose} title="Close">
              &times;
            </button>
          </div>

          <div className={styles.noteTitle}>{noteTitle}</div>

          {error && <div className={styles.error}>{error}</div>}

          {isLoading ? (
            <div className={styles.loading}>Loading...</div>
          ) : (
            <div className={styles.content}>
              <div className={styles.columns}>
                {/* Available Users */}
                <div className={styles.column}>
                  <div className={styles.columnHeader}>Available Users</div>
                  <div className={styles.userList}>
                    {availableUsers.length === 0 ? (
                      <div className={styles.emptyList}>No users available</div>
                    ) : (
                      availableUsers.map((user) => (
                        <div key={user.id} className={styles.userItem}>
                          <div className={styles.userInfo}>
                            <span className={styles.userName}>
                              {user.displayName || user.username}
                            </span>
                            <span className={styles.userEmail}>{user.email}</span>
                          </div>
                          <button
                            className={styles.addButton}
                            onClick={() => handleAddUser(user.id)}
                            disabled={isSaving}
                            title="Add user"
                          >
                            &gt;
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Shared With */}
                <div className={styles.column}>
                  <div className={styles.columnHeader}>Shared With</div>
                  <div className={styles.userList}>
                    {shares.length === 0 ? (
                      <div className={styles.emptyList}>Not shared with anyone</div>
                    ) : (
                      shares.map((share) => (
                        <div key={share.userId} className={styles.userItem}>
                          <button
                            className={styles.removeButton}
                            onClick={() => handleRemoveUser(share.userId)}
                            disabled={isSaving}
                            title="Remove user"
                          >
                            &lt;
                          </button>
                          <div className={styles.userInfo}>
                            <span className={styles.userName}>
                              {share.displayName || share.username}
                            </span>
                            <span className={styles.userEmail}>{share.email}</span>
                          </div>
                          <select
                            className={styles.permissionSelect}
                            value={share.permission}
                            onChange={(e) =>
                              handlePermissionChange(share.userId, e.target.value as SharePermission)
                            }
                          >
                            <option value="view">View</option>
                            <option value="edit">Edit</option>
                          </select>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={styles.footer}>
            <button className={styles.doneButton} onClick={onClose}>
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
