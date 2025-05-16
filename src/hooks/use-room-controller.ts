
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useHotelStore } from '@/store/useStore'; // To get authToken
import { toast } from '@/hooks/use-toast';
import type {
  InfoResponse,
  StateResponse,
  Statuses,
  States, // Renamed from ProtoCommandStates for SetState
  LighStates,
  DoorLockStates,
  ChannelStates,
  ClientMessageOneofPayload, // Used for constructing the 'message' part of JSON
  BridgeResponse,
  FrontendWebsocketMessage
} from '@/types/protobuf';

const BRIDGE_WEBSOCKET_URL = typeof window !== 'undefined' ?
  `ws://${process.env.NEXT_PUBLIC_BRIDGE_HOST || window.location.hostname}:${process.env.NEXT_PUBLIC_BRIDGE_PORT || '8080'}` :
  'ws://localhost:8080'; // Fallback for SSR, though client-side only

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

export function useRoomController(roomId: string) { // authToken will be fetched from store inside
  const userAuthToken = useHotelStore(state => state.user.authToken);

  const [deviceInfo, setDeviceInfo] = useState<InfoResponse | null>(null);
  const [hardwareState, setHardwareState] = useState<StateResponse>(initialHardwareState);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<ControllerError>(null);
  const [isSendingCommand, setIsSendingCommand] = useState(false); // To disable UI during command

  const wsRef = useRef<WebSocket | null>(null);
  const stateUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const sendMessageToBridge = useCallback((payload: ClientMessageOneofPayload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const messageForBridge: FrontendWebsocketMessage = {
        auth_token: userAuthToken, // Send token for bridge-side validation/logging if implemented
        room_id: roomId,          // Send room_id for bridge-side context if implemented
        message: payload
      };
      try {
        const jsonMessage = JSON.stringify(messageForBridge);
        console.log(`[useRoomController] Sending to bridge: ${jsonMessage}`);
        wsRef.current.send(jsonMessage);
        if ('set_state' in payload) { // Only set true for actual commands, not for get_state/get_info
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
  }, [userAuthToken, roomId]);

  const handleBridgeResponse = useCallback((data: any) => {
    const bridgeResponse = data as BridgeResponse; // Assuming data is already parsed JSON
    console.log('[useRoomController] Received from bridge:', bridgeResponse);

    if (bridgeResponse.error) {
      console.error('[useRoomController] Error from bridge:', bridgeResponse.error);
      setError({ message: bridgeResponse.error, type: 'bridge' });
      toast({ title: 'Bridge Error', description: bridgeResponse.error, variant: 'destructive' });
      setIsSendingCommand(false); // Clear sending flag on error
      return;
    }

    if (bridgeResponse.data) {
      const controllerProtoResponse = bridgeResponse.data; // This is ProtoControllerResponse like
      if ('info' in controllerProtoResponse.response) {
        setDeviceInfo(controllerProtoResponse.response.info);
        toast({ title: 'Controller Info', description: `Fetched info for ${controllerProtoResponse.response.info.ble_name || 'controller'}.` });
        // After getting info, if authenticated, get initial state
        if (userAuthToken && roomId) {
          sendMessageToBridge({ get_state: {} });
        } else {
          toast({ title: "Authentication Required", description: "Please ensure you are logged in and have an active booking to control the room.", variant: "default" });
        }
      } else if ('state' in controllerProtoResponse.response) {
        setHardwareState(controllerProtoResponse.response.state);
      } else if ('status' in controllerProtoResponse.response) {
        if (controllerProtoResponse.response.status === Statuses.Ok) {
          toast({ title: 'Command Success', description: 'Controller confirmed action.' });
          // Refresh state after successful command
          if (userAuthToken && roomId) {
             sendMessageToBridge({ get_state: {} });
          }
        } else {
          const errorMsg = `Controller command failed for Room ${roomId}.`;
          toast({ title: 'Command Error', description: errorMsg, variant: 'destructive' });
          setError({ message: errorMsg, type: 'command_error' });
        }
      }
    }
    setIsSendingCommand(false); // Clear sending flag after processing a response
  }, [sendMessageToBridge, userAuthToken, roomId]);


  const disconnect = useCallback(() => {
    if (stateUpdateIntervalRef.current) {
      clearInterval(stateUpdateIntervalRef.current);
      stateUpdateIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent onclose handler from triggering reconnect logic during manual disconnect
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
    setDeviceInfo(null);
    setHardwareState(initialHardwareState); // Reset to initial
    // setError(null); // Optionally clear error on explicit disconnect
    console.log(`[useRoomController] WebSocket Disconnected for room ${roomId}`);
  }, [roomId]);


  const connect = useCallback(() => {
    if (!userAuthToken) {
      setError({ message: 'Authentication token is missing. Cannot connect to controller.', type: 'auth' });
      toast({ title: 'Authentication Failed', description: 'Auth token missing. Please book a room or log in.', variant: 'destructive' });
      setConnectionStatus('error');
      return;
    }
     if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED && wsRef.current.readyState !== WebSocket.CLOSING) {
        console.log("[useRoomController] WebSocket already connecting or open.");
        // If already connected, ensure polling is active or re-fetch info/state
        if(connectionStatus === 'connected') {
            sendMessageToBridge({ get_info: {} });
             if (userAuthToken && roomId && !stateUpdateIntervalRef.current) {
                stateUpdateIntervalRef.current = setInterval(() => sendMessageToBridge({ get_state: {} }), GET_STATE_INTERVAL);
            }
        }
        return;
    }

    disconnect(); // Ensure any previous connection is cleaned up
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
      reconnectAttemptsRef.current = 0; // Reset reconnect attempts
      setConnectionStatus('connected');
      toast({ title: 'Bridge Connected', description: `Connection to bridge established for Room ${roomId}.`});

      sendMessageToBridge({ get_info: {} }); // Always get_info on connect.

      // Start polling for state if authenticated (already checked userAuthToken above)
      if (stateUpdateIntervalRef.current) clearInterval(stateUpdateIntervalRef.current);
      stateUpdateIntervalRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) { // Ensure still open
          sendMessageToBridge({ get_state: {} });
        } else {
            if(stateUpdateIntervalRef.current) clearInterval(stateUpdateIntervalRef.current); // Stop if no longer open
        }
      }, GET_STATE_INTERVAL);
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
      // Don't set error state here directly, onclose will handle retries or final error state
      // setError({ message: 'WebSocket connection error. Bridge service might be offline or unreachable.', type: 'websocket' });
    };

    wsRef.current.onclose = (event) => {
      console.log(`[useRoomController] WebSocket Connection Closed for room ${roomId}. Code: ${event.code}, Clean: ${event.wasClean}, Reason: ${event.reason}`);
      if (stateUpdateIntervalRef.current) {
        clearInterval(stateUpdateIntervalRef.current);
        stateUpdateIntervalRef.current = null;
      }

      // Only attempt to reconnect if it was not a clean disconnect initiated by our app (wsRef.current = null in disconnect)
      // or if the component is still mounted and trying to connect.
      if (wsRef.current && !event.wasClean) { // wsRef.current being non-null implies disconnect wasn't manual via disconnect()
        reconnectAttemptsRef.current++;
        if (reconnectAttemptsRef.current <= MAX_RECONNECT_ATTEMPTS) {
          console.log(`[useRoomController] Attempting to reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);
          setConnectionStatus('connecting'); // Show as connecting during retry
          setTimeout(() => {
            connect(); // connect will check wsRef.current state again
          }, RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttemptsRef.current -1)); // Exponential backoff
        } else {
          console.error(`[useRoomController] Max reconnect attempts reached for room ${roomId}.`);
          setError({ message: 'Failed to connect to the bridge after multiple attempts.', type: 'websocket' });
          setConnectionStatus('error');
          wsRef.current = null; // Ensure we don't try to use it further
        }
      } else {
         // If it was a clean disconnect or explicit disconnect via our disconnect(), set to 'disconnected'
         // unless already in an error state.
         if (connectionStatus !== 'error') {
            setConnectionStatus('disconnected');
         }
         wsRef.current = null; // Clean up ref
      }
    };
  }, [roomId, userAuthToken, disconnect, handleBridgeResponse, sendMessageToBridge, connectionStatus]);


  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      console.log(`[useRoomController] Unmounting for room ${roomId}, disconnecting.`);
      disconnect();
    };
  }, [disconnect, roomId]); // roomId added to ensure cleanup is for the right instance if props change

  const sendCommandToController = useCallback((command: States) => {
    if (!userAuthToken) {
      toast({ title: 'Command Failed', description: 'Authentication token is missing.', variant: 'destructive' });
      setError({message: 'Auth token missing for command.', type: 'auth'});
      return;
    }
    if (connectionStatus !== 'connected') {
      toast({ title: 'Command Failed', description: 'Not connected to controller bridge.', variant: 'destructive' });
      setError({message: 'Not connected to controller bridge.', type: 'websocket'});
      return;
    }
    setError(null); // Clear previous errors before sending a new command
    sendMessageToBridge({ set_state: { state: command } });
  }, [connectionStatus, sendMessageToBridge, userAuthToken]);

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
