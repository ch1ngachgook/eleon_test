
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRoomController, ConnectionStatus } from '@/hooks/use-room-controller';
import LightToggle from './controls/light-toggle';
import DoorControlButton from './controls/door-control-button';
import ChannelSwitch from './controls/channel-switch';
import SensorDisplay from './controls/sensor-display';
import {
  ProtoLightStates,
  ProtoDoorLockStates,
  ProtoChannelStates,
  ProtoCommandStates,
} from '@/types/protobuf';
import { Thermometer, Droplets, Gauge, Wifi, WifiOff, ZapOff, Network, Fingerprint, KeyRound, Bluetooth as BluetoothIcon, AlertCircle, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from '@/hooks/use-toast'; // Added toast import

interface RoomStatusPanelProps {
  roomId: string;
  authToken: string | null; // Added authToken prop
}

const ConnectionStatusIndicator: React.FC<{ status: ConnectionStatus, errorMsg?: string | null }> = ({ status, errorMsg }) => {
  let Icon = WifiOff;
  let text = "Disconnected";
  let color = "text-red-500";

  switch (status) {
    case 'connecting_tcp':
    case 'connecting_ble':
    case 'authenticating_ble':
      Icon = Loader2;
      text = "Connecting...";
      color = "text-yellow-500 animate-spin";
      break;
    case 'connected_tcp':
      Icon = Wifi;
      text = "Connected (TCP)";
      color = "text-green-500";
      break;
    case 'connected_ble':
      Icon = BluetoothIcon;
      text = "Connected (BLE)";
      color = "text-blue-500";
      break;
    case 'error':
      Icon = ZapOff;
      text = errorMsg || "Connection Error";
      color = "text-red-500";
      break;
  }
  return (
    <div className={`flex items-center gap-2 p-2 rounded-md bg-muted ${color}`}>
      <Icon className={`h-5 w-5`} />
      <span>{text}</span>
    </div>
  );
};


export default function RoomStatusPanel({ roomId, authToken }: RoomStatusPanelProps) {
  const {
    deviceInfo,
    hardwareState,
    connectionStatus,
    error,
    isSendingCommand,
    connect,
    disconnect,
    sendCommand,
  } = useRoomController(roomId, authToken); // Pass authToken to the hook

  const handleLightToggle = (isOn: boolean) => {
    sendCommand(isOn ? ProtoCommandStates.LightOn : ProtoCommandStates.LightOff);
  };

  const handleDoorToggle = () => {
    // Corrected logic: if current state is Close, send Open command, and vice-versa.
    sendCommand(hardwareState.door_lock === ProtoDoorLockStates.Close ? ProtoCommandStates.DoorLockOpen : ProtoCommandStates.DoorLockClose);
  };

  const handleChannel1Toggle = (isOn: boolean) => {
    sendCommand(isOn ? ProtoCommandStates.Channel1On : ProtoCommandStates.Channel1Off);
  };

  const handleChannel2Toggle = (isOn: boolean) => {
    sendCommand(isOn ? ProtoCommandStates.Channel2On : ProtoCommandStates.Channel2Off);
  };
  
  const isEffectivelyConnected = connectionStatus === 'connected_tcp' || connectionStatus === 'connected_ble';
  const isConnecting = connectionStatus === 'connecting_tcp' || connectionStatus === 'connecting_ble' || connectionStatus === 'authenticating_ble';

  if (!authToken) {
    return (
      <Card className="shadow-xl mt-6 border-orange-500 bg-orange-50">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl flex items-center text-orange-700">
                <ShieldAlert className="mr-3 h-7 w-7" />
                Требуется авторизация
              </CardTitle>
              <CardDescription className="text-orange-600">
                Для управления комнатой необходим действительный токен авторизации.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p>Пожалуйста, убедитесь, что вы вошли в систему и у вас есть активное бронирование для этой комнаты.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl mt-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
          <div>
            <CardTitle className="text-2xl flex items-center">
              <ZapOff className="mr-3 h-7 w-7 text-primary" />
              Состояние комнаты (Прямое управление)
            </CardTitle>
            <CardDescription>Прямое управление и мониторинг контроллера комнаты {roomId}.</CardDescription>
          </div>
           <ConnectionStatusIndicator status={connectionStatus} errorMsg={error?.message} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {(!isEffectivelyConnected && connectionStatus !== 'connecting_tcp' && connectionStatus !== 'connecting_ble' && connectionStatus !== 'authenticating_ble') || (connectionStatus === 'error' && error?.type !== 'command') ? (
          <div className="text-center space-y-3">
            <p className={error ? "text-destructive" : ""}>
              {error && error.type !== 'command' ? error.message : `Нет подключения к контроллеру комнаты ${roomId}.`}
            </p>
            <Button onClick={connect} disabled={isConnecting || !authToken}>
              {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isConnecting ? 'Подключение...' : `Подключиться к контроллеру (Комната ${roomId})`}
            </Button>
            {!authToken && <p className="text-xs text-destructive mt-1">Отсутствует токен авторизации.</p>}
          </div>
        ) : isConnecting ? (
            <div className="text-center py-8">
                <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
                <p className="mt-2 text-muted-foreground">Подключение к контроллеру для комнаты {roomId}...</p>
            </div>
        ) : (
          <>
            {error && error.type === 'command' && ( // Only show command errors here, connection errors handled above
              <Alert variant="destructive" className="my-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Ошибка команды</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}

            {deviceInfo && (
              <Card className="bg-background/50">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-lg">Информация о контроллере</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm pt-2">
                  <div className="flex items-center"><Network className="mr-2 h-4 w-4 text-muted-foreground" /> IP: {deviceInfo.ip}</div>
                  <div className="flex items-center"><Fingerprint className="mr-2 h-4 w-4 text-muted-foreground" /> MAC: {deviceInfo.mac}</div>
                  <div className="flex items-center"><BluetoothIcon className="mr-2 h-4 w-4 text-muted-foreground" /> BLE Имя: {deviceInfo.ble_name}</div>
                  <div className="flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground" /> Токен контроллера: <span className="truncate ml-1 text-xs">{deviceInfo.token}</span></div>
                </CardContent>
              </Card>
            )}
            
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <LightToggle
                        id={`controller-light-${roomId}`}
                        label="Свет"
                        isOn={hardwareState.light_on === ProtoLightStates.On}
                        onToggle={handleLightToggle}
                        isLoading={isSendingCommand} 
                        disabled={!isEffectivelyConnected || isSendingCommand}
                    />
                    <ChannelSwitch
                        id={`controller-channel1-${roomId}`}
                        label="Канал 1"
                        isOn={hardwareState.channel_1 === ProtoChannelStates.ChannelOn}
                        onToggle={handleChannel1Toggle}
                        isLoading={isSendingCommand} 
                        disabled={!isEffectivelyConnected || isSendingCommand}
                    />
                    <ChannelSwitch
                        id={`controller-channel2-${roomId}`}
                        label="Канал 2"
                        isOn={hardwareState.channel_2 === ProtoChannelStates.ChannelOn}
                        onToggle={handleChannel2Toggle}
                        isLoading={isSendingCommand}
                        disabled={!isEffectivelyConnected || isSendingCommand}
                    />
                     <DoorControlButton
                        isLocked={hardwareState.door_lock === ProtoDoorLockStates.Close}
                        onToggle={handleDoorToggle}
                        isLoading={isSendingCommand}
                        disabled={!isEffectivelyConnected || isSendingCommand}
                    />
                    <p className="text-xs text-muted-foreground text-center">
                        Дверь: {hardwareState.door_lock === ProtoDoorLockStates.Close ? 'Закрыта' : 'Открыта'}
                    </p>
                </div>
                <div className="space-y-4">
                    <SensorDisplay
                        label="Температура"
                        value={hardwareState.temperature.toFixed(1)}
                        unit="°C"
                        IconComponent={Thermometer}
                        iconClassName="text-orange-500"
                        isLoading={!isEffectivelyConnected && !deviceInfo} 
                    />
                    <SensorDisplay
                        label="Влажность"
                        value={hardwareState.humidity.toFixed(0)}
                        unit="%"
                        IconComponent={Droplets}
                        iconClassName="text-blue-500"
                         isLoading={!isEffectivelyConnected && !deviceInfo}
                    />
                    <SensorDisplay
                        label="Давление"
                        value={hardwareState.pressure.toFixed(0)}
                        unit=" гПа"
                        IconComponent={Gauge}
                        iconClassName="text-purple-500"
                         isLoading={!isEffectivelyConnected && !deviceInfo}
                    />
                </div>
            </div>
            {isEffectivelyConnected && 
              <Button onClick={disconnect} variant="outline" className="w-full mt-4">
                Отключиться от контроллера (Комната {roomId})
              </Button>
            }
          </>
        )}
      </CardContent>
    </Card>
  );
}
