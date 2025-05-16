
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useHotelStore } from '@/store/useStore'; // To get authToken
import { toast } from '@/hooks/use-toast';
import {
  type InfoResponse,
  type StateResponse,
  Statuses,
  States,
  LighStates,
  DoorLockStates,
  ChannelStates,
  type ClientMessageOneofPayload,
  type BridgeResponse,
  type FrontendWebsocketMessage,
  type ProtoControllerResponse
} from '@/types/protobuf';

const BRIDGE_WEBSOCKET_URL = typeof window !== 'undefined' ?
  `ws://${process.env.NEXT_PUBLIC_BRIDGE_HOST || window.location.hostname}:${process.env.NEXT_PUBLIC_BRIDGE_PORT || '8080'}` :
  'ws://localhost:8080'; // Fallback for SSR

const GET_STATE_INTERVAL = 7000; // Interval for polling state in ms
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_BASE = 3000; // ms

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type ControllerError = { message: string; type: 'websocket' | 'command_error' | 'auth' | 'parse' | 'bridge' } | null;

const initialHardwareState: StateResponse = {
  light_on: LighStates.Off,
  door_lock: DoorLockStates.Close,
  channel_1: ChannelStates.ChannelOff,
  channel_2: ChannelStates.ChannelOff,
  temperature: 0,
  humidity: 0,
  pressure: 0,
};

export function useRoomController(roomId: string, authToken: string | null) {
  const [deviceInfo, setDeviceInfo] = useState<InfoResponse | null>(null);
  const [hardwareState, setHardwareState] = useState<StateResponse>(initialHardwareState);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<ControllerError>(null);
  const [isSendingCommand, setIsSendingCommand] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const stateUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const sendMessageToBridge = useCallback((payload: ClientMessageOneofPayload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const messageForBridge: FrontendWebsocketMessage = {
        auth_token: payload.get_info ? null : authToken, // Send token only if not get_info
        room_id: payload.get_info ? null : roomId,        // Send room_id only if not get_info
        message: payload
      };
      try {
        const jsonMessage = JSON.stringify(messageForBridge);
        console.log(`[useRoomController] Sending to bridge: ${jsonMessage}`);
        wsRef.current.send(jsonMessage);
        if ('set_state' in payload) {
            setIsSendingCommand(true);
        }
      } catch (e) {
        console.error('[useRoomController] Failed to stringify or send message:', e);
        setError({ message: 'Failed to construct or send command to bridge.', type: 'websocket' });
        setIsSendingCommand(false);
      }
    } else {
      setError({ message: 'WebSocket connection not open.', type: 'websocket' });
      toast({ title: 'Connection Error', description: 'Not connected to the controller bridge.', variant: 'destructive' });
      setIsSendingCommand(false);
    }
  }, [authToken, roomId]);

  const handleBridgeResponse = useCallback((data: any) => {
    const bridgeResponse = data as BridgeResponse;
    console.log('[useRoomController] Received from bridge:', bridgeResponse);

    if (bridgeResponse.error) {
      console.error('[useRoomController] Error from bridge:', bridgeResponse.error);
      setError({ message: bridgeResponse.error, type: 'bridge' });
      toast({ title: 'Bridge Error', description: bridgeResponse.error, variant: 'destructive' });
      setIsSendingCommand(false);
      return;
    }

    if (bridgeResponse.data) {
      const controllerProtoResponse = bridgeResponse.data as ProtoControllerResponse; // This is ProtoControllerResponse like
      if ('info' in controllerProtoResponse.response) {
        setDeviceInfo(controllerProtoResponse.response.info);
        toast({ title: 'Controller Info', description: `Fetched info for ${controllerProtoResponse.response.info.ble_name || 'controller'}.` });
        if (authToken && roomId) { // After getting info, if authenticated, get initial state
          sendMessageToBridge({ get_state: {} });
        } else {
          toast({ title: "Info Received", description: "Controller info loaded. Authenticate to control the room.", variant: "default" });
        }
      } else if ('state' in controllerProtoResponse.response) {
        setHardwareState(controllerProtoResponse.response.state);
      } else if ('status' in controllerProtoResponse.response) {
        if (controllerProtoResponse.response.status === Statuses.Ok) {
          toast({ title: 'Command Success', description: 'Controller confirmed action.' });
          if (authToken && roomId) { // Refresh state after successful command
             sendMessageToBridge({ get_state: {} });
          }
        } else {
          const errorMsg = `Controller command failed for Room ${roomId}. Status: ${controllerProtoResponse.response.status}`;
          toast({ title: 'Command Error', description: errorMsg, variant: 'destructive' });
          setError({ message: errorMsg, type: 'command_error' });
        }
      }
    }
    setIsSendingCommand(false);
  }, [sendMessageToBridge, authToken, roomId]);


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
    setDeviceInfo(null);
    setHardwareState(initialHardwareState);
    // setError(null); // Keep error for user to see
    console.log(`[useRoomController] WebSocket Disconnected for room ${roomId}`);
  }, [roomId]);


  const connect = useCallback(() => {
     if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED && wsRef.current.readyState !== WebSocket.CLOSING) {
        console.log("[useRoomController] WebSocket already connecting or open.");
        if(connectionStatus === 'connected') {
            sendMessageToBridge({ get_info: {} }); // Re-fetch info on reconnect attempt if already connected
             if (authToken && roomId && !stateUpdateIntervalRef.current) { // Restart polling if not active
                stateUpdateIntervalRef.current = setInterval(() => sendMessageToBridge({ get_state: {} }), GET_STATE_INTERVAL);
            }
        }
        return;
    }

    disconnect();
    setConnectionStatus('connecting');
    setError(null);
    reconnectAttemptsRef.current = 0;
    console.log(`[useRoomController] Attempting to connect to WebSocket: ${BRIDGE_WEBSOCKET_URL} for room ${roomId}`);

    try {
        wsRef.current = new WebSocket(BRIDGE_WEBSOCKET_URL);
    } catch (e: any) {
        console.error(`[useRoomController] WebSocket instantiation error for room ${roomId}:`, e);
        setError({ message: e.message || 'Failed to create WebSocket.', type: 'websocket' });
        setConnectionStatus('error');
        return;
    }

    wsRef.current.onopen = () => {
      console.log(`[useRoomController] WebSocket Connected to bridge for room ${roomId}`);
      reconnectAttemptsRef.current = 0;
      setConnectionStatus('connected');
      toast({ title: 'Bridge Connected', description: `Connection to bridge established for Room ${roomId}.`});

      sendMessageToBridge({ get_info: {} }); // Always get_info on connect.

      if (authToken && roomId) { // Only start polling if authenticated
        if (stateUpdateIntervalRef.current) clearInterval(stateUpdateIntervalRef.current);
        stateUpdateIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            sendMessageToBridge({ get_state: {} });
          } else {
              if(stateUpdateIntervalRef.current) clearInterval(stateUpdateIntervalRef.current);
          }
        }, GET_STATE_INTERVAL);
      } else {
        console.log("[useRoomController] No authToken or roomId, not starting state polling.");
      }
    };

    wsRef.current.onmessage = (event: MessageEvent) => {
      try {
        const parsedData = JSON.parse(event.data as string);
        handleBridgeResponse(parsedData);
      } catch (e) {
        console.error('[useRoomController] Error parsing JSON message from bridge:', event.data, e);
        setError({ message: 'Invalid JSON response from bridge.', type: 'parse' });
        setIsSendingCommand(false);
      }
    };

    wsRef.current.onerror = (event) => {
      console.error(`[useRoomController] WebSocket Error for room ${roomId}:`, event);
      // No need to set error here directly, onclose will handle it.
    };

    wsRef.current.onclose = (event) => {
      console.log(`[useRoomController] WebSocket Connection Closed for room ${roomId}. Code: ${event.code}, Clean: ${event.wasClean}, Reason: ${event.reason}`);
      if (stateUpdateIntervalRef.current) {
        clearInterval(stateUpdateIntervalRef.current);
        stateUpdateIntervalRef.current = null;
      }

      if (wsRef.current && !event.wasClean) { // wsRef.current must be non-null (not manually disconnected)
        reconnectAttemptsRef.current++;
        if (reconnectAttemptsRef.current <= MAX_RECONNECT_ATTEMPTS) {
          console.log(`[useRoomController] Attempting to reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);
          setConnectionStatus('connecting');
          setTimeout(() => {
            connect();
          }, RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttemptsRef.current -1));
        } else {
          console.error(`[useRoomController] Max reconnect attempts reached for room ${roomId}.`);
          setError({ message: 'Failed to connect to the bridge after multiple attempts.', type: 'websocket' });
          setConnectionStatus('error');
          wsRef.current = null;
        }
      } else {
         if (connectionStatus !== 'error') { // Only set to disconnected if not already in an error state
            setConnectionStatus('disconnected');
         }
         wsRef.current = null;
      }
    };
  }, [roomId, authToken, disconnect, handleBridgeResponse, sendMessageToBridge, connectionStatus]);


  useEffect(() => {
    return () => {
      console.log(`[useRoomController] Unmounting for room ${roomId}, disconnecting.`);
      disconnect();
    };
  }, [disconnect, roomId]);

  const sendCommandToController = useCallback((command: States) => {
    if (!authToken) {
      toast({ title: 'Command Failed', description: 'Authentication token is missing.', variant: 'destructive' });
      setError({message: 'Auth token missing for command.', type: 'auth'});
      return;
    }
    if (connectionStatus !== 'connected') {
      toast({ title: 'Command Failed', description: 'Not connected to controller bridge.', variant: 'destructive' });
      setError({message: 'Not connected to controller bridge.', type: 'websocket'});
      return;
    }
    setError(null);
    sendMessageToBridge({ set_state: { state: command } });
  }, [connectionStatus, sendMessageToBridge, authToken]);

  return {
    deviceInfo,
    hardwareState,
    connectionStatus,
    error,
    isSendingCommand,
    connect,
    disconnect,
    sendCommand: sendCommandToController,
  };
}
