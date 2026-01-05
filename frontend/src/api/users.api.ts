import { api } from './index';
import type { User } from '../types/auth.types';

export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  role?: 'admin' | 'user';
}

export interface UpdateUserInput {
  displayName?: string;
  role?: 'admin' | 'user';
}

export async function listUsers(): Promise<User[]> {
  const response = await api.get<User[]>('/users');
  return response.data;
}

export async function getUser(id: number): Promise<User> {
  const response = await api.get<User>(`/users/${id}`);
  return response.data;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const response = await api.post<User>('/users', input);
  return response.data;
}

export async function updateUser(id: number, input: UpdateUserInput): Promise<User> {
  const response = await api.put<User>(`/users/${id}`, input);
  return response.data;
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/users/${id}`);
}
