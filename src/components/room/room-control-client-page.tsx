
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
import RoomStatusPanel from './room-status-panel'; // Added import
import { useRouter } from 'next/navigation'; // Added import for router


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
  const router = useRouter(); // Added router

  useEffect(() => {
    const booking = bookings.find(b => b.id === bookingId && b.guestEmail === user.email);
    if (booking) {
      setCurrentBooking(booking);
      const room = rooms.find(r => r.id === booking.roomId);
      setCurrentRoom(room || null);
      if (room) {
         // Periodically fetch sensor data via Zustand store (PWA cache friendly)
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
      const deviceName = `HotelKeyRoom-${currentRoom.id}`; // Default BLE name pattern
      setBleDeviceName(deviceName);
      // Assuming BleService.requestDevice etc. are still relevant for a simplified BLE interaction
      const device = await BleService.requestDevice({ filters: [{ name: deviceName }] });
      if (device) {
        await BleService.connectToGattServer(device);
        setBleConnected(true);
        toast({ title: 'BLE Connected (Legacy)', description: `Connected to ${deviceName}.` });
      }
    } catch (error) {
      console.error('Legacy BLE Connection Error:', error);
      toast({ title: 'BLE Error (Legacy)', description: (error as Error).message, variant: 'destructive' });
      setBleConnected(false);
    }
  };
  
  // This controls the Zustand store version of room state, usually via simulated BLE
  const handleToggleStoreControl = async (controlType: 'light' | 'door' | 'ac', value?: boolean) => {
    if (!currentRoom) return;

    let newValue: boolean;
    let updatePayload: Partial<RoomControls> = {}; // Corrected type name

    switch (controlType) {
      case 'light':
        newValue = value !== undefined ? value : !currentRoom.lightOn;
        updatePayload = { lightOn: newValue };
        if (bleConnected) await BleService.sendLightCommand(newValue); // Legacy BLE command
        break;
      case 'door': 
        if (bleConnected) await BleService.sendDoorCommand(true); // Legacy BLE: true for open
        toast({ title: 'Door Unlock Signal Sent (Legacy BLE)', description: 'If legacy BLE connected, command sent.' });
        if(!bleConnected) updatePayload = { doorLocked: !currentRoom.doorLocked };
        else updatePayload = { doorLocked: false }; 
        break;
      case 'ac':
        newValue = value !== undefined ? value : !currentRoom.acOn;
        updatePayload = { acOn: newValue };
        if (bleConnected) await BleService.sendAcCommand(newValue); // Legacy BLE command
        break;
      default:
        return;
    }
    
    updateRoomControls(currentRoom.id, updatePayload); // Updates Zustand store
    
    toast({
      title: `Store ${controlType.charAt(0).toUpperCase() + controlType.slice(1)} Control`,
      description: `${controlType.charAt(0).toUpperCase() + controlType.slice(1)} ${controlType === 'door' ? 'unlock signal sent' : (Object.values(updatePayload)[0] ? 'turned ON' : 'turned OFF')}. (Via Zustand/Legacy BLE)`,
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
      <Card className="text-center shadow-xl">
        <CardHeader>
          <CardTitle>Информация о бронировании не найдена</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Не удалось найти детали для этого бронирования, или оно не принадлежит вам.</p>
          <Button onClick={() => router.push('/')} className="mt-4">Перейти к бронированиям</Button>
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
            Панель управления комнатой {currentRoom.id}
          </CardTitle>
          <CardDescription>Добро пожаловать, {user.name}! Управляйте удобствами вашей комнаты ниже.</CardDescription>
        </CardHeader>
      </Card>

      {/* New Room Status Panel for direct controller interaction */}
      <RoomStatusPanel roomId={currentRoom.id} />

      {/* Existing simplified BLE control and sensor display (can be kept for PWA offline view or specific BLE demo) */}
      <Card className="shadow-lg mt-6">
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
             {bleConnected ? <WifiOff className="mr-2 h-6 w-6 text-green-500" /> : <WifiOff className="mr-2 h-6 w-6 text-red-500" />}
             Управление через BLE (Упрощенное/PWA)
          </CardTitle>
          <CardDescription>Это управление имитирует базовые BLE команды и обновляет состояние в PWA.</CardDescription>
        </CardHeader>
        <CardContent>
          {bleConnected ? (
            <div className="text-green-600 font-semibold">Подключено к {bleDeviceName || 'устройству комнаты'} (Упрощенное BLE)</div>
          ) : (
            <Button onClick={handleBleConnect} className="w-full md:w-auto">
              Подключиться к устройству (Упрощенное BLE)
            </Button>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Эта функция использует Web Bluetooth API (симуляция) для базовых команд.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
                <Lightbulb className="mr-2 h-6 w-6 text-yellow-400" /> Управление (PWA/Offline)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <Label htmlFor="legacy-light-switch" className="text-lg flex items-center">
                <Lightbulb className="mr-2 h-5 w-5" /> Свет (Store)
              </Label>
              <Switch
                id="legacy-light-switch"
                checked={currentRoom.lightOn} // From Zustand Store
                onCheckedChange={(value) => handleToggleStoreControl('light', value)}
                aria-label="Toggle light (Store)"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <Label htmlFor="legacy-ac-switch" className="text-lg flex items-center">
                <Snowflake className="mr-2 h-5 w-5" /> A/C (Store)
              </Label>
              <Switch
                id="legacy-ac-switch"
                checked={currentRoom.acOn} // From Zustand Store
                onCheckedChange={(value) => handleToggleStoreControl('ac', value)}
                aria-label="Toggle air conditioner (Store)"
              />
            </div>
             <Button onClick={() => handleToggleStoreControl('door')} className="w-full" variant="outline" size="lg">
              <DoorOpen className="mr-2 h-5 w-5" /> 
              {currentRoom.doorLocked ? 'Открыть дверь (Store)' : 'Закрыть дверь (Store)'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">Дверь (Store): {currentRoom.doorLocked ? 'Закрыта' : 'Открыта'}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
                <Thermometer className="mr-2 h-6 w-6 text-red-500" /> Данные датчиков (Store)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg text-lg">
              <span className="flex items-center"><Thermometer className="mr-2 h-5 w-5 text-orange-500" /> Температура:</span>
              <span>{currentRoom.temperature}°C</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg text-lg">
              <span className="flex items-center"><Droplets className="mr-2 h-5 w-5 text-blue-500" /> Влажность:</span>
              <span>{currentRoom.humidity}%</span>
            </div>
             {/* Pressure is not in useHotelStore.Room, so it would come from direct controller if available */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

