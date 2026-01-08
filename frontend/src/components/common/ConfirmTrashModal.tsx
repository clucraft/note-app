import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { getAutoDeleteDays } from '../../api/notes.api';
import styles from './ConfirmTrashModal.module.css';

interface ConfirmTrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmTrashModal({ isOpen, onClose, onConfirm }: ConfirmTrashModalProps) {
  const [autoDeleteDays, setAutoDeleteDays] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      getAutoDeleteDays()
        .then(result => setAutoDeleteDays(result.autoDeleteDays))
        .catch(() => setAutoDeleteDays(30)); // fallback
    }
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const formatDays = (days: number) => {
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className={styles.container}>
        <div className={styles.icon}>🗑️</div>
        <h3 className={styles.title}>Move to trash?</h3>
        <p className={styles.message}>
          {autoDeleteDays !== null
            ? `Pages in trash will be permanently deleted after ${formatDays(autoDeleteDays)}.`
            : 'Loading...'}
        </p>
        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.confirmButton} onClick={handleConfirm}>
            Move to trash
          </button>
        </div>
      </div>
    </Modal>
  );
}
