import { api } from './index';

export interface HourlyActivity {
  hour: number;
  charCount: number;
  wordCount: number;
}

export interface TodayActivity {
  date: string;
  hourly: HourlyActivity[];
  totals: {
    charCount: number;
    wordCount: number;
  };
}

export interface DailyActivity {
  date: string;
  charCount: number;
  wordCount: number;
}

export async function recordActivity(charCount: number, wordCount: number): Promise<void> {
  // Send local date and hour from client
  const now = new Date();
  const date = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');
  const hour = now.getHours();

  await api.post('/activity', { charCount, wordCount, date, hour });
}

export async function getTodayActivity(): Promise<TodayActivity> {
  // Send local date from client
  const now = new Date();
  const date = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  const response = await api.get<TodayActivity>('/activity/today', { params: { date } });
  return response.data;
}

export async function getActivityHistory(days: number = 7): Promise<DailyActivity[]> {
  const response = await api.get<DailyActivity[]>('/activity/history', { params: { days } });
  return response.data;
}
