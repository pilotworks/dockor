import { create } from 'zustand';
import { DockerDaemonEvent } from '../types';

interface EventStoreState {
  events: DockerDaemonEvent[];
  isDrawerOpen: boolean;
  unreadCount: number;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  addEvent: (event: DockerDaemonEvent) => void;
  setEvents: (events: DockerDaemonEvent[]) => void;
  clearEvents: () => void;
}

export const useEventStore = create<EventStoreState>((set) => ({
  events: [],
  isDrawerOpen: false,
  unreadCount: 0,
  openDrawer: () => set({ isDrawerOpen: true, unreadCount: 0 }),
  closeDrawer: () => set({ isDrawerOpen: false }),
  toggleDrawer: () =>
    set((state) => ({
      isDrawerOpen: !state.isDrawerOpen,
      unreadCount: !state.isDrawerOpen ? 0 : state.unreadCount,
    })),
  addEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, 100),
      unreadCount: state.isDrawerOpen ? 0 : state.unreadCount + 1,
    })),
  setEvents: (events) => set({ events }),
  clearEvents: () => set({ events: [], unreadCount: 0 }),
}));
