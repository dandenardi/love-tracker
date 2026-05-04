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
} from '@/types/shared';

import { storage } from './storage';
import Constants from 'expo-constants';

// Use apiUrl from app.json/app.config.js extra field
const BASE_URL = Constants.expoConfig?.extra?.apiUrl || (Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001'); 

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

let sessionExpiredCallback: (() => void) | null = null;
export const onSessionExpired = (cb: () => void) => {
  sessionExpiredCallback = cb;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  console.log(`[API] Requesting: ${BASE_URL}${path}`);
  
  try {
    let response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    // Handle token expiration (403 or 401 depending on backend)
    if (response.status === 403 && path !== '/auth/refresh' && path !== '/auth/login' && path !== '/auth/register') {
      const rfToken = await storage.getItem('refreshToken');
      if (rfToken) {
        console.log('[API] Token expired, attempting refresh...');
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rfToken }),
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setAccessToken(data.accessToken);
          headers.set('Authorization', `Bearer ${data.accessToken}`);
          console.log('[API] Token refreshed, retrying original request...');
          // Retry original request
          response = await fetch(`${BASE_URL}${path}`, {
            ...options,
            headers,
          });
        } else {
          console.log('[API] Refresh token expired or invalid');
          sessionExpiredCallback?.();
          throw new Error('SESSION_EXPIRED');
        }
      } else {
        sessionExpiredCallback?.();
        throw new Error('SESSION_EXPIRED');
      }
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr: any) {
      console.error(`[API] JSON Parse Error for ${path}: ${parseErr.message}`);
      console.error(`[API] Raw response (first 100 chars): ${text.substring(0, 100)}`);
      throw new Error(`MALFORMED_JSON: ${parseErr.message}`);
    }

    if (!response.ok) {
      console.log(`[API] Response Error (${response.status}):`, data);
      throw new Error(data.error || 'Request failed');
    }

    return data as T;
  } catch (err: any) {
    console.error(`[API] Network/Fetch Error for ${path}:`, err);
    throw err;
  }
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
  
  unpair: (partnerId: string) => request<{ success: boolean }>('/auth/unpair', {
    method: 'POST',
    body: JSON.stringify({ partnerId }),
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
