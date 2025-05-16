'use client';

import { useEffect, useState } from 'react';
import { useHotelStore } from '@/store/useStore';
import type { Room, Booking } from '@/types/hotel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Thermometer, Droplets, Lightbulb, DoorOpen, Snowflake, KeyRound, WifiOff } from 'lucide-react';
import * as BleService from '@/lib/ble-service'; // Simulated BLE service
import { Skeleton } from '../ui/skeleton';

interface RoomControlClientPageProps {
  bookingId: string;
}

export default function RoomControlClientPage({ bookingId }: RoomControlClientPageProps) {
  const { user, rooms, bookings, updateRoomControls, fetchRoomSensorData } = useHotelStore();
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bleConnected, setBleConnected] = useState(false);
  const [bleDeviceName, setBleDeviceName] = useState<string | null>(null);

  useEffect(() => {
    const booking = bookings.find(b => b.id === bookingId && b.guestEmail === user.email);
    if (booking) {
      setCurrentBooking(booking);
      const room = rooms.find(r => r.id === booking.roomId);
      setCurrentRoom(room || null);
      if (room) {
         // Periodically fetch sensor data
        const intervalId = setInterval(() => fetchRoomSensorData(room.id), 10000); // every 10s
        setIsLoading(false);
        return () => clearInterval(intervalId);
      }
    } else {
       setIsLoading(false); // Booking not found or doesn't belong to user
    }
  }, [bookingId, bookings, rooms, user.email, fetchRoomSensorData]);

  const handleBleConnect = async () => {
    if (!currentRoom) return;
    try {
      const deviceName = `HotelKeyRoom-${currentRoom.id}`;
      setBleDeviceName(deviceName);
      const device = await BleService.requestDevice({ filters: [{ name: deviceName }] });
      if (device) {
        await BleService.connectToGattServer(device);
        // Further characteristic interactions would go here
        setBleConnected(true);
        toast({ title: 'BLE Connected', description: `Connected to ${deviceName}.` });
      }
    } catch (error) {
      console.error('BLE Connection Error:', error);
      toast({ title: 'BLE Error', description: (error as Error).message, variant: 'destructive' });
      setBleConnected(false);
    }
  };
  
  const handleToggleControl = async (controlType: 'light' | 'door' | 'ac', value?: boolean) => {
    if (!currentRoom) return;

    let newValue: boolean;
    let updatePayload: Partial<RoomControls> = {};

    switch (controlType) {
      case 'light':
        newValue = value !== undefined ? value : !currentRoom.lightOn;
        updatePayload = { lightOn: newValue };
        if (bleConnected) await BleService.sendLightCommand(newValue);
        break;
      case 'door': // For door, it's an action, not a toggle of state typically
        if (bleConnected) await BleService.sendDoorCommand(true); // true for open
        toast({ title: 'Door Unlock Signal Sent', description: 'If BLE connected, command sent.' });
        // Note: Door lock state might be read-only or auto-lock.
        // For this simulation, we'll toggle it optimistically if not BLE connected.
        if(!bleConnected) updatePayload = { doorLocked: !currentRoom.doorLocked };
        else updatePayload = { doorLocked: false }; // Assume it unlocks
        break;
      case 'ac':
        newValue = value !== undefined ? value : !currentRoom.acOn;
        updatePayload = { acOn: newValue };
        if (bleConnected) await BleService.sendAcCommand(newValue);
        break;
      default:
        return;
    }
    
    updateRoomControls(currentRoom.id, updatePayload);
    
    toast({
      title: `${controlType.charAt(0).toUpperCase() + controlType.slice(1)} Control`,
      description: `${controlType.charAt(0).toUpperCase() + controlType.slice(1)} ${controlType === 'door' ? 'unlock signal sent' : (Object.values(updatePayload)[0] ? 'turned ON' : 'turned OFF')}.`,
    });
  };


  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-8 w-1/2" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
         <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!currentBooking || !currentRoom) {
    return (
      <Card className="text-center">
        <CardHeader>
          <CardTitle>Booking Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Could not find details for this booking, or it does not belong to you.</p>
          <Button onClick={() => router.push('/')} className="mt-4">Go to Bookings</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold flex items-center">
            <KeyRound className="mr-3 h-8 w-8 text-primary" />
            Room {currentRoom.id} Control Panel
          </CardTitle>
          <CardDescription>Welcome, {user.name}! Manage your room amenities below.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
             {bleConnected ? <WifiOff className="mr-2 h-6 w-6 text-green-500" /> : <WifiOff className="mr-2 h-6 w-6 text-red-500" />}
             Bluetooth (BLE) Control
          </CardTitle>
          <CardDescription>Connect to your room's smart hub via Bluetooth for direct control.</CardDescription>
        </CardHeader>
        <CardContent>
          {bleConnected ? (
            <div className="text-green-600 font-semibold">Connected to {bleDeviceName || 'room device'}</div>
          ) : (
            <Button onClick={handleBleConnect} className="w-full md:w-auto">
              Connect to Room Device
            </Button>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Ensure Bluetooth is enabled on your device. This feature uses Web Bluetooth API (simulated).
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
                <Lightbulb className="mr-2 h-6 w-6 text-yellow-400" /> Room Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <Label htmlFor="light-switch" className="text-lg flex items-center">
                <Lightbulb className="mr-2 h-5 w-5" /> Light
              </Label>
              <Switch
                id="light-switch"
                checked={currentRoom.lightOn}
                onCheckedChange={(value) => handleToggleControl('light', value)}
                aria-label="Toggle light"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <Label htmlFor="ac-switch" className="text-lg flex items-center">
                <Snowflake className="mr-2 h-5 w-5" /> Air Conditioner
              </Label>
              <Switch
                id="ac-switch"
                checked={currentRoom.acOn}
                onCheckedChange={(value) => handleToggleControl('ac', value)}
                aria-label="Toggle air conditioner"
              />
            </div>
             <Button onClick={() => handleToggleControl('door')} className="w-full" variant="outline" size="lg">
              <DoorOpen className="mr-2 h-5 w-5" /> 
              {currentRoom.doorLocked ? 'Unlock Door' : 'Lock Door (Simulated)'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">Door is currently {currentRoom.doorLocked ? 'Locked' : 'Unlocked'}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
                <Thermometer className="mr-2 h-6 w-6 text-red-500" /> Sensor Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg text-lg">
              <span className="flex items-center"><Thermometer className="mr-2 h-5 w-5 text-orange-500" /> Temperature:</span>
              <span>{currentRoom.temperature}°C</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg text-lg">
              <span className="flex items-center"><Droplets className="mr-2 h-5 w-5 text-blue-500" /> Humidity:</span>
              <span>{currentRoom.humidity}%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
