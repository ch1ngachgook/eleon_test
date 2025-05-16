import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Room, Booking, UserCredentials, BookingDetails, RoomControls } from '@/types/hotel';

interface HotelState {
  user: {
    name: string | null;
    email: string | null;
    role: 'guest' | 'admin' | null;
    currentBookingId: string | null;
  };
  rooms: Room[];
  bookings: Booking[];
  login: (credentials: UserCredentials) => Promise<boolean>;
  logout: () => void;
  createBooking: (details: BookingDetails) => Promise<string | null>;
  updateRoomControls: (roomId: string, controls: Partial<RoomControls>) => void;
  fetchRoomSensorData: (roomId: string) => void; // Simulates fetching
  adminTurnOffAllLights: () => void;
  adminSetRoomStatus: (roomId: string, status: Room['status'], guestName?: string | null) => void;
  initializeRooms: (initialRooms: Room[]) => void;
}

const initialRoomsData: Room[] = [
  { id: '101', status: 'free', guestName: null, lightOn: false, doorLocked: true, acOn: false, temperature: 22, humidity: 45 },
  { id: '102', status: 'free', guestName: null, lightOn: false, doorLocked: true, acOn: false, temperature: 22, humidity: 50 },
  { id: '103', status: 'occupied', guestName: 'Jane Doe', lightOn: true, doorLocked: false, acOn: true, temperature: 24, humidity: 40 },
  { id: '201', status: 'maintenance', guestName: null, lightOn: false, doorLocked: true, acOn: false, temperature: 20, humidity: 55 },
  { id: '202', status: 'free', guestName: null, lightOn: false, doorLocked: true, acOn: false, temperature: 22, humidity: 48 },
];

export const useHotelStore = create<HotelState>()(
  persist(
    (set, get) => ({
      user: {
        name: null,
        email: null,
        role: null,
        currentBookingId: null,
      },
      rooms: initialRoomsData,
      bookings: [],
      initializeRooms: (initialRooms) => {
        set({ rooms: initialRooms });
      },
      login: async (credentials) => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        if (credentials.email === 'admin@hotel.key' && credentials.password === 'admin') {
          set({ user: { name: 'Admin User', email: credentials.email, role: 'admin', currentBookingId: null } });
          return true;
        }
        if (credentials.email === 'guest@hotel.key' && credentials.password === 'guest') {
          set({ user: { name: 'Guest User', email: credentials.email, role: 'guest', currentBookingId: null } });
          return true;
        }
        // Allow any guest login for prototype ease
        if (credentials.password === 'guest') {
           set({ user: { name: credentials.email.split('@')[0] || 'Guest User', email: credentials.email, role: 'guest', currentBookingId: null } });
           return true;
        }
        return false;
      },
      logout: () => {
        set({ user: { name: null, email: null, role: null, currentBookingId: null } });
      },
      createBooking: async (details) => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        const newBookingId = `booking-${Date.now()}`;
        const newBooking: Booking = {
          id: newBookingId,
          roomId: details.roomId,
          guestEmail: get().user.email!,
          guestName: details.guestName,
          checkInDate: details.checkInDate,
          checkOutDate: details.checkOutDate,
        };
        set(state => ({
          bookings: [...state.bookings, newBooking],
          rooms: state.rooms.map(room =>
            room.id === details.roomId ? { ...room, status: 'occupied', guestName: details.guestName } : room
          ),
          user: { ...state.user, currentBookingId: newBookingId }
        }));
        return newBookingId;
      },
      updateRoomControls: (roomId, controls) => {
        set(state => ({
          rooms: state.rooms.map(room =>
            room.id === roomId ? { ...room, ...controls } : room
          ),
        }));
        // In a real app, this would also send a command to the controller
      },
      fetchRoomSensorData: (roomId) => {
        // Simulate fetching new sensor data
        set(state => ({
          rooms: state.rooms.map(room =>
            room.id === roomId ? {
              ...room,
              temperature: Math.floor(Math.random() * 5) + 20, // 20-24 C
              humidity: Math.floor(Math.random() * 20) + 40,   // 40-59 %
            } : room
          ),
        }));
      },
      adminTurnOffAllLights: () => {
        set(state => ({
          rooms: state.rooms.map(room => ({ ...room, lightOn: false })),
        }));
      },
      adminSetRoomStatus: (roomId, status, guestName = null) => {
        set(state => ({
          rooms: state.rooms.map(room =>
            room.id === roomId ? { ...room, status, guestName: status === 'occupied' ? guestName : null } : room
          ),
        }));
      },
    }),
    {
      name: 'hotelkey-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
      partialize: (state) => ({ user: state.user, bookings: state.bookings }), // Persist only user and bookings
    }
  )
);

// Initialize rooms on first load if not already in store (e.g. after clearing localStorage)
if (typeof window !== 'undefined') {
  const storedState = JSON.parse(localStorage.getItem('hotelkey-storage') || '{}');
  if (!storedState.state?.rooms || storedState.state.rooms.length === 0) {
     useHotelStore.getState().initializeRooms(initialRoomsData);
  }
}
