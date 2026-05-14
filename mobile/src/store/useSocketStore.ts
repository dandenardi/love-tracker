import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { BASE_URL, getAccessToken } from '@/services/syncApi';
import { useSyncStore } from './useSyncStore';
import { usePokeStore } from './usePokeStore';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,

  connect: () => {
    const token = getAccessToken();
    if (!token) {
      console.log('[SocketStore] No token available, skipping connection');
      return;
    }

    if (get().socket?.connected) {
      console.log('[SocketStore] Already connected');
      return;
    }

    console.log('[SocketStore] Connecting to:', BASE_URL);

    const socket = io(BASE_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[SocketStore] Connected! ID:', socket.id);
      set({ isConnected: true });
    });

    socket.on('disconnect', (reason) => {
      console.log('[SocketStore] Disconnected:', reason);
      set({ isConnected: false });
    });

    socket.on('connect_error', (err) => {
      console.error('[SocketStore] Connection error:', err.message);
      set({ isConnected: false });
    });

    // Listen for real-time events
    socket.on('new_poke', (data) => {
      console.log('[SocketStore] Real-time event: new_poke', data);
      const pokeStore = usePokeStore.getState();
      pokeStore.loadPokes(pokeStore.lastPokeCheckedAt).catch(console.error);
    });
 
    socket.on('data_changed', (data) => {
      console.log('[SocketStore] Real-time event: data_changed', data);
      useSyncStore.getState().sync().catch(console.error);
    });

    socket.on('poke_status_updated', (data: { pokeId: string, deliveredAt?: number, readAt?: number }) => {
      console.log('[SocketStore] Real-time event: poke_status_updated', data);
      const { updateActivity } = require('./useActivityStore').useActivityStore.getState();
      updateActivity(data.pokeId, { 
        pokeDeliveredAt: data.deliveredAt || null, 
        pokeReadAt: data.readAt || null 
      }).catch(console.error);

      // Update SQLite
      const { updateEventStatus } = require('./useEventsStore').useEventsStore.getState();
      updateEventStatus(data.pokeId, {
        delivered_at: data.deliveredAt || undefined,
        read_at: data.readAt || undefined
      }).catch(console.error);
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      console.log('[SocketStore] Disconnecting manually');
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },
}));
