
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ProtoLightStates,
  ProtoDoorLockStates,
  ProtoChannelStates,
  ProtoCommandStates,
  ProtoStatuses,
} from '@/types/protobuf';
import type {
  ProtoInfoResponse,
  ProtoStateResponse,
  ProtoClientMessage,
  ProtoControllerResponse,
} from '@/types/protobuf';
import * as BleService from '@/lib/ble-service';
import { toast } from '@/hooks/use-toast';

const CONTROLLER_IP = '192.168.1.100';
const CONTROLLER_PORT = 7000;
const BLE_SERVICE_UUID = '0x00ff';
const BLE_CHARACTERISTIC_UUID = '0xff02';

export type ConnectionStatus = 'disconnected' | 'connecting_tcp' | 'connected_tcp' | 'connecting_ble' | 'connected_ble' | 'error' | 'authenticating_ble';
export type ControllerError = { message: string; type: 'tcp' | 'ble' | 'command' | 'auth' } | null;

const initialHardwareState: ProtoStateResponse = {
  light_on: ProtoLightStates.Off,
  door_lock: ProtoDoorLockStates.Close,
  channel_1: ProtoChannelStates.ChannelOff,
  channel_2: ProtoChannelStates.ChannelOff,
  temperature: 0,
  humidity: 0,
  pressure: 0,
};

// Helper functions (defined outside to be stable references)
const parseControllerResponse = (data: ArrayBuffer): ProtoControllerResponse | null => {
  try {
    const textDecoder = new TextDecoder();
    const jsonString = textDecoder.decode(data);
    return JSON.parse(jsonString) as ProtoControllerResponse;
  } catch (e) {
    console.error("Failed to parse mock response:", e);
    return null;
  }
};

const serializeClientMessage = (message: ProtoClientMessage): ArrayBuffer => {
  const jsonString = JSON.stringify(message);
  const textEncoder = new TextEncoder();
  return textEncoder.encode(jsonString).buffer;
};

export function useRoomController(roomId: string) {
  const [deviceInfo, setDeviceInfo] = useState<ProtoInfoResponse | null>(null);
  const [hardwareState, setHardwareState] = useState<ProtoStateResponse>(initialHardwareState);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<ControllerError>(null);
  const [isSendingCommand, setIsSendingCommand] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const bleDeviceRef = useRef<any | null>(null);
  const bleCharacteristicRef = useRef<any | null>(null);
  const stateUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const disconnectAll = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (bleDeviceRef.current && bleDeviceRef.current.gatt?.connected) {
      bleDeviceRef.current.gatt.disconnect();
    }
    bleDeviceRef.current = null;
    bleCharacteristicRef.current = null;
    if (stateUpdateIntervalRef.current) {
      clearInterval(stateUpdateIntervalRef.current);
      stateUpdateIntervalRef.current = null;
    }
  }, []);

  const sendTcpMessage = useCallback((message: ProtoClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(serializeClientMessage(message));
      if ('set_state' in message.message) setIsSendingCommand(true);
    } else {
      setError({ message: 'TCP connection not open.', type: 'tcp' });
      setIsSendingCommand(false);
    }
  }, [connectionStatus]);

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    const response = parseControllerResponse(event.data as ArrayBuffer);
    if (!response) {
      setError({ message: 'Invalid response from controller (TCP)', type: 'tcp' });
      return;
    }

    if ('info' in response.response) {
      setDeviceInfo(response.response.info);
      toast({ title: 'Controller Info Received (TCP)', description: `IP: ${response.response.info.ip}` });
    } else if ('state' in response.response) {
      setHardwareState(response.response.state);
    } else if ('status' in response.response) {
      if (response.response.status === ProtoStatuses.Ok) {
        toast({ title: 'Command Success (TCP)', description: 'Controller confirmed action.' });
        sendTcpMessage({ message: { get_state: {} } });
      } else {
        toast({ title: 'Command Error (TCP)', description: 'Controller reported an error.', variant: 'destructive' });
        setError({ message: 'Controller reported command error', type: 'command' });
      }
    }
    setIsSendingCommand(false);
  }, [sendTcpMessage]);
  
  const sendBleMessage = useCallback(async (message: ProtoClientMessage) => {
    if (!bleCharacteristicRef.current || connectionStatus !== 'connected_ble') {
      setError({ message: 'BLE not connected or characteristic unavailable.', type: 'ble' });
      setIsSendingCommand(false);
      return;
    }
    if ('set_state' in message.message) setIsSendingCommand(true);

    try {
      const payload = serializeClientMessage(message);
      await bleCharacteristicRef.current.writeValue(payload);
      console.log('[ControllerHook] Sent BLE message (simulated):', message);

      setTimeout(() => {
        let mockResponse: ProtoControllerResponse;
        if ('get_state' in message.message) {
          const s = { ...hardwareState, temperature: Math.floor(Math.random() * 3) + 19, humidity: Math.floor(Math.random() * 8) + 38, pressure: Math.floor(Math.random() * 15) + 995 };
          mockResponse = { response: { state: s } };
          setHardwareState(mockResponse.response.state);
        } else if ('set_state' in message.message) {
          // const cmd = (message.message.set_state as { state: ProtoCommandStates }).state;
          mockResponse = { response: { status: ProtoStatuses.Ok } };
          toast({ title: 'Command Success (BLE)' });
          sendBleMessage({ message: { get_state: {} } }); 
        } else if ('get_info' in message.message) {
           mockResponse = { response: { info: deviceInfo || { ip: 'N/A (BLE)', mac: 'N/A (BLE)', ble_name: bleDeviceRef.current?.name || `HotelKeyRoom-${roomId}`, token: 'N/A (BLE_TOKEN)' } }};
           if (!deviceInfo) setDeviceInfo(mockResponse.response.info);
        }
        else {
          mockResponse = { response: { status: ProtoStatuses.Error }};
          toast({ title: 'Command Error (BLE)', variant: 'destructive' });
        }
        setIsSendingCommand(false);
      }, 700);

    } catch (e: any) {
      console.error('[ControllerHook] BLE send/receive error:', e);
      setError({ message: e.message || 'BLE communication error.', type: 'ble' });
      setIsSendingCommand(false);
    }
  }, [hardwareState, connectionStatus, deviceInfo, roomId]);


  const connectTcp = useCallback(() => {
    disconnectAll();
    setConnectionStatus('connecting_tcp');
    setError(null);
    
    console.log(`[ControllerHook] Simulating WebSocket connection to ws://${CONTROLLER_IP}:${CONTROLLER_PORT}`);
    
    const mockWs = {
      readyState: WebSocket.CONNECTING,
      send: (data: string | ArrayBuffer | Blob | ArrayBufferView) => {
        const clientMsg = JSON.parse(new TextDecoder().decode(data as ArrayBuffer)) as ProtoClientMessage;
        console.log("[ControllerHook MockWS] send:", clientMsg);
        setTimeout(() => {
          let mockResponse: ProtoControllerResponse;
          if ('get_info' in clientMsg.message) {
            mockResponse = { response: { info: { ip: CONTROLLER_IP, mac: "00:1A:2B:3C:4D:5E", ble_name: `HotelKeyRoom-${roomId}`, token: `TOKEN_FOR_${roomId}` }}};
          } else if ('get_state' in clientMsg.message) {
            const s = { ...hardwareState, temperature: Math.floor(Math.random() * 5) + 20, humidity: Math.floor(Math.random() * 10) + 40, pressure: Math.floor(Math.random() * 20) + 1000 };
            mockResponse = { response: { state: s }};
          } else if ('set_state' in clientMsg.message) {
            const cmd = (clientMsg.message.set_state as { state: ProtoCommandStates }).state;
            let newHardwareState = { ...hardwareState };
            switch (cmd) {
                case ProtoCommandStates.LightOn: newHardwareState.light_on = ProtoLightStates.On; break;
                case ProtoCommandStates.LightOff: newHardwareState.light_on = ProtoLightStates.Off; break;
                case ProtoCommandStates.DoorLockOpen: newHardwareState.door_lock = ProtoDoorLockStates.Open; break;
                case ProtoCommandStates.DoorLockClose: newHardwareState.door_lock = ProtoDoorLockStates.Close; break;
                case ProtoCommandStates.Channel1On: newHardwareState.channel_1 = ProtoChannelStates.ChannelOn; break;
                case ProtoCommandStates.Channel1Off: newHardwareState.channel_1 = ProtoChannelStates.ChannelOff; break;
                case ProtoCommandStates.Channel2On: newHardwareState.channel_2 = ProtoChannelStates.ChannelOn; break;
                case ProtoCommandStates.Channel2Off: newHardwareState.channel_2 = ProtoChannelStates.ChannelOff; break;
            }
            mockResponse = { response: { status: ProtoStatuses.Ok }};
          } else {
            mockResponse = { response: { status: ProtoStatuses.Error }};
          }
           console.log("[ControllerHook MockWS] onmessage (simulated):", mockResponse);
          if (mockWs.onmessage) mockWs.onmessage({ data: serializeClientMessage(mockResponse as any) } as MessageEvent);
        }, 500 + Math.random() * 500);
      },
      close: () => {
        console.log("[ControllerHook MockWS] close");
        mockWs.readyState = WebSocket.CLOSED;
        if (mockWs.onclose) mockWs.onclose({} as CloseEvent);
      },
      onopen: null as ((this: WebSocket, ev: Event) => any) | null,
      onmessage: null as ((this: WebSocket, ev: MessageEvent) => any) | null,
      onerror: null as ((this: WebSocket, ev: Event) => any) | null,
      onclose: null as ((this: WebSocket, ev: CloseEvent) => any) | null,
    } as unknown as WebSocket;

    wsRef.current = mockWs;

    wsRef.current.onopen = () => {
      console.log('[ControllerHook] WebSocket Connected (Simulated)');
      setConnectionStatus('connected_tcp');
      toast({ title: 'TCP Connected', description: `Connection to controller established.`});
      sendTcpMessage({ message: { get_info: {} } }); 
      
      if (stateUpdateIntervalRef.current) clearInterval(stateUpdateIntervalRef.current);
      stateUpdateIntervalRef.current = setInterval(() => {
        sendTcpMessage({ message: { get_state: {} } });
      }, 7000); 
    };

    wsRef.current.onmessage = handleWebSocketMessage;

    wsRef.current.onerror = (event) => {
      console.error('[ControllerHook] WebSocket Error (Simulated):', event);
      setError({ message: 'TCP connection error. Controller might be offline.', type: 'tcp' });
      setConnectionStatus('error');
    };

    wsRef.current.onclose = () => {
      console.log('[ControllerHook] WebSocket Disconnected (Simulated)');
      // if (connectionStatus !== 'error' && connectionStatus !== 'disconnected') { 
      // }
      if (stateUpdateIntervalRef.current) clearInterval(stateUpdateIntervalRef.current);
    };
    
    setTimeout(() => {
       if (wsRef.current && wsRef.current.onopen && wsRef.current.readyState === WebSocket.CONNECTING) {
         wsRef.current.readyState = WebSocket.OPEN;
         (wsRef.current.onopen as Function)({} as Event);
       }
    }, 1000);

  }, [roomId, disconnectAll, handleWebSocketMessage, sendTcpMessage, hardwareState, connectionStatus]);


  const connectBle = useCallback(async (bleName: string, token: string) => {
    if (!navigator.bluetooth) {
      setError({ message: 'Web Bluetooth not supported.', type: 'ble' });
      setConnectionStatus('error');
      return;
    }
    disconnectAll();
    setConnectionStatus('connecting_ble');
    setError(null);

    try {
      bleDeviceRef.current = await BleService.requestDevice({ filters: [{ name: bleName }] });
      if (!bleDeviceRef.current) {
        setConnectionStatus('error');
        setError({ message: 'BLE device not found or selection cancelled.', type: 'ble' });
        return;
      }

      const server = await BleService.connectToGattServer(bleDeviceRef.current);
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      bleCharacteristicRef.current = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID);
      
      setConnectionStatus('authenticating_ble');
      const mockTokenAuthPayload = new TextEncoder().encode(`AUTH:${token}`); 
      await bleCharacteristicRef.current.writeValue(mockTokenAuthPayload.buffer);
      console.log("[ControllerHook] Sent BLE auth token (simulated)");

      await new Promise(resolve => setTimeout(resolve, 500));

      setConnectionStatus('connected_ble');
      toast({ title: 'BLE Connected', description: `Authenticated with ${bleName}.`});

      sendBleMessage({ message: { get_info: {} } });
      if (stateUpdateIntervalRef.current) clearInterval(stateUpdateIntervalRef.current);
      stateUpdateIntervalRef.current = setInterval(() => {
        sendBleMessage({ message: { get_state: {} } });
      }, 8000);

    } catch (e: any) {
      console.error('[ControllerHook] BLE Error:', e);
      setError({ message: e.message || 'BLE connection failed.', type: 'ble' });
      setConnectionStatus('error');
    }
  }, [roomId, disconnectAll, sendBleMessage]);


  const connect = useCallback(() => {
    connectTcp();
  }, [connectTcp]);


  useEffect(() => {
    return () => {
      disconnectAll();
      if (stateUpdateIntervalRef.current) {
        clearInterval(stateUpdateIntervalRef.current);
      }
    };
  }, [disconnectAll]);

  const sendCommand = useCallback((commandState: ProtoCommandStates) => {
    setError(null);
    const message: ProtoClientMessage = { message: { set_state: { state: commandState } } };
    if (connectionStatus === 'connected_tcp' && wsRef.current) {
      sendTcpMessage(message);
    } else if (connectionStatus === 'connected_ble' && bleCharacteristicRef.current) {
      sendBleMessage(message);
    } else {
      setError({ message: 'Not connected to controller.', type: 'command' });
      toast({ title: 'Command Failed', description: 'Not connected to controller.', variant: 'destructive' });
    }
  }, [connectionStatus, sendTcpMessage, sendBleMessage]);

  return {
    deviceInfo,
    hardwareState,
    connectionStatus,
    error,
    isSendingCommand,
    connect,
    disconnect: disconnectAll,
    sendCommand,
  };
}
