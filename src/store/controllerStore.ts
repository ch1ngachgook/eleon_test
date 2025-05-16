
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ControllerState {
  authToken: string | null;
  roomId: string | null;
  setAuthDetails: (token: string, roomId: string) => void;
  clearAuthDetails: () => void;
}

export const useControllerStore = create<ControllerState>()(
  persist(
    (set) => ({
      authToken: null,
      roomId: null,
      setAuthDetails: (token, roomId) => set({ authToken: token, roomId: roomId }),
      clearAuthDetails: () => set({ authToken: null, roomId: null }),
    }),
    {
      name: 'controller-auth-storage', // Unique name for localStorage
      storage: createJSONStorage(() => localStorage),
    }
  )
);
