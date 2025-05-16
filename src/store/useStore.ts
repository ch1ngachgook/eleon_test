
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Room, Booking, UserCredentials, BookingDetails, RoomControls } from '@/types/hotel';

interface HotelState {
  user: {
    name: string | null;
    email: string | null;
    role: 'guest' | 'admin' | null;
    currentBookingId: string | null;
    authToken: string | null; // Added for controller authentication
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

const generateMockToken = (roomId: string, userEmail: string | null): string => {
  if (!userEmail) return `MOCK_JWT_FOR_${roomId}_USER_ANONYMOUS_EXP_${Date.now() + 86400000}`;
  return `MOCK_JWT_FOR_${roomId}_USER_${userEmail.split('@')[0]}_EXP_${Date.now() + 86400000}`;
};

export const useHotelStore = create<HotelState>()(
  persist(
    (set, get) => ({
      user: {
        name: null,
        email: null,
        role: null,
        currentBookingId: null,
        authToken: null, // Initialize authToken
      },
      rooms: initialRoomsData,
      bookings: [],
      initializeRooms: (initialRooms) => {
        set({ rooms: initialRooms });
      },
      login: async (credentials) => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        let userRole: 'guest' | 'admin' | null = null;
        let userName: string | null = null;

        if (credentials.email === 'admin@hotel.key' && credentials.password === 'admin') {
          userName = 'Admin User';
          userRole = 'admin';
        } else if (credentials.email === 'guest@hotel.key' && credentials.password === 'guest') {
          userName = 'Guest User';
          userRole = 'guest';
        } else if (credentials.password === 'guest') { // Allow any guest login for prototype ease
          userName = credentials.email.split('@')[0] || 'Guest User';
          userRole = 'guest';
        }

        if (userRole) {
          // Find if user has an existing booking to potentially re-assign authToken
          const existingBookingForUser = get().bookings.find(b => b.guestEmail === credentials.email);
          let authToken: string | null = null;
          let currentBookingId: string | null = null;

          if (existingBookingForUser && userRole === 'guest') {
            authToken = generateMockToken(existingBookingForUser.roomId, credentials.email);
            currentBookingId = existingBookingForUser.id;
          }
          
          set({ user: { 
            name: userName, 
            email: credentials.email, 
            role: userRole, 
            currentBookingId: currentBookingId,
            authToken: authToken 
          }});
          return true;
        }
        set({ user: { name: null, email: null, role: null, currentBookingId: null, authToken: null } }); // Clear on failed login
        return false;
      },
      logout: () => {
        set({ user: { name: null, email: null, role: null, currentBookingId: null, authToken: null } });
      },
      createBooking: async (details) => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        const newBookingId = `booking-${Date.now()}`;
        const guestEmail = get().user.email;
        if (!guestEmail) return null; // Should not happen if user is logged in

        const newBooking: Booking = {
          id: newBookingId,
          roomId: details.roomId,
          guestEmail: guestEmail,
          guestName: details.guestName,
          checkInDate: details.checkInDate,
          checkOutDate: details.checkOutDate,
        };

        const newAuthToken = generateMockToken(details.roomId, guestEmail);

        set(state => ({
          bookings: [...state.bookings, newBooking],
          rooms: state.rooms.map(room =>
            room.id === details.roomId ? { ...room, status: 'occupied', guestName: details.guestName } : room
          ),
          user: { ...state.user, currentBookingId: newBookingId, authToken: newAuthToken }
        }));
        return newBookingId;
      },
      updateRoomControls: (roomId, controls) => {
        set(state => ({
          rooms: state.rooms.map(room =>
            room.id === roomId ? { ...room, ...controls } : room
          ),
        }));
      },
      fetchRoomSensorData: (roomId) => {
        set(state => ({
          rooms: state.rooms.map(room =>
            room.id === roomId ? {
              ...room,
              temperature: Math.floor(Math.random() * 5) + 20, 
              humidity: Math.floor(Math.random() * 20) + 40,
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
      name: 'hotelkey-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, bookings: state.bookings, rooms: state.rooms /* Persist rooms for admin view consistency */ }),
    }
  )
);

if (typeof window !== 'undefined') {
  const storedState = JSON.parse(localStorage.getItem('hotelkey-storage') || '{}');
  if (!storedState.state?.rooms || storedState.state.rooms.length === 0) {
     useHotelStore.getState().initializeRooms(initialRoomsData);
  }
}
