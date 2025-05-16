
'use client';

import { useEffect, useState } from 'react';
import { useHotelStore } from '@/store/useStore';
import type { Room, Booking } from '@/types/hotel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Thermometer, Droplets, Lightbulb, DoorOpen, Snowflake, KeyRound, WifiOff, AlertTriangle } from 'lucide-react';
import * as BleService from '@/lib/ble-service'; 
import { Skeleton } from '../ui/skeleton';
import RoomStatusPanel from './room-status-panel'; 
import { useRouter } from 'next/navigation'; 
import type { RoomControls as ZustandRoomControls } from '@/types/hotel';


interface RoomControlClientPageProps {
  bookingId: string;
}

export default function RoomControlClientPage({ bookingId }: RoomControlClientPageProps) {
  const { user, rooms, bookings, updateRoomControls, fetchRoomSensorData } = useHotelStore(state => ({
    user: state.user,
    rooms: state.rooms,
    bookings: state.bookings,
    updateRoomControls: state.updateRoomControls,
    fetchRoomSensorData: state.fetchRoomSensorData,
  }));
  const authToken = useHotelStore(state => state.user.authToken);

  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bleConnected, setBleConnected] = useState(false); // For legacy BLE
  const [bleDeviceName, setBleDeviceName] = useState<string | null>(null); // For legacy BLE
  const router = useRouter();

  useEffect(() => {
    const booking = bookings.find(b => b.id === bookingId && b.guestEmail === user.email);
    if (booking) {
      setCurrentBooking(booking);
      const room = rooms.find(r => r.id === booking.roomId);
      setCurrentRoom(room || null);
      if (room) {
        const intervalId = setInterval(() => fetchRoomSensorData(room.id), 10000); 
        setIsLoading(false);
        return () => clearInterval(intervalId);
      } else {
        setIsLoading(false); // Room not found for the booking
      }
    } else {
       setIsLoading(false); // Booking not found or doesn't belong to user
    }
  }, [bookingId, bookings, rooms, user.email, fetchRoomSensorData]);

  const handleBleConnectLegacy = async () => {
    if (!currentRoom) return;
    try {
      const deviceName = `HotelKeyRoom-${currentRoom.id}`; 
      setBleDeviceName(deviceName);
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
  
  const handleToggleStoreControl = async (controlType: 'light' | 'door' | 'ac', value?: boolean) => {
    if (!currentRoom) return;

    let newValue: boolean;
    let updatePayload: Partial<ZustandRoomControls> = {};

    switch (controlType) {
      case 'light':
        newValue = value !== undefined ? value : !currentRoom.lightOn;
        updatePayload = { lightOn: newValue };
        if (bleConnected) await BleService.sendLightCommand(newValue);
        break;
      case 'door': 
        if (bleConnected) await BleService.sendDoorCommand(true); 
        toast({ title: 'Door Unlock Signal Sent (Legacy BLE)', description: 'If legacy BLE connected, command sent.' });
        if(!bleConnected) updatePayload = { doorLocked: !currentRoom.doorLocked };
        else updatePayload = { doorLocked: false }; 
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

      {authToken ? (
        <RoomStatusPanel roomId={currentRoom.id} authToken={authToken} />
      ) : (
        <Card className="shadow-lg mt-6 bg-destructive/10 border-destructive">
          <CardHeader>
            <CardTitle className="text-xl flex items-center text-destructive">
              <AlertTriangle className="mr-2 h-6 w-6" /> Аутентификация не удалась
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">
              Не удалось получить токен аутентификации для управления этой комнатой.
              Пожалуйста, попробуйте забронировать комнату заново или обратитесь в поддержку.
            </p>
             <Button onClick={() => router.push('/')} className="mt-4" variant="secondary">К бронированиям</Button>
          </CardContent>
        </Card>
      )}


      {/* Legacy PWA/Offline controls - can be phased out or kept for specific demo purposes */}
      <Card className="shadow-lg mt-6 opacity-70 border-dashed">
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
             {bleConnected ? <WifiOff className="mr-2 h-6 w-6 text-green-500" /> : <WifiOff className="mr-2 h-6 w-6 text-red-500" />}
             Управление через BLE (Устаревшее/PWA)
          </CardTitle>
          <CardDescription>Это управление имитирует базовые BLE команды и обновляет состояние в PWA.</CardDescription>
        </CardHeader>
        <CardContent>
          {bleConnected ? (
            <div className="text-green-600 font-semibold">Подключено к {bleDeviceName || 'устройству комнаты'} (Устаревшее BLE)</div>
          ) : (
            <Button onClick={handleBleConnectLegacy} className="w-full md:w-auto">
              Подключиться к устройству (Устаревшее BLE)
            </Button>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Эта функция использует Web Bluetooth API (симуляция) для базовых команд.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6 opacity-70">
        <Card className="shadow-md border-dashed">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
                <Lightbulb className="mr-2 h-6 w-6 text-yellow-400" /> Управление (PWA/Store)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <Label htmlFor="legacy-light-switch" className="text-lg flex items-center">
                <Lightbulb className="mr-2 h-5 w-5" /> Свет (Store)
              </Label>
              <Switch
                id="legacy-light-switch"
                checked={currentRoom.lightOn} 
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
                checked={currentRoom.acOn}
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

        <Card className="shadow-md border-dashed">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
