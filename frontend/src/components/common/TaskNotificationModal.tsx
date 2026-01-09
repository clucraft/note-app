import { useCallback } from 'react';
import { Modal } from './Modal';
import { completeTask, snoozeTask, type Task } from '../../api/tasks.api';
import styles from './TaskNotificationModal.module.css';

interface TaskNotificationModalProps {
  task: Task | null;
  onClose: () => void;
  onTaskUpdated?: () => void;
}

export function TaskNotificationModal({ task, onClose, onTaskUpdated }: TaskNotificationModalProps) {
  const handleComplete = useCallback(async () => {
    if (!task) return;

    try {
      await completeTask(task.taskId, true);
      onTaskUpdated?.();
      onClose();
    } catch (error) {
      console.error('Failed to complete task:', error);
      alert('Failed to complete task. Please try again.');
    }
  }, [task, onClose, onTaskUpdated]);

  const handleSnooze = useCallback(async (duration: '5min' | '1hr' | '1day') => {
    if (!task) return;

    try {
      await snoozeTask(task.taskId, duration);
      onTaskUpdated?.();
      onClose();
    } catch (error) {
      console.error('Failed to snooze task:', error);
      alert('Failed to snooze task. Please try again.');
    }
  }, [task, onClose, onTaskUpdated]);

  const formatDateTime = (date: string, time: string) => {
    const d = new Date(`${date}T${time}`);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (!task) return null;

  return (
    <Modal isOpen={!!task} onClose={onClose} title="Task Due" size="sm">
      <div className={styles.content}>
        <div className={styles.taskInfo}>
          <div className={styles.bellIcon}>🔔</div>
          <div className={styles.description}>{task.description}</div>
          <div className={styles.dueTime}>
            Due: {formatDateTime(task.dueDate, task.dueTime)}
          </div>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.completeButton}
            onClick={handleComplete}
          >
            ✓ Complete
          </button>
        </div>

        <div className={styles.snoozeSection}>
          <div className={styles.snoozeLabel}>Snooze for:</div>
          <div className={styles.snoozeButtons}>
            <button
              className={styles.snoozeButton}
              onClick={() => handleSnooze('5min')}
            >
              5 min
            </button>
            <button
              className={styles.snoozeButton}
              onClick={() => handleSnooze('1hr')}
            >
              1 hour
            </button>
            <button
              className={styles.snoozeButton}
              onClick={() => handleSnooze('1day')}
            >
              1 day
            </button>
          </div>
        </div>

        <button className={styles.dismissButton} onClick={onClose}>
          Dismiss
        </button>
      </div>
    </Modal>
  );
}
