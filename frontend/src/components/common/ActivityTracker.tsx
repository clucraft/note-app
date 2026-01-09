import { useState, useEffect, useCallback } from 'react';
import { getTodayActivity, type TodayActivity } from '../../api/activity.api';
import { ActivityPopup } from './ActivityPopup';
import styles from './ActivityTracker.module.css';

interface ActivityTrackerProps {
  onRefreshNeeded?: () => void;
}

export function ActivityTracker({ onRefreshNeeded }: ActivityTrackerProps) {
  const [activity, setActivity] = useState<TodayActivity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);

  const fetchActivity = useCallback(async () => {
    try {
      const data = await getTodayActivity();
      setActivity(data);
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
    // Refresh every minute
    const interval = setInterval(fetchActivity, 60000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  // Expose refresh function
  useEffect(() => {
    if (onRefreshNeeded) {
      // This allows parent to trigger refresh
    }
  }, [onRefreshNeeded]);

  if (isLoading || !activity) {
    return (
      <div className={styles.container}>
        <span className={styles.label}>Today:</span>
        <div className={styles.blocks}>
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className={styles.block} />
          ))}
        </div>
      </div>
    );
  }

  // Find max activity to normalize heights
  const maxChars = Math.max(...activity.hourly.map(h => h.charCount), 1);
  const currentHour = new Date().getHours();

  // Get activity level (0-4) for each hour
  const getLevel = (charCount: number): number => {
    if (charCount === 0) return 0;
    const ratio = charCount / maxChars;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  };

  return (
    <>
      <button
        className={styles.container}
        onClick={() => setShowPopup(true)}
        title={`Today: ${activity.totals.wordCount.toLocaleString()} words - Click for details`}
      >
        <span className={styles.label}>Today:</span>
        <div className={styles.blocks}>
          {activity.hourly.map((hour, i) => (
            <div
              key={i}
              className={`${styles.block} ${styles[`level${getLevel(hour.charCount)}`]} ${i === currentHour ? styles.current : ''} ${i > currentHour ? styles.future : ''}`}
              title={`${i}:00 - ${hour.wordCount} words`}
            />
          ))}
        </div>
        <span className={styles.count}>{activity.totals.wordCount.toLocaleString()}</span>
      </button>
      {showPopup && <ActivityPopup onClose={() => setShowPopup(false)} />}
    </>
  );
}

// Export a function to trigger activity recording
export { recordActivity } from '../../api/activity.api';
