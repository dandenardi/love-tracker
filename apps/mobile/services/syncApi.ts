import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { 
  AuthResponse, 
  LoginPayload, 
  RegisterPayload, 
  RefreshResponse, 
  InviteCodeResponse, 
  PairResponse, 
  SyncPushPayload, 
  SyncPullResponse 
} from '@love/shared';

import Constants from 'expo-constants';

// Use apiUrl from app.json/app.config.js extra field
const BASE_URL = Constants.expoConfig?.extra?.apiUrl || (Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001'); 

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data as T;
}

export const authApi = {
  register: (payload: RegisterPayload) => request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  
  login: (payload: LoginPayload) => request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  
  refresh: (refreshToken: string) => request<RefreshResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  }),
  
  invite: () => request<InviteCodeResponse>('/auth/invite', {
    method: 'POST',
  }),
  
  pair: (code: string) => request<PairResponse>('/auth/pair', {
    method: 'POST',
    body: JSON.stringify({ code }),
  }),
  
  unpair: () => request<{ success: boolean }>('/auth/unpair', {
    method: 'POST',
  }),
};

export const syncApi = {
  push: (payload: SyncPushPayload) => request<{ success: boolean }>('/sync/push', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  
  pull: (lastPulledAt: number) => request<SyncPullResponse>(`/sync/pull?lastPulledAt=${lastPulledAt}`, {
    method: 'GET',
  }),
  
  delete: (clientId: string) => request<{ success: boolean }>(`/sync/${clientId}`, {
    method: 'DELETE',
  }),
};
