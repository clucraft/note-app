import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { checkShareAccess, getSharedNote, SharedNote } from '../../api/share.api';
import { MarkdownPreview } from './MarkdownPreview';
import styles from './SharedNotePage.module.css';

export function SharedNotePage() {
  const { token } = useParams<{ token: string }>();
  const [note, setNote] = useState<SharedNote | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      checkAccess();
    }
  }, [token]);

  const checkAccess = async () => {
    if (!token) return;

    try {
      const result = await checkShareAccess(token);
      if (result.requiresPassword) {
        setRequiresPassword(true);
        setIsLoading(false);
      } else {
        await loadNote();
      }
    } catch (err: any) {
      if (err.response?.status === 410) {
        setError('This shared link has expired');
      } else if (err.response?.status === 404) {
        setError('Shared note not found');
      } else {
        setError('Failed to load shared note');
      }
      setIsLoading(false);
    }
  };

  const loadNote = async (pwd?: string) => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getSharedNote(token, pwd);
      setNote(result);
      setRequiresPassword(false);
    } catch (err: any) {
      if (err.response?.status === 401) {
        if (err.response?.data?.requiresPassword) {
          setRequiresPassword(true);
          if (pwd) {
            setError('Invalid password');
          }
        }
      } else if (err.response?.status === 410) {
        setError('This shared link has expired');
      } else if (err.response?.status === 404) {
        setError('Shared note not found');
      } else {
        setError('Failed to load shared note');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadNote(password);
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          <h2>{error}</h2>
          <p>The note you're looking for is not available.</p>
        </div>
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <div className={styles.container}>
        <div className={styles.passwordForm}>
          <span className={styles.lockIcon}>🔒</span>
          <h2>This note is password protected</h2>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              className={styles.passwordInput}
              autoFocus
            />
            <button type="submit" className={styles.submitButton}>
              View Note
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!note) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.note}>
        <div className={styles.header}>
          {note.titleEmoji && <span className={styles.emoji}>{note.titleEmoji}</span>}
          <h1 className={styles.title}>{note.title}</h1>
        </div>
        <div className={styles.content}>
          <MarkdownPreview content={note.content} />
        </div>
        <div className={styles.footer}>
          <span>Shared via Notes App</span>
        </div>
      </div>
    </div>
  );
}
