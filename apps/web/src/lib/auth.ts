import { apiClient } from '@/lib/api';

export async function login(payload: { email: string; password: string }) {
  const response = await apiClient.post('/api/auth/login', payload);
  return response.data;
}

export async function logout() {
  const response = await apiClient.post('/api/auth/logout');
  return response.data;
}

export async function signup(payload: { name: string; email: string; password: string }) {
  const response = await apiClient.post('/api/auth/signup', payload);
  return response.data;
}
