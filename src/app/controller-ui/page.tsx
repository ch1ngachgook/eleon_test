
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useControllerStore } from '@/store/controllerStore';
import { useControllerConnection, type ControllerInfo, type ControllerHardwareState } from '@/hooks/useControllerConnection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Lightbulb, KeyRound, Thermometer, Droplets, Wind, Router, WifiOff, Power } from 'lucide-react';

function ConnectionStatusDisplay({ status, error }: { status: string, error: any }) {
  let bgColor = 'bg-gray-200';
  let textColor = 'text-gray-700';
  if (status === 'connected') {
    bgColor = 'bg-green-100';
    textColor = 'text-green-700';
  } else if (status === 'connecting') {
    bgColor = 'bg-yellow-100';
    textColor = 'text-yellow-700';
  } else if (status === 'disconnected' || status === 'error') {
    bgColor = 'bg-red-100';
    textColor = 'text-red-700';
  }

  return (
    <div className={`p-3 rounded-md ${bgColor} ${textColor} mb-4 shadow`}>
      <p className="font-semibold">Bridge Status: <span className="capitalize">{status}</span></p>
      {status === 'error' && error && <p className="text-xs mt-1">Error: {error.message} ({error.type})</p>}
    </div>
  );
}

function DeviceInfoDisplay({ info }: { info: ControllerInfo | null }) {
  if (!info) return <p className="text-sm text-muted-foreground">Device info not yet available.</p>;
  return (
    <Card className="mb-6 shadow-md">
      <CardHeader>
        <CardTitle className="text-xl flex items-center"><Router className="mr-2 h-5 w-5 text-primary" />Controller Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p><strong>IP:</strong> {info.ip || 'N/A'}</p>
        <p><strong>MAC:</strong> {info.mac || 'N/A'}</p>
        <p><strong>BLE Name:</strong> {info.ble_name || 'N/A'}</p>
        <p><strong>Controller Token:</strong> {info.token || 'N/A'}</p>
        {Object.entries(info)
            .filter(([key]) => !['ip', 'mac', 'ble_name', 'token'].includes(key))
            .map(([key, value]) => (
          <p key={key}><strong>{key}:</strong> {String(value)}</p>
        ))}
      </CardContent>
    </Card>
  );
}

function HardwareStateDisplay({ state, onCommand, isSending }: { state: ControllerHardwareState | null, onCommand: (cmd: object) => void, isSending: boolean }) {
  if (!state) return <p className="text-sm text-muted-foreground">Hardware state not yet available. Try refreshing state.</p>;
  
  const handleToggle = (key: keyof ControllerHardwareState, currentValue: boolean | string | undefined) => {
      if (key === 'door_lock') {
          onCommand({ door_lock_action: currentValue === 'open' || currentValue === true ? 'close' : 'open' });
      } else {
          onCommand({ [key]: !currentValue });
      }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-xl flex items-center"><KeyRound className="mr-2 h-5 w-5 text-primary" />Room Controls & Sensors</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {typeof state.light_on !== 'undefined' && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <Label htmlFor="light-switch" className="text-lg flex items-center">
              <Lightbulb className={`mr-2 h-5 w-5 ${state.light_on ? 'text-yellow-400' : 'text-gray-400'}`} /> Light
            </Label>
            <Switch id="light-switch" checked={!!state.light_on} onCheckedChange={() => handleToggle('light_on', state.light_on)} disabled={isSending} />
          </div>
        )}
        {typeof state.door_lock !== 'undefined' && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <Label className="text-lg flex items-center">
                    <KeyRound className={`mr-2 h-5 w-5 ${state.door_lock === 'open' || state.door_lock === true ? 'text-green-500' : 'text-red-500'}`} /> Door
                </Label>
                <Button onClick={() => handleToggle('door_lock', state.door_lock)} variant="outline" disabled={isSending}>
                    {state.door_lock === 'open' || state.door_lock === true ? 'Lock' : 'Unlock'} (Currently: {typeof state.door_lock === 'boolean' ? (state.door_lock ? 'Open/Unlocked' : 'Closed/Locked') : state.door_lock})
                </Button>
            </div>
        )}
        {typeof state.channel_1 !== 'undefined' && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <Label htmlFor="channel1-switch" className="text-lg">Channel 1</Label>
            <Switch id="channel1-switch" checked={!!state.channel_1} onCheckedChange={() => handleToggle('channel_1', state.channel_1)} disabled={isSending} />
          </div>
        )}
        {typeof state.channel_2 !== 'undefined' && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <Label htmlFor="channel2-switch" className="text-lg">Channel 2</Label>
            <Switch id="channel2-switch" checked={!!state.channel_2} onCheckedChange={() => handleToggle('channel_2', state.channel_2)} disabled={isSending} />
          </div>
        )}

        <CardDescription className="pt-2">Sensors:</CardDescription>
        {typeof state.temperature !== 'undefined' && (
          <div className="flex items-center justify-between p-2 bg-blue-50 rounded-md text-sm">
            <span className="flex items-center"><Thermometer className="mr-1 h-4 w-4 text-red-500" />Temperature:</span>
            <span>{state.temperature?.toFixed(1)} °C</span>
          </div>
        )}
        {typeof state.humidity !== 'undefined' && (
          <div className="flex items-center justify-between p-2 bg-blue-50 rounded-md text-sm">
            <span className="flex items-center"><Droplets className="mr-1 h-4 w-4 text-blue-500" />Humidity:</span>
            <span>{state.humidity?.toFixed(0)} %</span>
          </div>
        )}
         {typeof state.pressure !== 'undefined' && (
          <div className="flex items-center justify-between p-2 bg-blue-50 rounded-md text-sm">
            <span className="flex items-center"><Wind className="mr-1 h-4 w-4 text-gray-500" />Pressure:</span>
            <span>{state.pressure?.toFixed(0)} hPa</span>
          </div>
        )}
        {Object.entries(state)
            .filter(([key]) => !['light_on', 'door_lock', 'channel_1', 'channel_2', 'temperature', 'humidity', 'pressure'].includes(key))
            .map(([key, value]) => (
            <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded-md text-sm">
                <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                <span>{String(value)}</span>
            </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function ControllerUIPage() {
  const router = useRouter();
  const { authToken, roomId, clearAuthDetails } = useControllerStore();
  const {
    deviceInfo,
    hardwareState,
    connectionStatus,
    error,
    isSendingCommand,
    lastMessage,
    connect,
    disconnect,
    sendCommand,
    getDeviceInfo,
    getCurrentState,
  } = useControllerConnection();

  useEffect(() => {
    if (!authToken || !roomId) {
      router.replace('/controller-ui/login');
    }
  }, [authToken, roomId, router]);

  if (!authToken || !roomId) {
    return <p className="text-center mt-10">Redirecting to login...</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Controller Interface for Room: {roomId}</CardTitle>
          <CardDescription>
            Auth Token: <span className="text-xs break-all">{authToken}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {connectionStatus !== 'connected' ? (
            <Button onClick={connect} disabled={connectionStatus === 'connecting' || isSendingCommand}>
              <Power className="mr-2 h-4 w-4" /> {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect to Bridge'}
            </Button>
          ) : (
            <Button onClick={disconnect} variant="destructive" disabled={isSendingCommand}>
             <WifiOff className="mr-2 h-4 w-4" /> Disconnect
            </Button>
          )}
          <Button onClick={getDeviceInfo} variant="outline" disabled={connectionStatus !== 'connected' || isSendingCommand}>
            Get Controller Info
          </Button>
          <Button onClick={getCurrentState} variant="outline" disabled={connectionStatus !== 'connected' || isSendingCommand}>
            Refresh Room State
          </Button>
           <Button onClick={clearAuthDetails} variant="ghost" size="sm" className="ml-auto">
            Clear Auth & Logout
          </Button>
        </CardContent>
      </Card>

      <ConnectionStatusDisplay status={connectionStatus} error={error} />
      
      {connectionStatus === 'connected' && (
        <>
          <DeviceInfoDisplay info={deviceInfo} />
          <HardwareStateDisplay state={hardwareState} onCommand={sendCommand} isSending={isSendingCommand} />
        </>
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-lg">Last Message from Bridge</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto max-h-60">
            {lastMessage ? JSON.stringify(lastMessage, null, 2) : 'No messages yet.'}
          </pre>
        </CardContent>
      </Card>
       <Card className="mt-6">
        <CardHeader><CardTitle className="text-lg">Debug: Send Custom Command Object</CardTitle></CardHeader>
        <CardContent>
            <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const customCmdString = formData.get('customCommand') as string;
                try {
                    const cmdObj = JSON.parse(customCmdString);
                    sendCommand(cmdObj);
                } catch (err) {
                    alert('Invalid JSON for custom command.');
                    console.error("Custom command JSON parse error:", err);
                }
            }}>
                <Label htmlFor="customCommand" className="block mb-1">Command JSON (e.g., {"{\"light_on\": true}"} or {"{\"door_lock_action\": \"open\"}"} ):</Label>
                <textarea 
                    id="customCommand"
                    name="customCommand"
                    rows={3}
                    className="w-full p-2 border rounded mb-2"
                    defaultValue={'{"light_on": true}'}
                />
                <Button type="submit" variant="secondary" disabled={connectionStatus !== 'connected' || isSendingCommand}>Send Custom Command</Button>
            </form>
        </CardContent>
      </Card>
    </div>
  );
}
