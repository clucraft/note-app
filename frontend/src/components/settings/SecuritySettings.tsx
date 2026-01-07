import { useState, useEffect } from 'react';
import { listUserShares, deleteShare, type UserShare } from '../../api/share.api';
import styles from './SecuritySettings.module.css';

export function SecuritySettings() {
  const [shares, setShares] = useState<UserShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    loadShares();
  }, []);

  const loadShares = async () => {
    try {
      const data = await listUserShares();
      setShares(data);
    } catch (error) {
      console.error('Failed to load shares:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopSharing = async (share: UserShare) => {
    setDeletingId(share.id);
    try {
      await deleteShare(share.noteId);
      setShares(shares.filter(s => s.id !== share.id));
    } catch (error) {
      console.error('Failed to stop sharing:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.sectionTitle}>Security Settings</h2>

      <div className={styles.section}>
        <h3 className={styles.label}>Shared Notes</h3>
        <p className={styles.description}>
          Manage your publicly shared notes. Stop sharing to revoke access.
        </p>

        {isLoading ? (
          <div className={styles.loading}>Loading shared notes...</div>
        ) : shares.length === 0 ? (
          <div className={styles.empty}>
            You don't have any shared notes.
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Note</th>
                  <th>Shared On</th>
                  <th>Views</th>
                  <th>Protection</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shares.map((share) => (
                  <tr key={share.id}>
                    <td className={styles.noteCell}>
                      {share.noteTitleEmoji && (
                        <span className={styles.emoji}>{share.noteTitleEmoji}</span>
                      )}
                      <span className={styles.noteTitle}>{share.noteTitle}</span>
                    </td>
                    <td>{formatDate(share.createdAt)}</td>
                    <td>{share.viewCount}</td>
                    <td>
                      {share.hasPassword ? (
                        <span className={styles.badge}>Password</span>
                      ) : (
                        <span className={styles.badgeNone}>Public</span>
                      )}
                    </td>
                    <td>
                      <button
                        className={styles.stopButton}
                        onClick={() => handleStopSharing(share)}
                        disabled={deletingId === share.id}
                      >
                        {deletingId === share.id ? 'Stopping...' : 'Stop Sharing'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
