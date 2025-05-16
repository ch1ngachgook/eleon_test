
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ProtoLightStates,
  ProtoDoorLockStates,
  ProtoChannelStates,
  ProtoCommandStates,
  ProtoStatuses,
  type ProtoInfoResponse,
  type ProtoStateResponse,
  type ProtoClientMessage,
  type ProtoControllerResponse,
  type ProtoClientMessagePayload,
} from '@/types/protobuf'; // Ensure enum imports are not type-only
import * as BleService from '@/lib/ble-service';
import { toast } from '@/hooks/use-toast';

const CONTROLLER_IP = '192.168.1.100'; // This is the single, shared controller
const CONTROLLER_PORT = 7000;
const BLE_SERVICE_UUID = '0x00ff'; // Shared controller's BLE service
const BLE_CHARACTERISTIC_UUID = '0xff02'; // Shared controller's BLE characteristic

export type ConnectionStatus = 'disconnected' | 'connecting_tcp' | 'connected_tcp' | 'connecting_ble' | 'authenticating_ble' | 'connected_ble' | 'error';
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

// Helper functions outside the hook to ensure stable references
const parseControllerResponse = (data: ArrayBuffer): ProtoControllerResponse | null => {
  try {
    const textDecoder = new TextDecoder();
    const jsonString = textDecoder.decode(data);
    return JSON.parse(jsonString) as ProtoControllerResponse;
  } catch (e) {
    console.error("Failed to parse controller response:", e);
    return null;
  }
};

const serializeClientMessage = (message: ProtoClientMessage): ArrayBuffer => {
  const jsonString = JSON.stringify(message);
  const textEncoder = new TextEncoder();
  return textEncoder.encode(jsonString).buffer;
};


export function useRoomController(roomId: string, authToken: string | null) {
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
    // setConnectionStatus('disconnected'); // Reset status on explicit disconnect
  }, []);

  const sendTcpMessage = useCallback((payload: ProtoClientMessagePayload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: ProtoClientMessage = {
        auth_token: ('get_info' in payload) ? null : authToken, // No auth for get_info
        room_id: ('get_info' in payload) ? null : roomId,       // No room_id for get_info
        message: payload,
      };
      wsRef.current.send(serializeClientMessage(message));
      if ('set_state' in payload) setIsSendingCommand(true);
    } else {
      setError({ message: 'TCP connection not open.', type: 'tcp' });
      setIsSendingCommand(false);
    }
  }, [authToken, roomId, connectionStatus]); // Removed wsRef from deps as it's a ref

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    const response = parseControllerResponse(event.data as ArrayBuffer);
    if (!response) {
      setError({ message: 'Invalid response from controller (TCP)', type: 'tcp' });
      setIsSendingCommand(false);
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
        sendTcpMessage({ get_state: {} });
      } else {
        const errorMsg = `Controller reported error for room ${roomId}.`;
        toast({ title: 'Command Error (TCP)', description: errorMsg, variant: 'destructive' });
        setError({ message: errorMsg, type: 'command' });
      }
    }
    setIsSendingCommand(false);
  }, [sendTcpMessage, roomId]); 
  
  const sendBleMessage = useCallback(async (payload: ProtoClientMessagePayload) => {
    if (!bleCharacteristicRef.current || connectionStatus !== 'connected_ble') {
      setError({ message: 'BLE not connected or characteristic unavailable.', type: 'ble' });
      setIsSendingCommand(false);
      return;
    }
     if (!authToken && !('get_info' in payload)) { // Auth not needed for get_info
      setError({ message: 'BLE authentication token missing.', type: 'auth' });
      setIsSendingCommand(false);
      return;
    }

    const message: ProtoClientMessage = {
      auth_token: ('get_info' in payload) ? null : authToken,
      room_id: ('get_info' in payload) ? null : roomId,
      message: payload,
    };
    
    if ('set_state' in payload) setIsSendingCommand(true);

    try {
      const serializedPayload = serializeClientMessage(message);
      await bleCharacteristicRef.current.writeValue(serializedPayload);
      console.log('[ControllerHook] Sent BLE message (simulated):', message);

      setTimeout(() => {
        let mockResponse: ProtoControllerResponse;
        if ('get_info' in payload) {
           mockResponse = { response: { info: { ip: '192.168.1.100', mac: 'FE:E8:C0:D4:57:14', ble_name: 'ROOM_7', token: 'CM6wqJB5blIMvBKQ' } }};
           setDeviceInfo(mockResponse.response.info);
        } else if ('get_state' in payload) {
          const tempVariation = parseInt(roomId.slice(-1), 10) % 3;
          const s: ProtoStateResponse = { 
            light_on: tempVariation === 1 ? ProtoLightStates.On : ProtoLightStates.Off,
            door_lock: tempVariation === 2 ? ProtoDoorLockStates.Open : ProtoDoorLockStates.Close,
            channel_1: tempVariation === 0 ? ProtoChannelStates.ChannelOn : ProtoChannelStates.ChannelOff,
            channel_2: tempVariation === 1 ? ProtoChannelStates.ChannelOn : ProtoChannelStates.ChannelOff,
            temperature: 19 + tempVariation, 
            humidity: 38 + tempVariation * 2, 
            pressure: 995 + tempVariation 
          };
          mockResponse = { response: { state: s } };
          setHardwareState(mockResponse.response.state);
        } else if ('set_state' in payload) {
          mockResponse = { response: { status: ProtoStatuses.Ok } };
          toast({ title: `Command Success (BLE Room ${roomId})` });
          sendBleMessage({ get_state: {} }); 
        } else {
          mockResponse = { response: { status: ProtoStatuses.Error }};
          toast({ title: `Command Error (BLE Room ${roomId})`, variant: 'destructive' });
        }
        setIsSendingCommand(false);
      }, 700);

    } catch (e: any) {
      console.error(`[ControllerHook] BLE send/receive error for room ${roomId}:`, e);
      setError({ message: e.message || `BLE communication error for room ${roomId}.`, type: 'ble' });
      setIsSendingCommand(false);
    }
  }, [connectionStatus, deviceInfo, roomId, authToken, hardwareState]); // Added hardwareState to deps for sendBleMessage


  const connectTcp = useCallback(() => {
    if (!authToken && connectionStatus !== 'connecting_tcp' && connectionStatus !== 'connected_tcp') { // Allow get_info without token initially
        // This specific check allows initial connection for get_info, other commands will fail if token is still null
    } else if (!authToken) {
        setError({ message: 'Authentication token is missing for TCP connection.', type: 'auth' });
        toast({ title: 'Connection Failed', description: 'Auth token missing.', variant: 'destructive' });
        setConnectionStatus('error');
        return;
    }
    
    disconnectAll();
    setConnectionStatus('connecting_tcp');
    setError(null);
    
    console.log(`[ControllerHook] Simulating WebSocket connection to shared controller ws://${CONTROLLER_IP}:${CONTROLLER_PORT} for room ${roomId}`);
    
    const mockWs = {
      readyState: WebSocket.CONNECTING,
      send: (data: string | ArrayBuffer | Blob | ArrayBufferView) => {
        const clientMsg = JSON.parse(new TextDecoder().decode(data as ArrayBuffer)) as ProtoClientMessage;
        console.log("[ControllerHook MockWS] send:", clientMsg);

        if (!('get_info' in clientMsg.message)) {
          if (!clientMsg.auth_token || !clientMsg.room_id) {
            console.error("[ControllerHook MockWS] Auth token or room_id missing for protected command.");
            if (mockWs.onmessage) mockWs.onmessage({ data: serializeClientMessage({ response: { status: ProtoStatuses.Error } } as any) } as MessageEvent);
            return;
          }
          if (clientMsg.room_id !== roomId || !clientMsg.auth_token.includes(roomId) ) { 
             console.error(`[ControllerHook MockWS] Token/RoomID mismatch. Expected ${roomId}, got ${clientMsg.room_id}. Token: ${clientMsg.auth_token}`);
             if (mockWs.onmessage) mockWs.onmessage({ data: serializeClientMessage({ response: { status: ProtoStatuses.Error } } as any) } as MessageEvent);
             return;
          }
        }

        setTimeout(() => {
          let mockResponse: ProtoControllerResponse;
          if ('get_info' in clientMsg.message) {
            mockResponse = { response: { info: { ip: '192.168.1.100', mac: 'FE:E8:C0:D4:57:14', ble_name: 'ROOM_7', token: 'CM6wqJB5blIMvBKQ' } }};
          } else if ('get_state' in clientMsg.message) {
            const tempVariation = parseInt(clientMsg.room_id?.slice(-1) || "0", 10) % 3;
            const s: ProtoStateResponse = { 
                light_on: tempVariation === 0 ? ProtoLightStates.On : ProtoLightStates.Off,
                door_lock: tempVariation === 1 ? ProtoDoorLockStates.Open : ProtoDoorLockStates.Close,
                channel_1: tempVariation === 2 ? ProtoChannelStates.ChannelOn : ProtoChannelStates.ChannelOff,
                channel_2: tempVariation === 0 ? ProtoChannelStates.ChannelOn : ProtoChannelStates.ChannelOff,
                temperature: 20 + tempVariation, 
                humidity: 40 + tempVariation * 2, 
                pressure: 1000 + tempVariation 
            };
            mockResponse = { response: { state: s }};
          } else if ('set_state' in clientMsg.message) {
            const cmd = (clientMsg.message.set_state as { state: ProtoCommandStates }).state;
            let newHardwareStateSlice = { ...hardwareState }; 
             switch (cmd) {
                case ProtoCommandStates.LightOn: newHardwareStateSlice.light_on = ProtoLightStates.On; break;
                case ProtoCommandStates.LightOff: newHardwareStateSlice.light_on = ProtoLightStates.Off; break;
                case ProtoCommandStates.DoorLockOpen: newHardwareStateSlice.door_lock = ProtoDoorLockStates.Open; break;
                case ProtoCommandStates.DoorLockClose: newHardwareStateSlice.door_lock = ProtoDoorLockStates.Close; break;
                case ProtoCommandStates.Channel1On: newHardwareStateSlice.channel_1 = ProtoChannelStates.ChannelOn; break;
                case ProtoCommandStates.Channel1Off: newHardwareStateSlice.channel_1 = ProtoChannelStates.ChannelOff; break;
                case ProtoCommandStates.Channel2On: newHardwareStateSlice.channel_2 = ProtoChannelStates.ChannelOn; break;
                case ProtoCommandStates.Channel2Off: newHardwareStateSlice.channel_2 = ProtoChannelStates.ChannelOff; break;
            }
            setHardwareState(newHardwareStateSlice); 
            mockResponse = { response: { status: ProtoStatuses.Ok }};
          } else {
            mockResponse = { response: { status: ProtoStatuses.Error }}};
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
      console.log(`[ControllerHook] WebSocket Connected to shared controller for room ${roomId} (Simulated)`);
      setConnectionStatus('connected_tcp');
      toast({ title: 'TCP Connected', description: `Connection to controller established for Room ${roomId}.`});
      sendTcpMessage({ get_info: {} }); 
      if(authToken) { // Only get state if authenticated
        setTimeout(() => sendTcpMessage({ get_state: {} }), 200); 
        if (stateUpdateIntervalRef.current) clearInterval(stateUpdateIntervalRef.current);
        stateUpdateIntervalRef.current = setInterval(() => {
          sendTcpMessage({ get_state: {} });
        }, 7000); 
      } else {
        toast({ title: 'Authentication Required', description: 'Connect then login or book to control the room.', variant: 'default' });
      }
    };

    wsRef.current.onmessage = handleWebSocketMessage;

    wsRef.current.onerror = (event) => {
      console.error(`[ControllerHook] WebSocket Error for room ${roomId} (Simulated):`, event);
      setError({ message: 'TCP connection error. Controller might be offline.', type: 'tcp' });
      setConnectionStatus('error');
    };

    wsRef.current.onclose = () => {
      console.log(`[ControllerHook] WebSocket Disconnected for room ${roomId} (Simulated)`);
      if (stateUpdateIntervalRef.current) clearInterval(stateUpdateIntervalRef.current);
      // Do not set to 'disconnected' here if an error caused the close, error state is more informative
      if (connectionStatus !== 'error') {
          // setConnectionStatus('disconnected');
      }
    };
    
    setTimeout(() => {
       if (wsRef.current && wsRef.current.onopen && wsRef.current.readyState === WebSocket.CONNECTING) {
         wsRef.current.readyState = WebSocket.OPEN;
         (wsRef.current.onopen as Function)({} as Event);
       }
    }, 1000);

  }, [roomId, authToken, disconnectAll, handleWebSocketMessage, sendTcpMessage, hardwareState, connectionStatus]);


  const connectBle = useCallback(async () => {
    if (!navigator.bluetooth) {
      setError({ message: 'Web Bluetooth not supported.', type: 'ble' });
      setConnectionStatus('error');
      return;
    }
    // Allow get_info without token
    // if (!authToken) {
    //   setError({ message: 'Authentication token is missing for BLE connection.', type: 'auth' });
    //   toast({ title: 'BLE Connection Failed', description: 'Auth token missing.', variant: 'destructive' });
    //   setConnectionStatus('error');
    //   return;
    // }

    disconnectAll();
    const sharedBleName = "ROOM_7"; // Use the specific BLE name from controller info for connection
    setConnectionStatus('connecting_ble');
    setError(null);

    try {
      bleDeviceRef.current = await BleService.requestDevice({ filters: [{ name: sharedBleName }] });
      if (!bleDeviceRef.current) {
        // setConnectionStatus('disconnected'); 
        setError({ message: 'BLE device not found or selection cancelled.', type: 'ble' });
        return;
      }

      const server = await BleService.connectToGattServer(bleDeviceRef.current);
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      bleCharacteristicRef.current = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID);
      
      setConnectionStatus('authenticating_ble');
      
      await new Promise(resolve => setTimeout(resolve, 500)); 

      setConnectionStatus('connected_ble');
      toast({ title: 'BLE Connected', description: `Authenticated with ${sharedBleName} for Room ${roomId}.`});

      sendBleMessage({ get_info: {} }); 
      if (authToken) { // Only get state if authenticated
        setTimeout(() => sendBleMessage({ get_state: {} }), 200); 
        if (stateUpdateIntervalRef.current) clearInterval(stateUpdateIntervalRef.current);
        stateUpdateIntervalRef.current = setInterval(() => {
          sendBleMessage({ get_state: {} });
        }, 8000);
      } else {
         toast({ title: 'Authentication Required for BLE State', description: 'Connect then login or book to control the room via BLE.', variant: 'default' });
      }

    } catch (e: any) {
      console.error(`[ControllerHook] BLE Error for room ${roomId}:`, e);
      setError({ message: e.message || `BLE connection failed for room ${roomId}.`, type: 'ble' });
      setConnectionStatus('error');
    }
  }, [roomId, authToken, disconnectAll, sendBleMessage]);


  const connect = useCallback(() => {
    // Prioritize TCP. User can choose BLE if needed or if TCP fails.
    // No automatic BLE fallback here, user must initiate if desired.
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
    if (!authToken) {
      toast({ title: 'Command Failed', description: 'Authentication token is missing.', variant: 'destructive' });
      setError({message: 'Auth token missing for command', type: 'auth'});
      return;
    }
    setError(null); // Clear previous command errors
    const payload: ProtoClientMessagePayload = { set_state: { state: commandState } };
    if (connectionStatus === 'connected_tcp' && wsRef.current) {
      sendTcpMessage(payload);
    } else if (connectionStatus === 'connected_ble' && bleCharacteristicRef.current) {
      sendBleMessage(payload);
    } else {
      setError({ message: 'Not connected to controller.', type: 'command' });
      toast({ title: 'Command Failed', description: 'Not connected to controller.', variant: 'destructive' });
    }
  }, [connectionStatus, sendTcpMessage, sendBleMessage, authToken]);

  return {
    deviceInfo,
    hardwareState,
    connectionStatus,
    error,
    isSendingCommand,
    connect,
    connectBle, // Expose BLE connect separately
    disconnect: useCallback(() => { 
      disconnectAll();
      setConnectionStatus('disconnected');
      setDeviceInfo(null); // Clear device info on disconnect
      setHardwareState(initialHardwareState); // Reset hardware state
      setError(null); // Clear any errors
    }, [disconnectAll]),
    sendCommand,
  };
}

    