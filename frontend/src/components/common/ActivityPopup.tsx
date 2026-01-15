import { useState, useEffect, useMemo } from 'react';
import {
  getTodayActivity,
  getActivityHistory,
  getStreak,
  type TodayActivity,
  type DailyActivity,
  type StreakInfo
} from '../../api/activity.api';
import styles from './ActivityPopup.module.css';

// Motivational messages organized by streak tiers
const STREAK_MESSAGES = {
  starting: [ // 1-3 days
    'Keep it going!',
    'Great start!',
    'Building momentum!',
    'Off to strong!',
    'Nice beginning!',
    'First steps count!',
    "You've got this!",
    'Keep showing up!',
    'Day one done!',
    'Foundation laid!',
  ],
  growing: [ // 4-7 days
    "You're on fire!",
    'Crushing it!',
    'In the zone!',
    'Words are flowing!',
    'Making it happen!',
    'Habit forming!',
    'On a roll!',
    'Writing strong!',
    'Pure dedication!',
    'Great momentum!',
  ],
  solid: [ // 8-14 days
    'Unstoppable!',
    'Writing machine!',
    'True commitment!',
    'Consistency wins!',
    'Level up!',
    'Prolific writer!',
    'Discipline unlocked!',
    'Achievement unlocked!',
    'Remarkable consistency!',
    'Born to write!',
  ],
  impressive: [ // 15-30 days
    'Legend status!',
    'Incredible focus!',
    "Writer's groove!",
    'Streak champion!',
    'Outstanding effort!',
    'Simply amazing!',
    'Future bestseller!',
    'Dream in progress!',
    'Creative fire!',
    'Absolutely brilliant!',
  ],
  epic: [ // 31+ days
    'Unbreakable!',
    'Legendary writer!',
    'Master of words!',
    'Writing royalty!',
    'Hall of fame!',
    'Elite status!',
    'World class!',
    'Peak performance!',
    'True dedication!',
    'Inspirational!',
  ],
};

function getStreakMessage(streak: number): string {
  let messages: string[];

  if (streak <= 3) {
    messages = STREAK_MESSAGES.starting;
  } else if (streak <= 7) {
    messages = STREAK_MESSAGES.growing;
  } else if (streak <= 14) {
    messages = STREAK_MESSAGES.solid;
  } else if (streak <= 30) {
    messages = STREAK_MESSAGES.impressive;
  } else {
    messages = STREAK_MESSAGES.epic;
  }

  // Use streak as seed for consistent message per streak count
  const index = streak % messages.length;
  return messages[index];
}

interface ActivityPopupProps {
  onClose: () => void;
}

export function ActivityPopup({ onClose }: ActivityPopupProps) {
  const [todayData, setTodayData] = useState<TodayActivity | null>(null);
  const [weekData, setWeekData] = useState<DailyActivity[]>([]);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [today, history, streakData] = await Promise.all([
          getTodayActivity(),
          getActivityHistory(7),
          getStreak()
        ]);
        setTodayData(today);
        setWeekData(history);
        setStreak(streakData);
      } catch (error) {
        console.error('Failed to fetch activity data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Build last 7 days array with proper dates
  const getLast7Days = () => {
    const days: { date: string; label: string; wordCount: number; charCount: number }[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');

      const dayData = weekData.find(w => w.date === dateStr);
      days.push({
        date: dateStr,
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        wordCount: dayData?.wordCount || 0,
        charCount: dayData?.charCount || 0,
      });
    }
    return days;
  };

  const weekDays = getLast7Days();
  const maxWords = Math.max(...weekDays.map(d => d.wordCount), 1);
  const weekTotal = weekDays.reduce((sum, d) => sum + d.wordCount, 0);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (isLoading) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.popup} onClick={e => e.stopPropagation()}>
          <div className={styles.loading}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.popup} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Writing Activity</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Today's Stats */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Today</div>
          <div className={styles.todayStats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>
                {todayData?.totals.wordCount.toLocaleString() || 0}
              </span>
              <span className={styles.statLabel}>words</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statValue}>
                {todayData?.totals.charCount.toLocaleString() || 0}
              </span>
              <span className={styles.statLabel}>characters</span>
            </div>
          </div>
        </div>

        {/* Weekly Chart */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>This Week</span>
            <span className={styles.weekTotal}>{weekTotal.toLocaleString()} words</span>
          </div>
          <div className={styles.chart}>
            {weekDays.map((day, i) => (
              <div key={day.date} className={styles.barContainer}>
                <div className={styles.barWrapper}>
                  <div
                    className={`${styles.bar} ${i === 6 ? styles.today : ''}`}
                    style={{ height: `${(day.wordCount / maxWords) * 100}%` }}
                    title={`${day.wordCount.toLocaleString()} words`}
                  />
                </div>
                <span className={`${styles.dayLabel} ${i === 6 ? styles.todayLabel : ''}`}>
                  {day.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Streak */}
        <div className={styles.section}>
          <div className={styles.streakContainer}>
            <span className={styles.streakIcon}>🔥</span>
            <div className={styles.streakInfo}>
              <span className={styles.streakValue}>{streak?.currentStreak || 0}</span>
              <span className={styles.streakLabel}>day streak</span>
            </div>
            {streak && streak.currentStreak > 0 && (
              <span className={styles.streakMessage}>
                {getStreakMessage(streak.currentStreak)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
