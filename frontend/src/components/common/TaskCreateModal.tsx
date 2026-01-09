import { useState, useCallback } from 'react';
import { Modal } from './Modal';
import styles from './TaskCreateModal.module.css';

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { description: string; dueDate: string; dueTime: string }) => void;
}

export function TaskCreateModal({ isOpen, onClose, onConfirm }: TaskCreateModalProps) {
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    // Use local date components (not toISOString which is UTC)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [dueTime, setDueTime] = useState(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    return now.toTimeString().slice(0, 5);
  });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    onConfirm({
      description: description.trim(),
      dueDate,
      dueTime
    });

    // Reset form
    setDescription('');
    onClose();
  }, [description, dueDate, dueTime, onConfirm, onClose]);

  const handleClose = useCallback(() => {
    setDescription('');
    onClose();
  }, [onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Task" size="sm">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="task-description" className={styles.label}>
            Description
          </label>
          <input
            id="task-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What needs to be done?"
            className={styles.input}
            autoFocus
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="task-date" className={styles.label}>
              Date
            </label>
            <input
              id="task-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="task-time" className={styles.label}>
              Time
            </label>
            <input
              id="task-time"
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={handleClose} className={styles.cancelButton}>
            Cancel
          </button>
          <button type="submit" className={styles.submitButton} disabled={!description.trim()}>
            Create Task
          </button>
        </div>
      </form>
    </Modal>
  );
}
