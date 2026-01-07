import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDeletedNotes,
  restoreNotes,
  permanentlyDeleteNotes,
  emptyTrash,
  getAutoDeleteDays,
  updateAutoDeleteDays,
  type DeletedNote
} from '../../api/notes.api';
import { Button } from '../common/Button';
import styles from './DeletedNotes.module.css';

export function DeletedNotes() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<DeletedNote[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [autoDeleteDays, setAutoDeleteDays] = useState(30);
  const [daysInput, setDaysInput] = useState('30');
  const [isSavingDays, setIsSavingDays] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [notesData, settingsData] = await Promise.all([
        getDeletedNotes(),
        getAutoDeleteDays()
      ]);
      setNotes(notesData);
      setAutoDeleteDays(settingsData.autoDeleteDays);
      setDaysInput(String(settingsData.autoDeleteDays));
    } catch (err) {
      setError('Failed to load deleted notes');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === notes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notes.map(n => n.id)));
    }
  };

  const handleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleRestore = async () => {
    if (selectedIds.size === 0) return;

    setIsRestoring(true);
    try {
      await restoreNotes(Array.from(selectedIds));
      setNotes(notes.filter(n => !selectedIds.has(n.id)));
      setSelectedIds(new Set());
    } catch (err) {
      setError('Failed to restore notes');
      console.error(err);
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.size} note(s)? This cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await permanentlyDeleteNotes(Array.from(selectedIds));
      setNotes(notes.filter(n => !selectedIds.has(n.id)));
      setSelectedIds(new Set());
    } catch (err) {
      setError('Failed to delete notes');
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (notes.length === 0) return;

    if (!confirm('Are you sure you want to permanently delete all notes in trash? This cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await emptyTrash();
      setNotes([]);
      setSelectedIds(new Set());
    } catch (err) {
      setError('Failed to empty trash');
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveDays = async () => {
    const days = parseInt(daysInput, 10);
    if (isNaN(days) || days < 1 || days > 365) {
      setError('Please enter a number between 1 and 365');
      return;
    }

    setIsSavingDays(true);
    try {
      const result = await updateAutoDeleteDays(days);
      setAutoDeleteDays(result.autoDeleteDays);
      // Reload notes in case some were deleted due to new threshold
      const notesData = await getDeletedNotes();
      setNotes(notesData);
      setSelectedIds(new Set());
    } catch (err) {
      setError('Failed to update setting');
      console.error(err);
    } finally {
      setIsSavingDays(false);
    }
  };

  const formatDate = (dateString: string) => {
    // SQLite stores dates in UTC without timezone indicator
    // Append 'Z' if no timezone info to ensure correct parsing as UTC
    const isoDateStr = dateString.includes('T') ? dateString : dateString.replace(' ', 'T') + 'Z';
    return new Date(isoDateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate('/')}>
          &larr; Back to Notes
        </button>
        <h1 className={styles.title}>Deleted Notes</h1>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => setError('')}>&times;</button>
        </div>
      )}

      <div className={styles.settingsSection}>
        <label className={styles.settingsLabel}>
          Permanently delete notes after this many days:
        </label>
        <div className={styles.settingsRow}>
          <input
            type="number"
            className={styles.daysInput}
            value={daysInput}
            onChange={(e) => setDaysInput(e.target.value)}
            min="1"
            max="365"
          />
          <Button
            onClick={handleSaveDays}
            disabled={isSavingDays || daysInput === String(autoDeleteDays)}
            size="sm"
          >
            {isSavingDays ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className={styles.actions}>
        <Button
          onClick={handleRestore}
          disabled={selectedIds.size === 0 || isRestoring}
        >
          {isRestoring ? 'Restoring...' : `Restore${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
        </Button>
        <Button
          variant="danger"
          onClick={handlePermanentDelete}
          disabled={selectedIds.size === 0 || isDeleting}
        >
          {isDeleting ? 'Deleting...' : 'Delete Permanently'}
        </Button>
        <Button
          variant="secondary"
          onClick={handleEmptyTrash}
          disabled={notes.length === 0 || isDeleting}
        >
          Empty Trash
        </Button>
      </div>

      {notes.length === 0 ? (
        <div className={styles.empty}>
          <p>Trash is empty</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkboxCell}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === notes.length && notes.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Note</th>
                <th>Created</th>
                <th>Deleted</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id} className={selectedIds.has(note.id) ? styles.selected : ''}>
                  <td className={styles.checkboxCell}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(note.id)}
                      onChange={() => handleSelect(note.id)}
                    />
                  </td>
                  <td className={styles.noteCell}>
                    {note.titleEmoji && (
                      <span className={styles.emoji}>{note.titleEmoji}</span>
                    )}
                    <span className={styles.noteTitle}>{note.title}</span>
                  </td>
                  <td>{formatDate(note.createdAt)}</td>
                  <td>{formatDate(note.deletedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
