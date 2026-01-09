import { api } from './index';

export interface Task {
  id: number;
  taskId: string;
  noteId: number | null;
  description: string;
  dueDate: string;
  dueTime: string;
  completed: boolean;
  completedAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDateInfo {
  date: string;
  pendingCount: number;
  completedCount: number;
}

export interface CreateTaskData {
  taskId: string;
  noteId?: number;
  description: string;
  dueDate: string;
  dueTime: string;
}

// Get all tasks
export async function getTasks(): Promise<Task[]> {
  const response = await api.get<Task[]>('/tasks');
  return response.data;
}

// Get tasks for a specific date
export async function getTasksByDate(date: string): Promise<Task[]> {
  const response = await api.get<Task[]>(`/tasks/date/${date}`);
  return response.data;
}

// Get upcoming tasks (next 3)
export async function getUpcomingTasks(): Promise<Task[]> {
  const response = await api.get<Task[]>('/tasks/upcoming');
  return response.data;
}

// Get due tasks (for notifications)
export async function getDueTasks(): Promise<Task[]> {
  // Send local date/time so backend can compare correctly
  const now = new Date();
  // Use local date components to build YYYY-MM-DD format
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const localDate = `${year}-${month}-${day}`;
  const localTime = now.toTimeString().slice(0, 5); // HH:MM

  const response = await api.get<Task[]>('/tasks/due', {
    params: { localDate, localTime }
  });
  return response.data;
}

// Get dates with tasks for a month
export async function getTaskDates(year: number, month: number): Promise<TaskDateInfo[]> {
  const response = await api.get<TaskDateInfo[]>(`/tasks/dates/${year}/${month}`);
  return response.data;
}

// Create a new task
export async function createTask(data: CreateTaskData): Promise<Task> {
  const response = await api.post<Task>('/tasks', data);
  return response.data;
}

// Update a task
export async function updateTask(taskId: string, data: Partial<CreateTaskData>): Promise<Task> {
  const response = await api.put<Task>(`/tasks/${taskId}`, data);
  return response.data;
}

// Complete/uncomplete a task
export async function completeTask(taskId: string, completed: boolean): Promise<Task> {
  const response = await api.patch<Task>(`/tasks/${taskId}/complete`, { completed });
  return response.data;
}

// Snooze a task
export async function snoozeTask(taskId: string, snoozeDuration: '5min' | '1hr' | '1day'): Promise<Task> {
  const response = await api.patch<Task>(`/tasks/${taskId}/snooze`, { snoozeDuration });
  return response.data;
}

// Delete a task
export async function deleteTask(taskId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}`);
}
