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
  await api.post('/activity', { charCount, wordCount });
}

export async function getTodayActivity(): Promise<TodayActivity> {
  const response = await api.get<TodayActivity>('/activity/today');
  return response.data;
}

export async function getActivityHistory(days: number = 7): Promise<DailyActivity[]> {
  const response = await api.get<DailyActivity[]>('/activity/history', { params: { days } });
  return response.data;
}
