
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
} from '@/types/protobuf';
// Removed BleService import as focus is on WebSocket bridge
import { toast } from '@/hooks/use-toast';

const BRIDGE_WEBSOCKET_URL = 'ws://localhost:8080'; // Real bridge URL
const GET_STATE_INTERVAL = 7000; // Interval for polling state in ms

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type ControllerError = { message: string; type: 'websocket' | 'command' | 'auth' | 'parse' } | null;

const initialHardwareState: ProtoStateResponse = {
  light_on: ProtoLightStates.Off,
  door_lock: ProtoDoorLockStates.Close,
  channel_1: ProtoChannelStates.ChannelOff,
  channel_2: ProtoChannelStates.ChannelOff,
  temperature: 0,
  humidity: 0,
  pressure: 0,
};

// Helper functions outside the hook
const parseControllerResponse = (data: ArrayBuffer): ProtoControllerResponse | null => {
  try {
    // Assuming bridge sends JSON string over WebSocket for now
    const textDecoder = new TextDecoder();
    const jsonString = textDecoder.decode(data);
    return JSON.parse(jsonString) as ProtoControllerResponse;
  } catch (e) {
    console.error("Failed to parse controller response:", e);
    return null;
  }
};

const serializeClientMessage = (message: ProtoClientMessage): ArrayBuffer => {
  // Assuming bridge expects JSON string over WebSocket for now
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
  const stateUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;


  const sendMessage = useCallback((payload: ProtoClientMessagePayload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const isGetInfo = 'get_info' in payload;
      const message: ProtoClientMessage = {
        auth_token: isGetInfo ? null : authToken,
        room_id: isGetInfo ? null : roomId,
        message: payload,
      };
      
      if (!isGetInfo && (!authToken || !roomId)) {
        setError({ message: 'Auth token or Room ID missing for protected command.', type: 'auth' });
        toast({ title: 'Authentication Error', description: 'Missing token or Room ID.', variant: 'destructive'});
        setIsSendingCommand(false);
        return;
      }
      
      wsRef.current.send(serializeClientMessage(message));
      if ('set_state' in payload) setIsSendingCommand(true);
    } else {
      setError({ message: 'WebSocket connection not open.', type: 'websocket' });
      setIsSendingCommand(false);
    }
  }, [authToken, roomId]);

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    if (!(event.data instanceof ArrayBuffer)) {
        console.error("Received non-ArrayBuffer WebSocket message:", event.data);
        setError({ message: 'Received invalid data format from WebSocket.', type: 'parse' });
        setIsSendingCommand(false);
        return;
    }

    const response = parseControllerResponse(event.data as ArrayBuffer);
    if (!response) {
      setError({ message: 'Invalid response from controller.', type: 'parse' });
      setIsSendingCommand(false);
      return;
    }

    if ('info' in response.response) {
      setDeviceInfo(response.response.info);
      toast({ title: 'Controller Info Received', description: `Connected to controller: ${response.response.info.ble_name || response.response.info.ip}` });
      // After getting info, if authenticated, get initial state
      if (authToken && roomId) {
        sendMessage({ get_state: {} });
      } else if (!authToken){
        toast({title: "Authentication Required", description: "Please login or ensure booking is active to control the room.", variant: "default"});
      }
    } else if ('state' in response.response) {
      setHardwareState(response.response.state);
    } else if ('status' in response.response) {
      if (response.response.status === ProtoStatuses.Ok) {
        toast({ title: 'Command Success', description: 'Controller confirmed action.' });
        // Refresh state after successful command
        sendMessage({ get_state: {} });
      } else {
        const errorMsg = `Controller reported an error for Room ${roomId}.`;
        toast({ title: 'Command Error', description: errorMsg, variant: 'destructive' });
        setError({ message: errorMsg, type: 'command' });
      }
    }
    setIsSendingCommand(false);
  }, [sendMessage, authToken, roomId]); // Added authToken and roomId

  const disconnect = useCallback(() => {
    if (stateUpdateIntervalRef.current) {
      clearInterval(stateUpdateIntervalRef.current);
      stateUpdateIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent onclose handler from triggering reconnect logic
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
    setDeviceInfo(null);
    setHardwareState(initialHardwareState);
    // setError(null); // Optionally clear error on explicit disconnect
    console.log(`[ControllerHook] WebSocket Disconnected for room ${roomId}`);
  }, [roomId]);


  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        console.log("[ControllerHook] WebSocket already connecting or open.");
        return;
    }
    
    disconnect(); // Ensure any previous connection is cleaned up
    setConnectionStatus('connecting');
    setError(null);
    reconnectAttemptsRef.current = 0;

    console.log(`[ControllerHook] Attempting to connect to WebSocket: ${BRIDGE_WEBSOCKET_URL} for room ${roomId}`);
    
    try {
        wsRef.current = new WebSocket(BRIDGE_WEBSOCKET_URL);
    } catch (e: any) {
        console.error(`[ControllerHook] WebSocket instantiation error for room ${roomId}:`, e);
        setError({ message: e.message || 'Failed to create WebSocket.', type: 'websocket' });
        setConnectionStatus('error');
        return;
    }

    wsRef.current.binaryType = 'arraybuffer';

    wsRef.current.onopen = () => {
      console.log(`[ControllerHook] WebSocket Connected to bridge for room ${roomId}`);
      reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
      setConnectionStatus('connected');
      toast({ title: 'Bridge Connected', description: `Connection to bridge established for Room ${roomId}.`});
      
      // Always get_info on connect. Auth for get_state will be checked in onmessage
      sendMessage({ get_info: {} });
      
      if (authToken && roomId) { // Start polling only if authenticated
        if (stateUpdateIntervalRef.current) clearInterval(stateUpdateIntervalRef.current);
        stateUpdateIntervalRef.current = setInterval(() => {
          sendMessage({ get_state: {} });
        }, GET_STATE_INTERVAL);
      } else {
         // Toast about needing auth is handled in onmessage after get_info
      }
    };

    wsRef.current.onmessage = handleWebSocketMessage;

    wsRef.current.onerror = (event) => {
      console.error(`[ControllerHook] WebSocket Error for room ${roomId}:`, event);
      const errorMsg = 'WebSocket connection error. Bridge service might be offline or unreachable.';
      setError({ message: errorMsg, type: 'websocket' });
      // Don't set to 'error' status immediately, onclose will handle retry/error state
    };

    wsRef.current.onclose = (event) => {
      console.log(`[ControllerHook] WebSocket Connection Closed for room ${roomId}. Code: ${event.code}, Clean: ${event.wasClean}`);
      if (stateUpdateIntervalRef.current) clearInterval(stateUpdateIntervalRef.current);
      
      // Only attempt to reconnect if it was not a clean disconnect initiated by our app
      if (!event.wasClean && connectionStatus !== 'disconnected') { // Check if not explicitly disconnected
        reconnectAttemptsRef.current++;
        if (reconnectAttemptsRef.current <= MAX_RECONNECT_ATTEMPTS) {
          console.log(`[ControllerHook] Attempting to reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);
          setConnectionStatus('connecting'); // Show as connecting during retry
          setTimeout(() => {
            // Check if still in 'connecting' state before retrying, might have been explicitly disconnected
            if (connectionStatus === 'connecting') connect();
          }, RECONNECT_DELAY * reconnectAttemptsRef.current); // Exponential backoff could be better
        } else {
          console.error(`[ControllerHook] Max reconnect attempts reached for room ${roomId}.`);
          setError({ message: 'Failed to connect to the bridge after multiple attempts.', type: 'websocket' });
          setConnectionStatus('error');
        }
      } else {
         // If it was a clean disconnect or explicit disconnect, set to 'disconnected'
         if (connectionStatus !== 'error') { // Don't override an existing error state with 'disconnected'
            setConnectionStatus('disconnected');
         }
      }
    };
  }, [roomId, authToken, disconnect, handleWebSocketMessage, sendMessage, connectionStatus]);


  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const sendCommandToController = useCallback((commandState: ProtoCommandStates) => {
    if (!authToken) {
      toast({ title: 'Command Failed', description: 'Authentication token is missing.', variant: 'destructive' });
      setError({message: 'Auth token missing for command', type: 'auth'});
      return;
    }
    if (connectionStatus !== 'connected') {
      toast({ title: 'Command Failed', description: 'Not connected to controller bridge.', variant: 'destructive' });
      setError({message: 'Not connected to controller bridge.', type: 'websocket'});
      return;
    }
    setError(null); // Clear previous errors before sending a new command
    const payload: ProtoClientMessagePayload = { set_state: { state: commandState } };
    sendMessage(payload);
  }, [connectionStatus, sendMessage, authToken]);

  return {
    deviceInfo,
    hardwareState,
    connectionStatus,
    error,
    isSendingCommand,
    connect,
    // connectBle is removed as primary path is WebSocket bridge
    disconnect,
    sendCommand: sendCommandToController,
  };
}

    