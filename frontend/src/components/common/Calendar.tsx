import { useState, useEffect, useMemo, useCallback } from 'react';
import { getTaskDates, getTasksByDate, getUpcomingTasks, type Task, type TaskDateInfo } from '../../api/tasks.api';
import styles from './Calendar.module.css';

interface CalendarProps {
  onTaskClick?: (task: Task) => void;
}

export function Calendar({ onTaskClick }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [taskDates, setTaskDates] = useState<TaskDateInfo[]>([]);
  const [dayTasks, setDayTasks] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [isLoadingDayTasks, setIsLoadingDayTasks] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Fetch task dates for the current month
  useEffect(() => {
    const fetchTaskDates = async () => {
      try {
        const dates = await getTaskDates(year, month + 1); // API uses 1-indexed month
        setTaskDates(dates);
      } catch (error) {
        console.error('Failed to fetch task dates:', error);
      }
    };
    fetchTaskDates();
  }, [year, month]);

  // Fetch upcoming tasks
  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        const tasks = await getUpcomingTasks();
        setUpcomingTasks(tasks);
      } catch (error) {
        console.error('Failed to fetch upcoming tasks:', error);
      }
    };
    fetchUpcoming();
  }, []);

  // Fetch tasks for selected date
  useEffect(() => {
    if (!selectedDate) {
      setDayTasks([]);
      return;
    }

    const fetchDayTasks = async () => {
      setIsLoadingDayTasks(true);
      try {
        const tasks = await getTasksByDate(selectedDate);
        setDayTasks(tasks);
      } catch (error) {
        console.error('Failed to fetch day tasks:', error);
      } finally {
        setIsLoadingDayTasks(false);
      }
    };
    fetchDayTasks();
  }, [selectedDate]);

  // Calendar data
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

    const days: { date: number; dateStr: string; isToday: boolean; hasTasks: boolean; taskInfo?: TaskDateInfo }[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Create a map for quick lookup
    const taskDateMap = new Map(taskDates.map(d => [d.date, d]));

    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ date: 0, dateStr: '', isToday: false, hasTasks: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const taskInfo = taskDateMap.get(dateStr);
      days.push({
        date: day,
        dateStr,
        isToday: dateStr === todayStr,
        hasTasks: !!taskInfo,
        taskInfo,
      });
    }

    return days;
  }, [year, month, taskDates]);

  const monthName = useMemo(() => {
    return currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [currentDate]);

  const handlePrevMonth = useCallback(() => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
  }, [year, month]);

  const handleNextMonth = useCallback(() => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
  }, [year, month]);

  const handleDateClick = useCallback((dateStr: string) => {
    setSelectedDate(prev => prev === dateStr ? null : dateStr);
  }, []);

  const formatDateTime = (date: string, time: string) => {
    const d = new Date(`${date}T${time}`);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const d = new Date();
    d.setHours(parseInt(hours), parseInt(minutes));
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className={styles.container}>
      {/* Calendar Header */}
      <div className={styles.header}>
        <button className={styles.navButton} onClick={handlePrevMonth} title="Previous month">
          ◀
        </button>
        <span className={styles.monthYear}>{monthName}</span>
        <button className={styles.navButton} onClick={handleNextMonth} title="Next month">
          ▶
        </button>
      </div>

      {/* Calendar Grid */}
      <div className={styles.weekdays}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className={styles.weekday}>{day}</div>
        ))}
      </div>

      <div className={styles.days}>
        {calendarDays.map((day, index) => (
          <div key={index} className={styles.dayCell}>
            {day.date > 0 && (
              <button
                className={`${styles.day} ${day.isToday ? styles.today : ''} ${day.hasTasks ? styles.hasTasks : ''} ${selectedDate === day.dateStr ? styles.selected : ''}`}
                onClick={() => handleDateClick(day.dateStr)}
              >
                {day.date}
                {day.hasTasks && (
                  <span className={styles.taskDot} />
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Selected Day Tasks */}
      {selectedDate && (
        <div className={styles.dayTasksSection}>
          <div className={styles.sectionHeader}>
            Tasks for {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </div>
          {isLoadingDayTasks ? (
            <div className={styles.loading}>Loading...</div>
          ) : dayTasks.length === 0 ? (
            <div className={styles.noTasks}>No tasks for this day</div>
          ) : (
            <div className={styles.taskList}>
              {dayTasks.map(task => (
                <div
                  key={task.id}
                  className={`${styles.taskItem} ${task.completed ? styles.completed : ''}`}
                  onClick={() => onTaskClick?.(task)}
                >
                  <span className={styles.taskCheckbox}>
                    {task.completed ? '☑' : '☐'}
                  </span>
                  <span className={styles.taskDescription}>{task.description}</span>
                  <span className={styles.taskTime}>{formatTime(task.dueTime)}</span>
                  {task.snoozedUntil && <span className={styles.snoozed}>💤</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upcoming Tasks */}
      {!selectedDate && upcomingTasks.length > 0 && (
        <div className={styles.upcomingSection}>
          <div className={styles.sectionHeader}>Upcoming Tasks</div>
          <div className={styles.taskList}>
            {upcomingTasks.map(task => (
              <div
                key={task.id}
                className={`${styles.taskItem} ${task.completed ? styles.completed : ''}`}
                onClick={() => onTaskClick?.(task)}
              >
                <span className={styles.taskCheckbox}>
                  {task.completed ? '☑' : '☐'}
                </span>
                <span className={styles.taskDescription}>{task.description}</span>
                <span className={styles.taskDateTime}>
                  {formatDateTime(task.dueDate, task.dueTime)}
                </span>
                {task.snoozedUntil && <span className={styles.snoozed}>💤</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
