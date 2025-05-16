
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useControllerStore } from '@/store/controllerStore';

const BRIDGE_WEBSOCKET_URL = typeof window !== 'undefined' ? 
  `ws://${window.location.hostname}:8080` : 'ws://localhost:8080'; // Fallback for SSR, though client-side only

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type ControllerError = { message: string; type: 'websocket' | 'command' | 'auth' | 'parse' | 'bridge' } | null;

export interface ControllerInfo {
  ip?: string;
  mac?: string;
  ble_name?: string;
  token?: string; // Controller's internal token/identifier
  [key: string]: any; // Allow other fields
}

export interface ControllerHardwareState {
  light_on?: boolean;
  door_lock?: string; // e.g., "open" or "closed"
  channel_1?: boolean;
  channel_2?: boolean;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  [key: string]: any; // Allow other fields
}

const GET_STATE_INTERVAL = 7000; // Interval for polling state in ms

export function useControllerConnection() {
  const { authToken, roomId } = useControllerStore();
  const [deviceInfo, setDeviceInfo] = useState<ControllerInfo | null>(null);
  const [hardwareState, setHardwareState] = useState<ControllerHardwareState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<ControllerError | null>(null);
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);


  const wsRef = useRef<WebSocket | null>(null);
  const stateUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  const wsSendMessage = useCallback((messageObject: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        const messageString = JSON.stringify(messageObject);
        wsRef.current.send(messageString);
        console.log('[WS Hook] Sent:', messageObject);
        setIsSendingCommand(true); // General indicator that something was sent
      } catch (e) {
        console.error('[WS Hook] Failed to stringify or send message:', e);
        setError({ message: 'Failed to send command to bridge.', type: 'websocket' });
        setIsSendingCommand(false);
      }
    } else {
      setError({ message: 'WebSocket connection not open.', type: 'websocket' });
      setIsSendingCommand(false);
    }
  }, []);

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    setIsSendingCommand(false); // Command processed or response received
    try {
      const response = JSON.parse(event.data as string);
      setLastMessage(response);
      console.log('[WS Hook] Received:', response);

      if (response.type === 'info' && response.data) {
        setDeviceInfo(response.data);
        // After getting info, if authenticated, get initial state
        if (authToken && roomId) {
          wsSendMessage({ type: 'get_state', payload: { auth_token: authToken, room_id: roomId } });
        }
      } else if (response.type === 'state' && response.data) {
        setHardwareState(response.data);
      } else if (response.type === 'status') { // Generic status from controller via bridge
        if (response.status === 'Ok' || response.success === true || response.message?.toLowerCase().includes("ok")) {
           // alert(`Command Success: ${response.message || 'Controller confirmed action.'}`);
           // Refresh state after successful command
           if (authToken && roomId) {
            wsSendMessage({ type: 'get_state', payload: { auth_token: authToken, room_id: roomId } });
           }
        } else {
           const errorMsg = `Controller/Bridge Status: ${response.message || 'Unknown error'}`;
           alert(errorMsg);
           setError({ message: errorMsg, type: 'command' });
        }
      } else if (response.type === 'bridge_status' || response.type === 'bridge_error' || response.type === 'raw_data') {
        // Messages from the bridge itself
        console.log(`[Bridge Message] ${response.type}: `, response.message || response.data);
        if (response.type === 'bridge_error') {
            setError({ message: response.message, type: 'bridge' });
        }
      } else if (response.ip && response.mac) { // Heuristic for info object if not typed
        setDeviceInfo(response as ControllerInfo);
         if (authToken && roomId) {
          wsSendMessage({ type: 'get_state', payload: { auth_token: authToken, room_id: roomId } });
        }
      } else if (typeof response.light_on !== 'undefined' || typeof response.temperature !== 'undefined') { // Heuristic for state object
         setHardwareState(response as ControllerHardwareState);
      }

    } catch (e) {
      console.error('[WS Hook] Error parsing message or invalid response structure:', event.data, e);
      setError({ message: 'Invalid JSON response from bridge.', type: 'parse' });
       setLastMessage({ raw: event.data, error: 'Parse failed'});
    }
  }, [authToken, roomId, wsSendMessage]);

  const disconnect = useCallback(() => {
    if (stateUpdateIntervalRef.current) {
      clearInterval(stateUpdateIntervalRef.current);
      stateUpdateIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
    console.log('[WS Hook] WebSocket Disconnected.');
  }, []);

  const connect = useCallback(() => {
    if (!authToken || !roomId) {
      setError({ message: 'Auth Token or Room ID is missing. Please login.', type: 'auth' });
      setConnectionStatus('error');
      return;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('[WS Hook] Already connected.');
      // If already connected, perhaps just send get_info or get_state again
      wsSendMessage({ type: 'get_info' });
      return;
    }
    
    disconnect(); 
    setConnectionStatus('connecting');
    setError(null);
    reconnectAttemptsRef.current = 0;
    setLastMessage(null);
    setDeviceInfo(null);
    setHardwareState(null);

    console.log(`[WS Hook] Attempting to connect to WebSocket: ${BRIDGE_WEBSOCKET_URL}`);
    
    try {
      wsRef.current = new WebSocket(BRIDGE_WEBSOCKET_URL);
    } catch (e: any) {
      console.error(`[WS Hook] WebSocket instantiation error:`, e);
      setError({ message: e.message || 'Failed to create WebSocket.', type: 'websocket' });
      setConnectionStatus('error');
      return;
    }

    wsRef.current.onopen = () => {
      console.log(`[WS Hook] WebSocket Connected to bridge.`);
      reconnectAttemptsRef.current = 0;
      setConnectionStatus('connected');
      setError(null);
      wsSendMessage({ type: 'get_info' }); // Get general controller info first
      
      // Start polling for state if authenticated
      if (stateUpdateIntervalRef.current) clearInterval(stateUpdateIntervalRef.current);
      stateUpdateIntervalRef.current = setInterval(() => {
        if (authToken && roomId && wsRef.current?.readyState === WebSocket.OPEN) {
          wsSendMessage({ type: 'get_state', payload: { auth_token: authToken, room_id: roomId } });
        }
      }, GET_STATE_INTERVAL);
    };

    wsRef.current.onmessage = handleWebSocketMessage;

    wsRef.current.onerror = (event) => {
      console.error(`[WS Hook] WebSocket Error:`, event);
      setError({ message: 'WebSocket connection error. Bridge service might be offline or unreachable.', type: 'websocket' });
      // onclose will handle retry/error state
    };

    wsRef.current.onclose = (event) => {
      console.log(`[WS Hook] WebSocket Connection Closed. Code: ${event.code}, Clean: ${event.wasClean}`);
      if (stateUpdateIntervalRef.current) clearInterval(stateUpdateIntervalRef.current);
      
      if (!event.wasClean && connectionStatus !== 'disconnected') {
        reconnectAttemptsRef.current++;
        if (reconnectAttemptsRef.current <= MAX_RECONNECT_ATTEMPTS) {
          console.log(`[WS Hook] Attempting to reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);
          setConnectionStatus('connecting');
          setTimeout(() => {
            if (connectionStatus === 'connecting') connect();
          }, RECONNECT_DELAY * reconnectAttemptsRef.current);
        } else {
          console.error(`[WS Hook] Max reconnect attempts reached.`);
          setError({ message: 'Failed to connect to the bridge after multiple attempts.', type: 'websocket' });
          setConnectionStatus('error');
        }
      } else {
         if (connectionStatus !== 'error') {
            setConnectionStatus('disconnected');
         }
      }
    };
  }, [authToken, roomId, disconnect, handleWebSocketMessage, wsSendMessage, connectionStatus]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const sendCommand = useCallback((commandName: string, commandValue?: any) => {
    if (!authToken || !roomId) {
      alert('Auth Token or Room ID is missing.');
      setError({ message: 'Auth Token or Room ID missing.', type: 'auth' });
      return;
    }
    if (connectionStatus !== 'connected') {
      alert('Not connected to controller bridge.');
      setError({ message: 'Not connected to controller bridge.', type: 'websocket' });
      return;
    }
    
    let commandPayload: any = {};
    // Example: if commandName is 'LightOn', 'LightOff', etc.
    // Or more structured like { light_on: true }
    // Based on user prompt "set_state: { power: true }", we'll use an object for commands
    // commandName here could be a key like "light_on", and commandValue its state true/false
    // For simplicity, let's assume commandName is like "LightOn", "DoorLockOpen" etc.
    // The bridge should interpret this.
    // Or the payload should be the state object directly:
    // e.g. sendCommand({ light_on: true })
    // Let's use commandName as the action, e.g., "setLight", and commandValue is the {light_on: true}
    // The prompt had: "set_state: { power: true }"
    // For now, I'll make commandName an object representing the desired state change.
    // sendCommand({ light_on: true })
    // The bridge receives: { type: "set_state", payload: { auth_token: "...", room_id: "...", command: { "light_on": true } } }

    if (typeof commandName === 'object' && commandName !== null) {
        wsSendMessage({
            type: 'set_state',
            payload: {
                auth_token: authToken,
                room_id: roomId,
                command: commandName // commandName is the state object itself
            }
        });
    } else if (typeof commandName === 'string') {
         // This case can be for simple string commands if needed.
         // For example, if commandName is 'LightOn' (string)
         // and the bridge maps this string to a specific action.
         // For now, focusing on object-based state changes.
        wsSendMessage({
            type: 'set_state',
            payload: {
                auth_token: authToken,
                room_id: roomId,
                command_name: commandName, // A specific string command
                ...(commandValue !== undefined && { value: commandValue })
            }
        });
    }


  }, [authToken, roomId, connectionStatus, wsSendMessage]);
  
  const refreshState = useCallback(() => {
    if (authToken && roomId && connectionStatus === 'connected') {
      wsSendMessage({ type: 'get_state', payload: { auth_token: authToken, room_id: roomId } });
    } else {
      console.log("Cannot refresh state: not connected or missing auth details.");
    }
  }, [authToken, roomId, connectionStatus, wsSendMessage]);

  return {
    deviceInfo,
    hardwareState,
    connectionStatus,
    error,
    isSendingCommand,
    lastMessage,
    connect,
    disconnect,
    sendCommand,
    getDeviceInfo: () => {
      if (connectionStatus === 'connected') wsSendMessage({ type: 'get_info' });
    },
    getCurrentState: refreshState, // Renamed for clarity
  };
}
