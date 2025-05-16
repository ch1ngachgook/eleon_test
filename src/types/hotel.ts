export interface User {
  name: string | null;
  email: string | null;
  role: 'guest' | 'admin' | null;
  currentBookingId: string | null;
}

export interface Room {
  id: string;
  status: 'free' | 'occupied' | 'maintenance';
  guestName: string | null;
  lightOn: boolean;
  doorLocked: boolean;
  acOn: boolean;
  temperature: number;
  humidity: number;
}

export interface Booking {
  id: string;
  roomId: string;
  guestEmail: string;
  guestName: string;
  checkInDate: string; // ISO string
  checkOutDate: string; // ISO string
}

export interface UserCredentials {
  email: string;
  password?: string; // Password might be optional for guest quick login
}

export interface BookingDetails {
  guestName: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
}

export interface RoomControls {
  lightOn?: boolean;
  doorLocked?: boolean;
  acOn?: boolean;
}
