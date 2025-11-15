import axios from 'axios';
import { log } from '@/lib/logger';

const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true
});

apiClient.interceptors.request.use((config) => {
  log.debug({ url: config.url, method: config.method }, 'api request');
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    log.error({
      url: error.config?.url,
      status: error.response?.status,
      message: error.message
    }, 'api error');
    return Promise.reject(error);
  }
);
