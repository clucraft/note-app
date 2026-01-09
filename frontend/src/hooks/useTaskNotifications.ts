import { useState, useEffect, useCallback, useRef } from 'react';
import { getDueTasks, type Task } from '../api/tasks.api';

const POLL_INTERVAL = 15000; // 15 seconds for more responsive notifications

export function useTaskNotifications() {
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const processedTaskIds = useRef<Set<string>>(new Set());

  const checkDueTasks = useCallback(async () => {
    try {
      const dueTasks = await getDueTasks();

      // Filter out tasks we've already shown
      const newTasks = dueTasks.filter(task => !processedTaskIds.current.has(task.taskId));

      if (newTasks.length > 0) {
        // Add new tasks to pending queue
        setPendingTasks(prev => [...prev, ...newTasks]);

        // Mark these tasks as processed
        newTasks.forEach(task => processedTaskIds.current.add(task.taskId));
      }
    } catch (error) {
      console.error('Failed to check due tasks:', error);
    }
  }, []);

  // Show next task from queue if no current task is displayed
  useEffect(() => {
    if (!currentTask && pendingTasks.length > 0) {
      const [nextTask, ...remaining] = pendingTasks;
      setCurrentTask(nextTask);
      setPendingTasks(remaining);
    }
  }, [currentTask, pendingTasks]);

  // Poll for due tasks
  useEffect(() => {
    // Initial check
    checkDueTasks();

    // Set up polling
    const interval = setInterval(checkDueTasks, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [checkDueTasks]);

  const dismissCurrentTask = useCallback(() => {
    setCurrentTask(null);
  }, []);

  const onTaskUpdated = useCallback(() => {
    // Clear current task and refresh
    setCurrentTask(null);
  }, []);

  return {
    currentTask,
    dismissCurrentTask,
    onTaskUpdated,
    hasPendingTasks: pendingTasks.length > 0,
  };
}
